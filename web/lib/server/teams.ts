// ============================================================================
// Teams — the social unit (SERVER-ONLY). All mutations run through admin-only
// transactions; clients only ever READ teams/{id} + teams/{id}/members.
//
// Live totals are denormalized: a team's totalBars / totalBlackThunderCount and a
// member's bars / blackThunderCount snapshot are maintained by the ingest fan-out
// (see ingest.ts) AND seeded/reversed here on join/leave. On create or join we
// add the member's CURRENT user totals into the team; on leave we subtract that
// member's CONTRIBUTION (the member-doc snapshot, which the ingest fan-out keeps
// in lockstep with the user total for the period of membership).
//
// firebase-admin nested-write rule (mirrors ingest.ts):
//   - update() with DOTTED paths => nested field paths (use for increments on
//     existing docs).
//   - set(..., { merge: true }) => dotted keys are LITERAL field names; nested
//     objects deep-merge (use for create / first-write).
// ============================================================================

import { randomBytes } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/server/firebase-admin";
import {
  COLLECTIONS,
  isRealLogin,
  type TeamDoc,
  type TeamInviteDoc,
  type TeamMemberDoc,
  type UserDoc,
} from "@/lib/shared/schema";

/** Trusted caller identity (resolved from a verified Firebase ID token). */
export interface TeamActor {
  uid: string;
  githubId: number;
  /** Best-effort display fields; user doc is the authority when it exists. */
  login?: string;
  displayName?: string;
  avatarUrl?: string;
}

/** Typed error; `status` is the HTTP status the route should surface. */
export class TeamError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TeamError";
    this.status = status;
  }
}

const MAX_NAME_LEN = 60;
const MAX_DESC_LEN = 280;
const MAX_TEAMS_PER_USER = 50;
const SLUG_COLLISION_RETRIES = 6;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** lowercase, hyphenate, strip junk; safe fallback if it reduces to empty. */
function slugify(name: string): string {
  const base = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40);
  return base.length > 0 ? base : "team";
}

/** Short, lowercase, URL-safe random suffix used to break slug collisions. */
function shortSuffix(): string {
  return randomBytes(3).toString("hex"); // 6 hex chars
}

/** Short, human-shareable base32 invite code (Crockford-ish, no ambiguous chars). */
function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no I,L,O,U,0,1
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function cleanName(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new TeamError("name is required");
  }
  const name = raw.trim();
  if (name.length === 0) throw new TeamError("name is required");
  if (name.length > MAX_NAME_LEN) {
    throw new TeamError(`name must be <= ${MAX_NAME_LEN} characters`);
  }
  return name;
}

function cleanOptionalText(raw: unknown, max: number, field: string): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new TeamError(`${field} must be a string`);
  const text = raw.trim();
  if (text.length === 0) return null;
  if (text.length > max) {
    throw new TeamError(`${field} must be <= ${max} characters`);
  }
  return text;
}

function cleanLogin(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new TeamError("login is required");
  }
  const login = raw.trim();
  // GitHub login: alphanumeric + single hyphens, <= 39 chars. Be permissive but
  // bounded to avoid pathological doc ids.
  if (login.length > 39 || !/^[A-Za-z0-9-]+$/.test(login)) {
    throw new TeamError("login is not a valid GitHub login");
  }
  return login;
}

/** Build the member snapshot from a user doc + actor fallback. */
function memberSnapshotFields(
  actor: TeamActor,
  user: UserDoc | null,
): Pick<
  TeamMemberDoc,
  "login" | "loginLower" | "displayName" | "avatarUrl" | "bars" | "blackThunderCount"
