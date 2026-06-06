"use client";

// ---------------------------------------------------------------------------
// Typed Firestore read layer (browser, READ-ONLY).
//
// `withConverter` maps Firestore Timestamp <-> epoch-ms so the rest of the app
// only ever handles the plain UserDoc / DailyDoc shapes from the shared schema.
// All real-time subscriptions return an unsubscribe function.
// ---------------------------------------------------------------------------

import {
  Timestamp,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/client/firebase";
import {
  COLLECTIONS,
  type DailyDoc,
  type DeviceDoc,
  type TeamDoc,
  type TeamMemberDoc,
  type UserDoc,
} from "@/lib/shared/schema";

// --- Timestamp <-> ms helpers ----------------------------------------------
function tsToMs(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return null;
}

function tsToMsRequired(value: unknown, fallback = 0): number {
  return tsToMs(value) ?? fallback;
}

// --- UserDoc converter ------------------------------------------------------
export const userConverter: FirestoreDataConverter<UserDoc> = {
  toFirestore(user: UserDoc): DocumentData {
    // Clients never write; provided only to satisfy the converter contract.
    return { ...user };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options: SnapshotOptions,
  ): UserDoc {
    const d = snapshot.data(options);
    return {
      uid: (d.uid as string) ?? snapshot.id,
      githubId: Number(d.githubId ?? 0),
      login: (d.login as string) ?? "",
      loginLower: (d.loginLower as string) ?? "",
      displayName: (d.displayName as string | null) ?? null,
      avatarUrl: (d.avatarUrl as string) ?? "",
      zakuzakuScore: Number(d.zakuzakuScore ?? 0),
      totalBars: Number(d.totalBars ?? 0),
      scoreComponents: {
        bars: Number(d.scoreComponents?.bars ?? 0),
        commits: d.scoreComponents?.commits,
        prMerges: d.scoreComponents?.prMerges,
      },
      byProvider: (d.byProvider as UserDoc["byProvider"]) ?? {},
      totalEvents: Number(d.totalEvents ?? 0),
      blackThunderCount: Number(d.blackThunderCount ?? 0),
      eatBySource: (d.eatBySource as UserDoc["eatBySource"]) ?? {},
      lastAteAtMs: tsToMs(d.lastAteAtMs),
      deviceCount: Number(d.deviceCount ?? 0),
      teamIds: Array.isArray(d.teamIds) ? (d.teamIds as string[]) : [],
      lastEventAtMs: tsToMs(d.lastEventAtMs),
      createdAtMs: tsToMsRequired(d.createdAtMs),
      updatedAtMs: tsToMsRequired(d.updatedAtMs),
    };
  },
};

// --- DailyDoc converter -----------------------------------------------------
export const dailyConverter: FirestoreDataConverter<DailyDoc> = {
  toFirestore(daily: DailyDoc): DocumentData {
    return { ...daily };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options: SnapshotOptions,
  ): DailyDoc {
    const d = snapshot.data(options);
    return {
      day: (d.day as string) ?? snapshot.id,
      bars: Number(d.bars ?? 0),
      events: Number(d.events ?? 0),
      eats: Number(d.eats ?? 0),
      byProvider: (d.byProvider as DailyDoc["byProvider"]) ?? {},
      updatedAtMs: tsToMsRequired(d.updatedAtMs),
    };
  },
};

// --- TeamDoc converter ------------------------------------------------------
export const teamConverter: FirestoreDataConverter<TeamDoc> = {
  toFirestore(team: TeamDoc): DocumentData {
    return { ...team };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options: SnapshotOptions,
  ): TeamDoc {
    const d = snapshot.data(options);
    return {
      id: (d.id as string) ?? snapshot.id,
      name: (d.name as string) ?? "",
      slug: (d.slug as string) ?? "",
      slugLower: (d.slugLower as string) ?? "",
      description: (d.description as string | null) ?? null,
      emoji: (d.emoji as string | null) ?? null,
      ownerUid: (d.ownerUid as string) ?? "",
      inviteCode: (d.inviteCode as string) ?? "",
      memberCount: Number(d.memberCount ?? 0),
      totalBars: Number(d.totalBars ?? 0),
      totalBlackThunderCount: Number(d.totalBlackThunderCount ?? 0),
      createdAtMs: tsToMsRequired(d.createdAtMs),
      updatedAtMs: tsToMsRequired(d.updatedAtMs),
    };
  },
};

// --- TeamMemberDoc converter ------------------------------------------------
export const teamMemberConverter: FirestoreDataConverter<TeamMemberDoc> = {
  toFirestore(member: TeamMemberDoc): DocumentData {
    return { ...member };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options: SnapshotOptions,
  ): TeamMemberDoc {
    const d = snapshot.data(options);
    return {
      uid: (d.uid as string) ?? snapshot.id,
      login: (d.login as string) ?? "",
      loginLower: (d.loginLower as string) ?? "",
      displayName: (d.displayName as string | null) ?? null,
      avatarUrl: (d.avatarUrl as string) ?? "",
      role: (d.role as TeamMemberDoc["role"]) ?? "member",
      bars: Number(d.bars ?? 0),
      blackThunderCount: Number(d.blackThunderCount ?? 0),
      joinedAtMs: tsToMsRequired(d.joinedAtMs),
      updatedAtMs: tsToMsRequired(d.updatedAtMs),
    };
  },
};

// --- DeviceDoc converter ----------------------------------------------------
export const deviceConverter: FirestoreDataConverter<DeviceDoc> = {
  toFirestore(device: DeviceDoc): DocumentData {
    return { ...device };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<DocumentData>,
    options: SnapshotOptions,
  ): DeviceDoc {
    const d = snapshot.data(options);
    return {
      deviceId: (d.deviceId as string) ?? snapshot.id,
      name: (d.name as string) ?? "",
      platform: (d.platform as string) ?? "",
      bars: Number(d.bars ?? 0),
      lastSeenAtMs: tsToMsRequired(d.lastSeenAtMs),
      createdAtMs: tsToMsRequired(d.createdAtMs),
    };
  },
};

// --- Collection refs --------------------------------------------------------
function usersCol() {
  return collection(db, COLLECTIONS.users).withConverter(userConverter);
}

function dailyCol(uid: string) {
  return collection(db, COLLECTIONS.users, uid, COLLECTIONS.daily).withConverter(
    dailyConverter,
  );
}

function devicesCol(uid: string) {
  return collection(
    db,
    COLLECTIONS.users,
    uid,
    COLLECTIONS.devices,
  ).withConverter(deviceConverter);
}

function teamsCol() {
  return collection(db, COLLECTIONS.teams).withConverter(teamConverter);
}

function membersCol(teamId: string) {
  return collection(
    db,
    COLLECTIONS.teams,
    teamId,
    COLLECTIONS.members,
  ).withConverter(teamMemberConverter);
}

// --- Subscriptions ----------------------------------------------------------

/** Top-N leaderboard, ordered by the single indexed ranking field. */
export function subscribeLeaderboard(
  topN: number,
  cb: (users: UserDoc[]) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const q = query(usersCol(), orderBy("zakuzakuScore", "desc"), limit(topN));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => err?.(e),
  );
}

