// ============================================================================
// web/scripts/seed-emulator.ts — populate the LOCAL Firebase emulator with
// realistic AIザクザク度 + ブラックサンダーカウント data so the leaderboard,
// profile, and team pages render before any real ingestion happens.
//
// Run with:  pnpm run seed   (after `pnpm run emulators` is up in another tab)
//
// SAFETY: this script HARD-REFUSES to run unless FIRESTORE_EMULATOR_HOST is set,
// so it can never touch a real Firestore database. firebase-admin auto-detects
// FIRESTORE_EMULATOR_HOST and talks to the emulator with no credentials.
// ============================================================================

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import {
  COLLECTIONS,
  formatBars,
  uidForGithubId,
  type DailyDoc,
  type DeviceDoc,
  type EatSource,
  type Provider,
  type ProviderStat,
  type TeamDoc,
  type TeamMemberDoc,
  type TeamRole,
  type UserDoc,
} from "@/lib/shared/schema";
import { computeZakuzakuScore } from "@/lib/shared/score";

// ---------------------------------------------------------------------------
// Guard: refuse to run against anything but the emulator.
// ---------------------------------------------------------------------------
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulatorHost) {
  console.error(
    [
      "✗ Refusing to seed: FIRESTORE_EMULATOR_HOST is not set.",
      "",
      "  This script only ever writes to the LOCAL Firebase emulator so it can",
      "  never clobber a real database. Start the emulators first, then seed:",
      "",
      "    Terminal 1:  pnpm run emulators",
      "    Terminal 2:  pnpm run seed",
      "",
      "  (`pnpm run emulators` exports FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.)",
    ].join("\n"),
  );
  process.exit(1);
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "blackathon";

// firebase-admin reads FIRESTORE_EMULATOR_HOST automatically; against the
// emulator credentials are not validated, but applicationDefault() keeps the
// init shape identical to the production server path.
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// ---------------------------------------------------------------------------
// Time helpers (everything crosses the boundary as epoch-milliseconds).
// ---------------------------------------------------------------------------
const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const minutesAgo = (m: number) => NOW - m * 60 * 1000;
const daysAgo = (d: number) => NOW - d * DAY_MS;

/** UTC yyyymmdd (zero-padded so lexicographic order == chronological). */
function utcDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

// ---------------------------------------------------------------------------
// Sample seed shape. Keep this list small and varied so the leaderboard shows
// a clear ranking, mixed provider splits, and a spread of eat-counts.
//
// `devices` makes the per-device daily meter visible (UserDoc.deviceCount mirrors
// devices.length). The device bars sum to the user's Claude bars, since the
// AIザクザク度 meter is RunThunder-only and pushed per device. Codex bars come from
// the ai-blackthunder zsh/editor collectors and are NOT attributed to a device.
// ---------------------------------------------------------------------------
interface ProviderSeed {
  bars: number;
  events: number;
  lastEventMinutesAgo: number;
}

interface DeviceSeed {
  deviceId: string;
  name: string;
  platform: string;
  bars: number; // cumulative bars this RunThunder device has contributed
  lastSeenMinutesAgo: number;
  createdDaysAgo: number;
}

interface SeedUser {
  githubId: number;
  login: string;
  displayName: string | null;
  byProvider: Partial<Record<Provider, ProviderSeed>>;
  eatBySource: Partial<Record<EatSource, number>>;
  /** RunThunder devices contributing the user's AIザクザク度 (Claude bars). */
  devices: DeviceSeed[];
  /** How many recent days of `daily` rollups to fabricate (0 == none). */
  dailyDays: number;
  createdDaysAgo: number;
}

const SEED_USERS: SeedUser[] = [
  {
    githubId: 1305,
    login: "zakuzaku-taro",
    displayName: "ザクザク太郎",
    byProvider: {
      Claude: { bars: 184.4, events: 96, lastEventMinutesAgo: 7 },
      Codex: { bars: 92.6, events: 51, lastEventMinutesAgo: 41 },
    },
    eatBySource: { chrome: 38, web: 9, vscode: 5 },
    devices: [
      {
        deviceId: "dev-taro-mbp",
        name: "taro-MacBook-Pro",
        platform: "macOS",
        bars: 121.2,
        lastSeenMinutesAgo: 7,
        createdDaysAgo: 28,
      },
      {
        deviceId: "dev-taro-mini",
        name: "taro-mac-mini",
        platform: "macOS",
        bars: 63.2,
        lastSeenMinutesAgo: 190,
        createdDaysAgo: 21,
      },
    ],
    dailyDays: 5,
    createdDaysAgo: 28,
  },
  {
    githubId: 24680,
    login: "crunch-hime",
    displayName: "クランチ姫",
    byProvider: {
      Claude: { bars: 142.1, events: 74, lastEventMinutesAgo: 19 },
      Codex: { bars: 61.3, events: 33, lastEventMinutesAgo: 130 },
    },
    eatBySource: { chrome: 21, jetbrains: 14, web: 4 },
    devices: [
      {
        deviceId: "dev-hime-air",
        name: "hime-MacBook-Air",
        platform: "macOS",
        bars: 142.1,
        lastSeenMinutesAgo: 19,
        createdDaysAgo: 22,
      },
    ],
    dailyDays: 4,
    createdDaysAgo: 22,
  },
  {
    githubId: 31415,
    login: "bolt-sasaki",
    displayName: "Sasaki Bolt",
    byProvider: {
      Codex: { bars: 158.0, events: 88, lastEventMinutesAgo: 3 },
      Claude: { bars: 22.5, events: 12, lastEventMinutesAgo: 220 },
    },
    eatBySource: { zsh: 17, vscode: 11 },
    devices: [
      {
        deviceId: "dev-bolt-thinkpad",
        name: "bolt-thinkpad",
        platform: "Linux",
        bars: 22.5,
        lastSeenMinutesAgo: 220,
        createdDaysAgo: 19,
      },
    ],
    dailyDays: 5,
    createdDaysAgo: 19,
  },
  {
    githubId: 88888,
    login: "thunder-neko",
    displayName: "サンダー猫",
    byProvider: {
      Claude: { bars: 73.9, events: 40, lastEventMinutesAgo: 55 },
      Codex: { bars: 64.4, events: 35, lastEventMinutesAgo: 88 },
    },
    eatBySource: { chrome: 12, web: 12, jetbrains: 6, zsh: 3 },
    devices: [
      {
        deviceId: "dev-neko-mbp",
        name: "neko-MacBook-Pro",
        platform: "macOS",
        bars: 48.5,
        lastSeenMinutesAgo: 55,
        createdDaysAgo: 16,
      },
      {
        deviceId: "dev-neko-win",
        name: "NEKO-DESKTOP",
        platform: "Windows",
        bars: 25.4,
        lastSeenMinutesAgo: 410,
        createdDaysAgo: 11,
      },
    ],
    dailyDays: 3,
    createdDaysAgo: 16,
  },
  {
    githubId: 42042,
    login: "choco-dev",
    displayName: null,
    byProvider: {
      Claude: { bars: 51.2, events: 27, lastEventMinutesAgo: 240 },
    },
    eatBySource: { vscode: 9, web: 2 },
    devices: [
      {
        deviceId: "dev-choco-mbp",
        name: "choco-MacBook-Pro",
        platform: "macOS",
        bars: 51.2,
        lastSeenMinutesAgo: 240,
        createdDaysAgo: 13,
      },
    ],
    dailyDays: 2,
    createdDaysAgo: 13,
  },
  {
    githubId: 70707,
    login: "fullsnack-kun",
    displayName: "フルスナック君",
    byProvider: {
      Codex: { bars: 47.8, events: 26, lastEventMinutesAgo: 11 },
      Claude: { bars: 9.1, events: 6, lastEventMinutesAgo: 300 },
    },
    eatBySource: { chrome: 7 },
    devices: [
      {
        deviceId: "dev-fullsnack-air",
        name: "fullsnack-MacBook-Air",
        platform: "macOS",
        bars: 9.1,
        lastSeenMinutesAgo: 300,
        createdDaysAgo: 9,
      },
    ],
    dailyDays: 2,
    createdDaysAgo: 9,
  },
  {
    githubId: 11011,
    login: "lgtm-engineer",
    displayName: "LGTM Engineer",
    byProvider: {
      Claude: { bars: 28.3, events: 16, lastEventMinutesAgo: 600 },
      Codex: { bars: 4.7, events: 3, lastEventMinutesAgo: 1440 },
    },
    eatBySource: { web: 3, chrome: 1 },
    devices: [
      {
        deviceId: "dev-lgtm-mbp",
        name: "lgtm-MacBook-Pro",
        platform: "macOS",
        bars: 28.3,
        lastSeenMinutesAgo: 600,
        createdDaysAgo: 6,
      },
    ],
    dailyDays: 1,
    createdDaysAgo: 6,
  },
  {
    githubId: 90909,
    login: "nanimoshitenai",
    displayName: "何もしてない",
    byProvider: {
      Codex: { bars: 6.2, events: 4, lastEventMinutesAgo: 2880 },
    },
    eatBySource: {},
    devices: [],
    dailyDays: 0,
    createdDaysAgo: 3,
  },
];

// ---------------------------------------------------------------------------
// Sample teams. Members are referenced by seed login; team totals are derived
// (NOT hand-written) by summing each member's contribution so they always equal
// the sum of member bars / blackThunderCount — exactly what the live ingest
// fan-out maintains. Each member's `bars` contribution mirrors the user's
// totalBars and `blackThunderCount` mirrors the user's eat total (the live join
// seeds team totals from the joiner's current totals).
// ---------------------------------------------------------------------------
interface TeamMemberSeed {
  login: string; // must match a SeedUser.login
  role: TeamRole;
  joinedDaysAgo: number;
}

interface SeedTeam {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  inviteCode: string;
  ownerLogin: string; // must match a SeedUser.login (and appear in members)
  members: TeamMemberSeed[];
  createdDaysAgo: number;
}

const SEED_TEAMS: SeedTeam[] = [
  {
    id: "team-zakuzaku-squad",
    name: "ザクザク部",
    slug: "zakuzaku-squad",
    description: "毎日ブラックサンダーをザクザク消費する精鋭たち。",
    emoji: "⚡",
    inviteCode: "ZAKU777",
    ownerLogin: "zakuzaku-taro",
    members: [
      { login: "zakuzaku-taro", role: "owner", joinedDaysAgo: 27 },
      { login: "crunch-hime", role: "member", joinedDaysAgo: 20 },
      { login: "choco-dev", role: "member", joinedDaysAgo: 11 },
    ],
    createdDaysAgo: 27,
  },
  {
    id: "team-thunder-guild",
    name: "サンダーギルド",
    slug: "thunder-guild",
    description: "雷のごとくコードを書くギルド。Codex 派多め。",
    emoji: "🌩️",
    inviteCode: "BOLT-42",
    ownerLogin: "bolt-sasaki",
    members: [
      { login: "bolt-sasaki", role: "owner", joinedDaysAgo: 18 },
      { login: "thunder-neko", role: "member", joinedDaysAgo: 14 },
      { login: "fullsnack-kun", role: "member", joinedDaysAgo: 8 },
    ],
    createdDaysAgo: 18,
  },
];

// ---------------------------------------------------------------------------
// Derivation helpers — turn the compact seed into exact schema docs.
// ---------------------------------------------------------------------------
function buildProviderStats(
  seed: SeedUser,
): { byProvider: Partial<Record<Provider, ProviderStat>>; lastEventAtMs: number | null } {
  const byProvider: Partial<Record<Provider, ProviderStat>> = {};
  let lastEventAtMs: number | null = null;
  for (const [provider, p] of Object.entries(seed.byProvider) as [Provider, ProviderSeed][]) {
    const last = minutesAgo(p.lastEventMinutesAgo);
    byProvider[provider] = {
      bars: roundBars(p.bars),
      events: p.events,
      lastEventAtMs: last,
    };
    if (lastEventAtMs === null || last > lastEventAtMs) lastEventAtMs = last;
  }
  return { byProvider, lastEventAtMs };
}

/** Round bars to 1 decimal to mirror the plugin's fractional accumulation. */
function roundBars(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildUserDoc(seed: SeedUser, teamIds: string[]): UserDoc {
  const uid = uidForGithubId(seed.githubId);
  const { byProvider, lastEventAtMs } = buildProviderStats(seed);

  const totalBars = roundBars(
    Object.values(byProvider).reduce((sum, p) => sum + (p?.bars ?? 0), 0),
  );
  const totalEvents = Object.values(byProvider).reduce((sum, p) => sum + (p?.events ?? 0), 0);
  const zakuzakuScore = computeZakuzakuScore({ bars: totalBars });

  const blackThunderCount = Object.values(seed.eatBySource).reduce(
    (sum, n) => sum + (n ?? 0),
    0,
  );
  const lastAteAtMs = blackThunderCount > 0 ? minutesAgo(13) : null;

  const createdAtMs = daysAgo(seed.createdDaysAgo);

  return {
    uid,
    githubId: seed.githubId,
    login: seed.login,
    loginLower: seed.login.toLowerCase(),
    displayName: seed.displayName,
    avatarUrl: `https://avatars.githubusercontent.com/u/${seed.githubId}?v=4`,

    zakuzakuScore,
    totalBars,
    scoreComponents: { bars: totalBars },
    byProvider,
    totalEvents,

    blackThunderCount,
    eatBySource: seed.eatBySource,
    lastAteAtMs,

    deviceCount: seed.devices.length,
    teamIds,

    lastEventAtMs,
    createdAtMs,
    updatedAtMs: NOW,
  };
}

/** users/{uid}/devices/{deviceId} — the per-machine RunThunder meters. */
function buildDeviceDocs(seed: SeedUser): DeviceDoc[] {
  return seed.devices.map((d) => ({
    deviceId: d.deviceId,
    name: d.name,
    platform: d.platform,
    bars: roundBars(d.bars),
    lastSeenAtMs: minutesAgo(d.lastSeenMinutesAgo),
    createdAtMs: daysAgo(d.createdDaysAgo),
  }));
}

/**
 * Fabricate a plausible descending series of daily rollups across the user's
 * recent activity. Distributes the user's totals over `dailyDays` days with the
 * most-recent day carrying the most weight.
 */
function buildDailyDocs(user: UserDoc, days: number): DailyDoc[] {
  if (days <= 0) return [];

  const providers = Object.keys(user.byProvider) as Provider[];
  // Weight days so today gets the largest slice (e.g. 5,4,3,2,1).
  const weights = Array.from({ length: days }, (_, i) => days - i);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const docs: DailyDoc[] = [];
  for (let i = 0; i < days; i++) {
    const ms = daysAgo(i);
    const w = weights[i] / weightSum;

    const byProvider: Partial<Record<Provider, number>> = {};
    let dayBars = 0;
    for (const provider of providers) {
      const share = roundBars((user.byProvider[provider]?.bars ?? 0) * w);
      if (share > 0) {
        byProvider[provider] = share;
        dayBars = roundBars(dayBars + share);
      }
    }

    docs.push({
      day: utcDayKey(ms),
      bars: dayBars,
      events: Math.max(1, Math.round(user.totalEvents * w)),
      eats: Math.round(user.blackThunderCount * w),
      byProvider,
      updatedAtMs: ms,
    });
  }
  return docs;
}

/**
 * Build a team aggregate + its member docs from the seed, deriving the team
 * totals as the SUM of every member's contribution (bars / blackThunderCount).
 * This mirrors the live invariant: team totals == Σ member contributions.
 */
function buildTeam(
  seed: SeedTeam,
  userByLogin: Map<string, UserDoc>,
): { team: TeamDoc; members: TeamMemberDoc[] } {
  const createdAtMs = daysAgo(seed.createdDaysAgo);
  const ownerUser = userByLogin.get(seed.ownerLogin);
  if (!ownerUser) {
    throw new Error(
      `Team "${seed.id}" owner login "${seed.ownerLogin}" is not a seeded user.`,
    );
  }

  const members: TeamMemberDoc[] = [];
  let totalBars = 0;
  let totalBlackThunderCount = 0;

  for (const m of seed.members) {
    const user = userByLogin.get(m.login);
    if (!user) {
      throw new Error(
        `Team "${seed.id}" member login "${m.login}" is not a seeded user.`,
      );
    }
    // Each member contributes their current totals (what the live join seeds).
    const bars = roundBars(user.totalBars);
    const blackThunderCount = user.blackThunderCount;
    totalBars = roundBars(totalBars + bars);
    totalBlackThunderCount += blackThunderCount;

    members.push({
      uid: user.uid,
      login: user.login,
      loginLower: user.loginLower,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: m.role,
      bars,
      blackThunderCount,
      joinedAtMs: daysAgo(m.joinedDaysAgo),
      updatedAtMs: NOW,
    });
  }

  const team: TeamDoc = {
    id: seed.id,
    name: seed.name,
    slug: seed.slug,
    slugLower: seed.slug.toLowerCase(),
    description: seed.description,
    emoji: seed.emoji,
    ownerUid: ownerUser.uid,
    inviteCode: seed.inviteCode,
    memberCount: members.length,
    totalBars,
    totalBlackThunderCount,
    createdAtMs,
    updatedAtMs: NOW,
  };

  return { team, members };
}

// ---------------------------------------------------------------------------
// Write everything in batches, then print a leaderboard-style summary.
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`→ Seeding Firestore emulator at ${emulatorHost} (project: ${projectId})\n`);

  // 1. Resolve which teams each user belongs to (so UserDoc.teamIds is correct).
  const teamIdsByLogin = new Map<string, string[]>();
  for (const team of SEED_TEAMS) {
    for (const m of team.members) {
      const list = teamIdsByLogin.get(m.login) ?? [];
      list.push(team.id);
      teamIdsByLogin.set(m.login, list);
    }
  }

  // 2. Build user docs (now carrying deviceCount + teamIds) and index by login.
  const userDocs = SEED_USERS.map((seed) =>
    buildUserDoc(seed, teamIdsByLogin.get(seed.login) ?? []),
  );
  const userByLogin = new Map<string, UserDoc>();
  userDocs.forEach((u) => userByLogin.set(u.login, u));

  const batch = db.batch();
  let dailyWrites = 0;
  let deviceWrites = 0;

  for (let i = 0; i < SEED_USERS.length; i++) {
    const seed = SEED_USERS[i];
    const user = userDocs[i];

    const userRef = db.collection(COLLECTIONS.users).doc(user.uid);
    batch.set(userRef, user);

    for (const daily of buildDailyDocs(user, seed.dailyDays)) {
      const dailyRef = userRef.collection(COLLECTIONS.daily).doc(daily.day);
      batch.set(dailyRef, daily);
      dailyWrites++;
    }

    for (const device of buildDeviceDocs(seed)) {
      const deviceRef = userRef.collection(COLLECTIONS.devices).doc(device.deviceId);
      batch.set(deviceRef, device);
      deviceWrites++;
    }
  }

  // 3. Teams + their member docs (totals derived from member contributions).
  const teams: TeamDoc[] = [];
  let memberWrites = 0;
  for (const seedTeam of SEED_TEAMS) {
    const { team, members } = buildTeam(seedTeam, userByLogin);
    teams.push(team);

    const teamRef = db.collection(COLLECTIONS.teams).doc(team.id);
    batch.set(teamRef, team);

    for (const member of members) {
      const memberRef = teamRef.collection(COLLECTIONS.members).doc(member.uid);
      batch.set(memberRef, member);
      memberWrites++;
    }
  }

  // Touch a sentinel meta doc so it's obvious the emulator was seeded.
  batch.set(db.collection("_seed").doc("meta"), {
    seededAtMs: FieldValue.serverTimestamp(),
    users: userDocs.length,
    daily: dailyWrites,
    devices: deviceWrites,
    teams: teams.length,
    members: memberWrites,
  });

  await batch.commit();

  // Pretty leaderboard preview (sorted by the same field the UI orders by).
  const ranked = [...userDocs].sort((a, b) => b.zakuzakuScore - a.zakuzakuScore);

  console.log("✓ Seed complete.\n");
  console.log("  AIザクザク度 leaderboard (zakuzakuScore desc):");
  console.log("  ┌──────┬─────────────────────┬───────────┬──────────────────┬──────────┐");
  console.log("  │ rank │ login               │ ザクザク度 │ ブラックサンダー │ devices  │");
  console.log("  ├──────┼─────────────────────┼───────────┼──────────────────┼──────────┤");
  ranked.forEach((u, idx) => {
    const rank = String(idx + 1).padStart(4);
    const login = u.login.padEnd(19).slice(0, 19);
    const bars = `${formatBars(u.zakuzakuScore)}本`.padStart(9);
    const eats = `${u.blackThunderCount}回`.padStart(16);
    const devs = `${u.deviceCount}台`.padStart(8);
    console.log(`  │ ${rank} │ ${login} │ ${bars} │ ${eats} │ ${devs} │`);
  });
  console.log("  └──────┴─────────────────────┴───────────┴──────────────────┴──────────┘\n");

  console.log("  チーム (totalBars == Σ member bars):");
  console.log("  ┌─────────────────────┬──────────┬───────────┬──────────────────┐");
  console.log("  │ team                │ members  │ ザクザク度 │ ブラックサンダー │");
  console.log("  ├─────────────────────┼──────────┼───────────┼──────────────────┤");
  teams.forEach((t) => {
    const name = `${t.emoji ?? ""} ${t.name}`.padEnd(19).slice(0, 19);
    const mem = `${t.memberCount}人`.padStart(8);
    const bars = `${formatBars(t.totalBars)}本`.padStart(9);
    const eats = `${t.totalBlackThunderCount}回`.padStart(16);
    console.log(`  │ ${name} │ ${mem} │ ${bars} │ ${eats} │`);
  });
  console.log("  └─────────────────────┴──────────┴───────────┴──────────────────┘\n");

  console.log(`  users:    ${userDocs.length}`);
  console.log(`  daily:    ${dailyWrites}`);
  console.log(`  devices:  ${deviceWrites}`);
  console.log(`  teams:    ${teams.length}`);
  console.log(`  members:  ${memberWrites}`);
  console.log(
    `\n  Open the leaderboard at http://localhost:3000 (run \`pnpm run dev\` with`,
  );
  console.log(`  NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1) or inspect the emulator UI at`);
  console.log(`  http://localhost:4000/firestore.`);
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