> {
  // gh_<id> は login ではないので合成しない。本物の login を優先し、
  // 無ければ空（次回 ingest／プロフィール表示で UI が login に正しくフォールバックする）。
  const login = [user?.login, actor.login].find(isRealLogin) ?? "";
  return {
    login,
    loginLower: login.toLowerCase(),
    displayName: user?.displayName ?? actor.displayName ?? null,
    avatarUrl: user?.avatarUrl ?? actor.avatarUrl ?? "",
    bars: user?.totalBars ?? 0,
    blackThunderCount: user?.blackThunderCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Slug allocation (own transaction, before the create transaction). We probe a
// handful of candidate slugs and pick the first free one; the create transaction
// re-checks to close the race window.
// ---------------------------------------------------------------------------
async function allocateUniqueSlug(name: string): Promise<string> {
  const db = adminDb();
  const base = slugify(name);
  const candidates = [base];
  for (let i = 0; i < SLUG_COLLISION_RETRIES; i += 1) {
    candidates.push(`${base}-${shortSuffix()}`);
  }
  const teams = db.collection(COLLECTIONS.teams);
  for (const candidate of candidates) {
    const existing = await teams
      .where("slugLower", "==", candidate.toLowerCase())
      .limit(1)
      .get();
    if (existing.empty) return candidate;
  }
  // Astronomically unlikely; final fallback with extra entropy.
  return `${base}-${shortSuffix()}${shortSuffix()}`;
}

// ---------------------------------------------------------------------------
// createTeam
// ---------------------------------------------------------------------------
export async function createTeam(
  actor: TeamActor,
  input: { name: unknown; emoji?: unknown; description?: unknown },
): Promise<{ team: TeamDoc }> {
  const name = cleanName(input.name);
  const emoji = cleanOptionalText(input.emoji, 16, "emoji");
  const description = cleanOptionalText(input.description, MAX_DESC_LEN, "description");

  const slug = await allocateUniqueSlug(name);
  const slugLower = slug.toLowerCase();

  const db = adminDb();
  const teamRef = db.collection(COLLECTIONS.teams).doc();
  const teamId = teamRef.id;
  const userRef = db.collection(COLLECTIONS.users).doc(actor.uid);
  const memberRef = teamRef.collection(COLLECTIONS.members).doc(actor.uid);
  const nowMs = Date.now();

  const team = await db.runTransaction(async (tx) => {
    // --- READS ---
    const userSnap = await tx.get(userRef);
    const user = userSnap.exists ? (userSnap.data() as UserDoc) : null;

    // Re-check slug uniqueness inside the txn to close the allocate race.
    const slugClash = await tx.get(
      db
        .collection(COLLECTIONS.teams)
        .where("slugLower", "==", slugLower)
        .limit(1),
    );

    if (user) {
      const teamIds = Array.isArray(user.teamIds) ? user.teamIds : [];
      if (teamIds.length >= MAX_TEAMS_PER_USER) {
        throw new TeamError("You have joined the maximum number of teams", 409);
      }
    }

    // --- WRITES ---
    const finalSlug = slugClash.empty ? slug : `${slug}-${shortSuffix()}`;
    const member = memberSnapshotFields(actor, user);

    const teamDoc: TeamDoc = {
      id: teamId,
      name,
      slug: finalSlug,
      slugLower: finalSlug.toLowerCase(),
      description,
      emoji,
      ownerUid: actor.uid,
      inviteCode: makeInviteCode(),
      memberCount: 1,
      totalBars: member.bars,
      totalBlackThunderCount: member.blackThunderCount,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    tx.set(teamRef, teamDoc);

    const memberDoc: TeamMemberDoc = {
      uid: actor.uid,
      ...member,
      role: "owner",
      joinedAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    tx.set(memberRef, memberDoc);

    // Add the team to the user's teamIds. Create the user doc if absent so the
    // teamIds membership survives even before any ingest.
    if (userSnap.exists) {
      tx.update(userRef, {
        teamIds: FieldValue.arrayUnion(teamId),
        updatedAtMs: nowMs,
      });
    } else {
      tx.set(
        userRef,
        {
          uid: actor.uid,
          githubId: actor.githubId,
          login: member.login,
          loginLower: member.loginLower,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          zakuzakuScore: 0,
          totalBars: 0,
          scoreComponents: { bars: 0 },
          byProvider: {},
          totalEvents: 0,
          blackThunderCount: 0,
          eatBySource: {},
          lastAteAtMs: null,
          deviceCount: 0,
          teamIds: [teamId],
          lastEventAtMs: null,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        } satisfies UserDoc,
        { merge: true },
      );
    }

    return teamDoc;
  });

  return { team };
}

// ---------------------------------------------------------------------------
// joinTeamByCode
// ---------------------------------------------------------------------------
export async function joinTeamByCode(
  actor: TeamActor,
  code: unknown,
): Promise<{ team: TeamDoc }> {
  if (typeof code !== "string" || code.trim().length === 0) {
    throw new TeamError("code is required");
  }
  const inviteCode = code.trim().toUpperCase();

  const db = adminDb();
  // Resolve the team by invite code (outside the txn; re-read by ref inside).
  const found = await db
    .collection(COLLECTIONS.teams)
    .where("inviteCode", "==", inviteCode)
    .limit(1)
    .get();
  if (found.empty) {
    throw new TeamError("No team matches that invite code", 404);
  }
  const teamRef = found.docs[0].ref;
  return joinTeamByRef(actor, teamRef);
}

/**
 * Shared join routine (used by join-by-code and accept-invite). Adds the actor as
 * a member and folds their current totals into the team aggregate.
 */
async function joinTeamByRef(
  actor: TeamActor,
  teamRef: FirebaseFirestore.DocumentReference,
  inviteRefToConsume?: FirebaseFirestore.DocumentReference,
): Promise<{ team: TeamDoc }> {
  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(actor.uid);
  const memberRef = teamRef.collection(COLLECTIONS.members).doc(actor.uid);
  const nowMs = Date.now();

  const team = await db.runTransaction(async (tx) => {
    // --- READS ---
    const teamSnap = await tx.get(teamRef);
    if (!teamSnap.exists) {
      throw new TeamError("Team not found", 404);
    }
    const teamData = teamSnap.data() as TeamDoc;

    const memberSnap = await tx.get(memberRef);
    const userSnap = await tx.get(userRef);
    const user = userSnap.exists ? (userSnap.data() as UserDoc) : null;
    if (inviteRefToConsume) {
      // Read it so we can mark it accepted in the write phase.
      await tx.get(inviteRefToConsume);
    }

    if (memberSnap.exists) {
      // Idempotent join: already a member. Consume any pending invite and return.
      if (inviteRefToConsume) {
        tx.set(
          inviteRefToConsume,
          { status: "accepted" },
          { merge: true },
        );
      }
      return teamData;
    }

    if (user) {
      const teamIds = Array.isArray(user.teamIds) ? user.teamIds : [];
      if (teamIds.length >= MAX_TEAMS_PER_USER) {
        throw new TeamError("You have joined the maximum number of teams", 409);
      }
    }

    // --- WRITES ---
    const member = memberSnapshotFields(actor, user);

    const memberDoc: TeamMemberDoc = {
      uid: actor.uid,
      ...member,
      role: "member",
      joinedAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    tx.set(memberRef, memberDoc);

    tx.update(teamRef, {
      memberCount: FieldValue.increment(1),
      totalBars: FieldValue.increment(member.bars),
      totalBlackThunderCount: FieldValue.increment(member.blackThunderCount),
      updatedAtMs: nowMs,
    });

    if (userSnap.exists) {
      tx.update(userRef, {
        teamIds: FieldValue.arrayUnion(teamRef.id),
        updatedAtMs: nowMs,
      });
    } else {
      tx.set(
        userRef,
        {
          uid: actor.uid,
          githubId: actor.githubId,
          login: member.login,
          loginLower: member.loginLower,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          zakuzakuScore: 0,
          totalBars: 0,
          scoreComponents: { bars: 0 },
          byProvider: {},
          totalEvents: 0,
          blackThunderCount: 0,
          eatBySource: {},
          lastAteAtMs: null,
          deviceCount: 0,
          teamIds: [teamRef.id],
          lastEventAtMs: null,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        } satisfies UserDoc,
        { merge: true },
      );
    }

    if (inviteRefToConsume) {
      tx.set(inviteRefToConsume, { status: "accepted" }, { merge: true });
    }

    // Return the projected team (totals reflect the just-applied delta).
    return {
      ...teamData,
      memberCount: teamData.memberCount + 1,
      totalBars: teamData.totalBars + member.bars,
      totalBlackThunderCount:
        teamData.totalBlackThunderCount + member.blackThunderCount,
      updatedAtMs: nowMs,
    } satisfies TeamDoc;
  });

  return { team };
}

// ---------------------------------------------------------------------------
// inviteToTeam — a member invites a GitHub login (by creating a pending invite).
// ---------------------------------------------------------------------------
export async function inviteToTeam(
  actor: TeamActor,
  teamId: string,
  login: unknown,
): Promise<{ ok: true }> {
  if (typeof teamId !== "string" || teamId.trim().length === 0) {
    throw new TeamError("teamId is required");
  }
  const invitedLogin = cleanLogin(login);
  const invitedLoginLower = invitedLogin.toLowerCase();

  const db = adminDb();
  const teamRef = db.collection(COLLECTIONS.teams).doc(teamId);
  const actorMemberRef = teamRef.collection(COLLECTIONS.members).doc(actor.uid);
  const inviteRef = teamRef
    .collection(COLLECTIONS.invites)
    .doc(invitedLoginLower);
  const nowMs = Date.now();

  await db.runTransaction(async (tx) => {
    const teamSnap = await tx.get(teamRef);
    if (!teamSnap.exists) throw new TeamError("Team not found", 404);
    const team = teamSnap.data() as TeamDoc;

    const actorMemberSnap = await tx.get(actorMemberRef);
    if (!actorMemberSnap.exists) {
      throw new TeamError("Only team members can invite", 403);
    }
    const actorMember = actorMemberSnap.data() as TeamMemberDoc;

    if (actorMember.loginLower === invitedLoginLower) {
      throw new TeamError("You are already a member of this team", 409);
    }

    const invite: TeamInviteDoc = {
      teamId,
      teamName: team.name,
      invitedLogin,
      invitedLoginLower,
      invitedByUid: actor.uid,
      invitedByLogin: actorMember.login,
      status: "pending",
      createdAtMs: nowMs,
    };
    // Upsert: re-inviting refreshes the pending invite.
    tx.set(inviteRef, invite);
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// acceptInvite — the caller accepts a pending invite addressed to their login.
// ---------------------------------------------------------------------------
export async function acceptInvite(
  actor: TeamActor,
  teamId: string,
): Promise<{ team: TeamDoc }> {
  if (typeof teamId !== "string" || teamId.trim().length === 0) {
    throw new TeamError("teamId is required");
  }
  const db = adminDb();
  const teamRef = db.collection(COLLECTIONS.teams).doc(teamId);

  // Resolve the caller's current login to find the invite doc id. Prefer the
  // user doc; fall back to the actor token login.
  const userSnap = await db.collection(COLLECTIONS.users).doc(actor.uid).get();
  const user = userSnap.exists ? (userSnap.data() as UserDoc) : null;
  const login = user?.login ?? actor.login;
  if (!login) {
    throw new TeamError("Could not resolve your GitHub login", 400);
  }
  const inviteRef = teamRef
    .collection(COLLECTIONS.invites)
    .doc(login.toLowerCase());

  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new TeamError("No pending invite for you on this team", 404);
  }
  const invite = inviteSnap.data() as TeamInviteDoc;
  if (invite.status !== "pending") {
    throw new TeamError("This invite is no longer pending", 409);
  }

  // Join + consume the invite atomically (joinTeamByRef marks it accepted).
  return joinTeamByRef(actor, teamRef, inviteRef);
}

// ---------------------------------------------------------------------------
// leaveTeam — caller leaves; team totals reverse the member's contribution.
//
// Owner policy: an owner who is NOT alone must transfer ownership to the
// earliest-joined remaining member (promoted to owner). An owner who is the LAST
// member is blocked from leaving (they must delete the team — not exposed here)
// to avoid orphaning team docs. This is the documented choice.
// ---------------------------------------------------------------------------
export async function leaveTeam(
  actor: TeamActor,
  teamId: string,
): Promise<{ ok: true }> {
  if (typeof teamId !== "string" || teamId.trim().length === 0) {
    throw new TeamError("teamId is required");
  }
  const db = adminDb();
  const teamRef = db.collection(COLLECTIONS.teams).doc(teamId);
  const memberRef = teamRef.collection(COLLECTIONS.members).doc(actor.uid);
  const userRef = db.collection(COLLECTIONS.users).doc(actor.uid);
  const membersCol = teamRef.collection(COLLECTIONS.members);
  const nowMs = Date.now();

  await db.runTransaction(async (tx) => {
    // --- READS ---
    const teamSnap = await tx.get(teamRef);
    if (!teamSnap.exists) throw new TeamError("Team not found", 404);
    const team = teamSnap.data() as TeamDoc;

    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) {
      throw new TeamError("You are not a member of this team", 404);
    }
    const member = memberSnap.data() as TeamMemberDoc;

    const isOwner = team.ownerUid === actor.uid;
    // Only need the full member list to pick a successor when an owner leaves a
    // non-empty team. Read it within the read phase.
    let successorRef: FirebaseFirestore.DocumentReference | null = null;
    if (isOwner && team.memberCount > 1) {
      const others = await tx.get(
        membersCol.orderBy("joinedAtMs", "asc").limit(10),
      );
      const successor = others.docs.find((d) => d.id !== actor.uid);
      if (!successor) {
        // memberCount said >1 but we found none else — treat as alone owner.
        throw new TeamError(
          "An owner who is the only member cannot leave; delete the team instead",
          409,
        );
      }
      successorRef = successor.ref;
    } else if (isOwner && team.memberCount <= 1) {
      throw new TeamError(
        "An owner who is the only member cannot leave; delete the team instead",
        409,
      );
    }

    // --- WRITES ---
    tx.delete(memberRef);

    tx.update(teamRef, {
      memberCount: FieldValue.increment(-1),
      totalBars: FieldValue.increment(-member.bars),
      totalBlackThunderCount: FieldValue.increment(-member.blackThunderCount),
      ...(successorRef ? { ownerUid: successorRef.id } : {}),
      updatedAtMs: nowMs,
    });

    if (successorRef) {
      tx.update(successorRef, { role: "owner", updatedAtMs: nowMs });
    }

    // arrayRemove is a no-op if the id is absent; safe to issue unconditionally.
    tx.set(
      userRef,
      {
        teamIds: FieldValue.arrayRemove(teamId),
        updatedAtMs: nowMs,
      },
      { merge: true },
    );
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// listMyInvites — pending invites addressed to the caller's login, across teams.
// ---------------------------------------------------------------------------
export async function listMyInvites(
  actor: TeamActor,
): Promise<{ invites: TeamInviteDoc[] }> {
  const db = adminDb();
  const userSnap = await db.collection(COLLECTIONS.users).doc(actor.uid).get();
  const user = userSnap.exists ? (userSnap.data() as UserDoc) : null;
  const login = user?.login ?? actor.login;
  if (!login) {
    return { invites: [] };
  }
  const loginLower = login.toLowerCase();

  // Collection-group query across every team's invites for this login.
  const snap = await db
    .collectionGroup(COLLECTIONS.invites)
    .where("invitedLoginLower", "==", loginLower)
    .where("status", "==", "pending")
    .get();

  const invites = snap.docs
    .map((d) => d.data() as TeamInviteDoc)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  return { invites };
}
