// ============================================================================
// AUTHORITATIVE SHARED SCHEMA — the single source of truth for the AIザクザク度
// leaderboard. Imported by the browser client SDK, the firebase-admin ingestion
// route, the seed script, and (conceptually) every client app.
//
// RUNTIME-AGNOSTIC: this file must NOT value-import `firebase/firestore` or
// `firebase-admin` so both runtimes can share it. Timestamps cross the boundary
// as epoch-milliseconds (converters map Firestore Timestamp <-> number).
// ============================================================================

// ---------------------------------------------------------------------------
// UID SCHEME (the #1 reconciliation decision)
// ---------------------------------------------------------------------------
// The Firestore document key is ALWAYS the GitHub NUMERIC id, never the Firebase
// Auth uid. This is what makes the web login and the CLI/extension clients
// converge on the SAME document:
//   - Server / CLI path: verify GitHub token -> GET /user -> .id (number)
//   - Web path: signInWithPopup -> getAdditionalUserInfo(cred).profile.id
//     (coerce string -> number)
// The Firebase Auth uid is only ever a session identity, never a doc key.
export function uidForGithubId(githubId: number | string): string {
  return `gh_${Number(githubId)}`;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------
export const COLLECTIONS = {
  users: "users",
  events: "events", // users/{uid}/events/{eventId}  (private dedupe ledger)
  daily: "daily", //  users/{uid}/daily/{yyyymmdd}   (public activity feed)
  devices: "devices", // users/{uid}/devices/{deviceId} (public per-device meter)
  teams: "teams", //   teams/{teamId}                 (public team aggregate)
  members: "members", // teams/{teamId}/members/{uid} (public membership)
  invites: "invites", // teams/{teamId}/invites/{loginLower} (private; via API)
  apiTokens: "apiTokens", // apiTokens/{sha256(token)}  (private; website-brokered client auth)
} as const;

// ---------------------------------------------------------------------------
// Providers (AIザクザク度 sources) and eat sources (ブラックサンダーカウント sources)
// Both are extensible: add keys, never new collections.
// ---------------------------------------------------------------------------
export type Provider = "Claude" | "Codex";
export const PROVIDERS: Provider[] = ["Claude", "Codex"];

/** Where a "ブラックサンダーを食べた" declaration came from. */
export type EatSource = "chrome" | "vscode" | "jetbrains" | "zsh" | "web";
export const EAT_SOURCES: EatSource[] = ["chrome", "vscode", "jetbrains", "zsh", "web"];

export interface ProviderStat {
  bars: number; // cumulative bars from this provider
  events: number; // distinct ingested bar-events from this provider
  lastEventAtMs: number | null;
}

/**
 * Extensible inputs to the AIザクザク度 formula. v1: only `bars` is populated and
 * zakuzakuScore === bars. A future composite adds keys here and weights them in
 * computeZakuzakuScore() — additive, not a rewrite.
 */
export interface ScoreComponents {
  bars: number; // == totalBars
  commits?: number; // reserved (future GitHub integration)
  prMerges?: number; // reserved (future)
}

/** users/{uid} — one per GitHub identity (uid = gh_<githubId>). */
export interface UserDoc {
  uid: string; // mirror of doc id = gh_<githubId>
  githubId: number; // STABLE join key (immutable across login renames)
  login: string; // current GitHub login (display; mutable)
  loginLower: string; // lowercased mirror for case-insensitive /u/[login] lookup
  displayName: string | null;
  avatarUrl: string;

  // --- AIザクザク度 (AI zakuzaku-do): cumulative Black Thunder "bars" via AI usage
  zakuzakuScore: number; // the SINGLE stored, indexed ranking field; == totalBars in v1
  totalBars: number; // cumulative bars across all providers
  scoreComponents: ScoreComponents;
  byProvider: Partial<Record<Provider, ProviderStat>>;
  totalEvents: number;

  // --- ブラックサンダーカウント (Black Thunder count): times the user declared eating one
  blackThunderCount: number;
  eatBySource: Partial<Record<EatSource, number>>;
  lastAteAtMs: number | null;

  // --- Devices & teams
  deviceCount: number; // distinct RunThunder devices contributing bars
  teamIds: string[]; // teams the user belongs to (ingest fans deltas out to these)

  lastEventAtMs: number | null;
  createdAtMs: number;
  updatedAtMs: number;
}

/**
 * users/{uid}/events/{eventId} — idempotency / dedupe ledger (PRIVATE, never
 * read by clients). Doc existence == "already counted". eventId namespacing:
 *   bars/Codex:  `Codex:<sha256>`     (reuse collector col-3 hash; first-write-wins)
 *   bars/Claude: `Claude:<sessionKey>` (one doc per session; stores last cumulative)
 *   eat:         `<source>:<clientEventId>` (client-generated unique id)
 */
export type EventKind = "bars" | "eat";
export interface EventDoc {
  kind: EventKind;
  provider?: Provider; // bars only
  source?: EatSource; // eat only
  bars: number; // bars applied for THIS event (delta); 0 for eat
  count: number; // eats applied for THIS event; 0 for bars, usually 1 for eat
  cumulativeBars?: number; // Claude only: last cumulative snapshot applied
  sourceTimestampMs: number;
  ingestedAtMs: number;
}

/**
 * users/{uid}/daily/{yyyymmdd} — public daily rollup powering the profile feed.
 * `day` is zero-padded UTC yyyymmdd, so lexicographic order == chronological.
 */
export interface DailyDoc {
  day: string;
  bars: number;
  events: number;
  eats: number;
  byProvider: Partial<Record<Provider, number>>;
  updatedAtMs: number;
}

/** users/{uid}/devices/{deviceId} — one per machine running RunThunder. */
export interface DeviceDoc {
  deviceId: string;
  name: string; // host / friendly name
  platform: string; // e.g. "macOS"
  bars: number; // cumulative bars contributed by this device
  lastSeenAtMs: number;
  createdAtMs: number;
}

// ---------------------------------------------------------------------------
// Teams — the social unit. Totals are kept live by denormalized increments:
// the ingest transaction fans a member's bar/eat deltas out to every team in
// the user's teamIds (team doc + the member doc). All mutations go through
// admin-only API routes; clients only ever READ teams/members.
// ---------------------------------------------------------------------------
export type TeamRole = "owner" | "member";

export interface TeamMemberDoc {
  uid: string;
  login: string;
  loginLower: string;
  displayName: string | null;
  avatarUrl: string;
  role: TeamRole;
  bars: number; // this member's contribution to the team total
  blackThunderCount: number;
  joinedAtMs: number;
  updatedAtMs: number;
}

/** teams/{teamId} — public team aggregate. */
export interface TeamDoc {
  id: string;
  name: string;
  slug: string;
  slugLower: string;
  description: string | null;
  emoji: string | null; // playful team avatar
  ownerUid: string;
  inviteCode: string; // shareable join code
  memberCount: number;
  totalBars: number; // team AIザクザク度
  totalBlackThunderCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

/** teams/{teamId}/invites/{loginLower} — pending invite (private; served via API). */
export type InviteStatus = "pending" | "accepted" | "declined";
export interface TeamInviteDoc {
  teamId: string;
  teamName: string;
  invitedLogin: string;
  invitedLoginLower: string;
  invitedByUid: string;
  invitedByLogin: string;
  status: InviteStatus;
  createdAtMs: number;
}

// ---------------------------------------------------------------------------
// Website-brokered client auth. Clients (RunThunder/Chrome/…) never implement
// full GitHub OAuth: they open /connect, the site authenticates via GitHub and
// mints an opaque token, stored here HASHED (doc id = sha256(token)). /api/ingest
// verifies the token by hashing the bearer and looking up this doc — no GitHub
// round-trip, fully revocable.
// ---------------------------------------------------------------------------
export type ClientApp =
  | "runthunder"
  | "chrome"
  | "vscode"
  | "jetbrains"
  | "zsh"
  | "other";

export interface ApiTokenDoc {
  tokenHash: string; // sha256(token); doc id == this
  uid: string; // gh_<githubId>
  githubId: number;
  login: string;
  app: ClientApp;
  label: string | null;
  createdAtMs: number;
  lastUsedAtMs: number | null;
  revoked: boolean;
}

// ---------------------------------------------------------------------------
// Ingestion API wire types (shared by /api/ingest and every client)
// ---------------------------------------------------------------------------
export interface IngestBarEvent {
  kind: "bars";
  provider: Provider;
  eventId: string; // dedupe key (e.g. "bars:<deviceId>:<yyyymmdd>" for RunThunder daily meters)
  tsMs: number; // source event time (epoch ms)
  bars: number; // cumulative bars for this bucket (RunThunder: that device+day's total)
  cumulativeBars?: number; // explicit cumulative snapshot; presence => cumulative-delta semantics
  deviceId?: string; // RunThunder device id (multi-device aggregation lives per-device)
  deviceName?: string; // human-friendly device label (e.g. host name)
}

export interface IngestEatEvent {
  kind: "eat";
  source: EatSource;
  eventId: string; // client-generated unique id for idempotency
  tsMs: number;
  count?: number; // default 1
}

export type IngestEvent = IngestBarEvent | IngestEatEvent;

export interface IngestRequest {
  client: string; // e.g. "ai-blackthunder-zsh", "blackthunder-chrome"
  events: IngestEvent[];
}

export interface IngestResponse {
  ok: boolean;
  uid: string;
  login: string;
  applied: number;
  duplicates: number;
  totalBars: number;
  zakuzakuScore: number;
  blackThunderCount: number;
}

// Safety caps (enforced server-side; clients should chunk to stay under them).
export const MAX_EVENTS_PER_REQUEST = 500;
export const MAX_BARS_PER_EVENT = 1000; // sanity ceiling against spoofed bars
export const MAX_EATS_PER_EVENT = 10;

// ---------------------------------------------------------------------------
// Display formatting — mirrors the canonical rule in the ai-blackthunder plugin
// (oh-my-blackthunder/plugins/ai-blackthunder/omb-codex-session-collector.js
//  -> formatBars()). Keep in sync; unit is "本".
// ---------------------------------------------------------------------------
export function formatBars(value: number): string {
  if (value > 0 && value < 0.05) return "0.1";
  if (value >= 10) return String(Math.round(value));
  return value.toFixed(1);
}