/** Resolve a profile by case-insensitive GitHub login. */
export function subscribeProfileByLogin(
  loginLower: string,
  cb: (user: UserDoc | null) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const q = query(usersCol(), where("loginLower", "==", loginLower), limit(1));
  return onSnapshot(
    q,
    (snap) => cb(snap.empty ? null : snap.docs[0].data()),
    (e) => err?.(e),
  );
}

/** Resolve a profile directly by its doc id (uid = gh_<githubId>). */
export function subscribeProfileByUid(
  uid: string,
  cb: (user: UserDoc | null) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const ref = doc(db, COLLECTIONS.users, uid).withConverter(userConverter);
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? snap.data() : null),
    (e) => err?.(e),
  );
}

/** Recent daily activity rollups (newest first). */
export function subscribeActivity(
  uid: string,
  days: number,
  cb: (daily: DailyDoc[]) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const q = query(dailyCol(uid), orderBy("day", "desc"), limit(days));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => err?.(e),
  );
}

/** The user's RunThunder devices, biggest contributor first. */
export function subscribeDevices(
  uid: string,
  cb: (devices: DeviceDoc[]) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const q = query(devicesCol(uid), orderBy("bars", "desc"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => err?.(e),
  );
}

/** Top-N team leaderboard, ordered by the team AIザクザク度 (totalBars). */
export function subscribeTeamLeaderboard(
  topN: number,
  cb: (teams: TeamDoc[]) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const q = query(teamsCol(), orderBy("totalBars", "desc"), limit(topN));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => err?.(e),
  );
}

/** Resolve a team by its case-insensitive slug. */
export function subscribeTeamBySlug(
  slugLower: string,
  cb: (team: TeamDoc | null) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const q = query(teamsCol(), where("slugLower", "==", slugLower), limit(1));
  return onSnapshot(
    q,
    (snap) => cb(snap.empty ? null : snap.docs[0].data()),
    (e) => err?.(e),
  );
}

/** Live member roster for a team, biggest contributor first. */
export function subscribeTeamMembers(
  teamId: string,
  cb: (members: TeamMemberDoc[]) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const q = query(membersCol(teamId), orderBy("bars", "desc"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    (e) => err?.(e),
  );
}

/**
 * The teams the signed-in user belongs to, resolved from their teamIds.
 * Firestore caps `in` filters at 30 ids; teamIds is always far below that.
 * Empty input short-circuits to an empty result (no query, immediate callback).
 */
export function subscribeMyTeams(
  teamIds: string[],
  cb: (teams: TeamDoc[]) => void,
  err?: (e: Error) => void,
): Unsubscribe {
  const ids = teamIds.slice(0, 30);
  if (ids.length === 0) {
    cb([]);
    return () => {};
  }
  const q = query(teamsCol(), where("id", "in", ids));
  return onSnapshot(
    q,
    (snap) => {
      const byId = new Map(snap.docs.map((d) => [d.data().id, d.data()]));
      // Preserve the user's teamIds order for a stable UI.
      cb(ids.map((id) => byId.get(id)).filter((t): t is TeamDoc => t != null));
    },
    (e) => err?.(e),
  );
}
