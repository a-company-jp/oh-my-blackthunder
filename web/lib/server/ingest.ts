// ============================================================================
// applyEvents — the single Firestore write path for the leaderboard (SERVER).
//
// Every accepted event is recorded in a per-user dedupe ledger
// (users/{uid}/events/{eventId}); doc existence == "already counted", giving us
// idempotency. A single Firestore transaction:
//   1. READS the user doc, every referenced event doc, every device doc the
//      batch touches, the user's team docs and per-team member docs,
//   2. computes deltas honoring the per-kind rules below,
//   3. WRITES the event ledger docs, the daily roll, the user aggregate, the
//      device docs, and fans the batch deltas out to every team + member doc.
//
// Per-kind rules (provider-AGNOSTIC):
//   bars w/ cumulativeBars : CUMULATIVE-delta semantics. The event carries a
//                  cumulative snapshot for its bucket (RunThunder: a device+day
//                  total). We store the last cumulative on the event doc; delta =
//                  max(incoming - prevCumulative, 0). Monotonic resend bumps only
//                  the new growth; a stale/lower resend is 0. provider is taken
//                  from event.provider (NOT hardcoded).
//   bars w/o cumulativeBars : first-write-wins (Codex-style). delta = bars; the
//                  eventId is a content hash so a re-send is a no-op duplicate.
//   eat          : first-write-wins. increment blackThunderCount by count
//                  (default 1) and eatBySource.<source> by the same.
//
// DEVICES: a bars event with a deviceId upserts users/{uid}/devices/{deviceId}
// (bars += delta, refresh name/platform/lastSeenAtMs, set createdAtMs on first
// sight) and bumps user.deviceCount for newly-seen devices.
//
// TEAMS: after computing batch deltas we fan out to every team in user.teamIds:
// teams/{id}.totalBars/totalBlackThunderCount and teams/{id}/members/{uid}.bars/
// blackThunderCount all receive the SAME batch deltas, keeping team aggregates
// and member snapshots in lockstep with the user totals.
//
// firebase-admin nested-write rule: update() with DOTTED paths => nested field
// paths (increments on existing docs); set(..., { merge: true }) => dotted keys
// are LITERAL field names and nested OBJECTS deep-merge (create / first-write).
// ============================================================================

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/server/firebase-admin";
import { computeZakuzakuScore } from "@/lib/shared/score";
import {
  COLLECTIONS,
  MAX_BARS_PER_EVENT,
  MAX_EATS_PER_EVENT,
  uidForGithubId,
  type DeviceDoc,
  type EatSource,
  type EventDoc,
  type IngestEvent,
  type Provider,
  type UserDoc,
} from "@/lib/shared/schema";

/** Trusted identity fields used to (re)populate the public user doc. */
export interface IngestIdentity {
  githubId: number;
  login: string;
  displayName: string | null;
  avatarUrl: string;
}

/** A compact view of the user doc returned to callers after a write. */
export interface AppliedUser {
  uid: string;
  githubId: number;
  login: string;
  totalBars: number;
  zakuzakuScore: number;
  blackThunderCount: number;
  deviceCount: number;
  teamIds: string[];
}

export interface ApplyResult {
  applied: number;
  duplicates: number;
  user: AppliedUser;
}

/** Allow up to ~5 minutes of clock skew; reject anything further in the future. */
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

/** UTC yyyymmdd for the daily rollup doc id. */
function utcDayKey(tsMs: number): string {
  const d = new Date(tsMs);
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}${m}${day}`;
}

function isValidTimestamp(tsMs: number, nowMs: number): boolean {
  return Number.isFinite(tsMs) && tsMs > 0 && tsMs <= nowMs + MAX_FUTURE_SKEW_MS;
}

/** Plan describing how a single event mutates the user aggregate. */
interface EventPlan {
  event: IngestEvent;
  /** bars to add to user/provider/daily aggregates (0 for eat / duplicate). */
  barsDelta: number;
  /** eats to add to user/source/daily aggregates (0 for bars / duplicate). */
  eatDelta: number;
  /** the EventDoc to write to the ledger (undefined if a duplicate to skip). */
  ledgerDoc?: EventDoc;
  isDuplicate: boolean;
}

/**
 * Validate (cheaply, no I/O) a single incoming event. Throws on malformed input
 * so the route can answer 400.
 */
function validateEvent(event: IngestEvent, nowMs: number): void {
  if (typeof event.eventId !== "string" || event.eventId.trim().length === 0) {
    throw new IngestValidationError("event.eventId is required");
  }
  if (!isValidTimestamp(event.tsMs, nowMs)) {
    throw new IngestValidationError(`event.tsMs out of range for ${event.eventId}`);
  }
  if (event.kind === "bars") {
    if (!Number.isFinite(event.bars) || event.bars <= 0) {
      throw new IngestValidationError(
        `bars must be a finite positive number (${event.eventId})`,
      );
    }
    if (event.bars > MAX_BARS_PER_EVENT) {
      throw new IngestValidationError(`bars exceeds MAX_BARS_PER_EVENT (${event.eventId})`);
    }
    if (
      event.cumulativeBars !== undefined &&
      (!Number.isFinite(event.cumulativeBars) ||
        event.cumulativeBars < 0 ||
        event.cumulativeBars > MAX_BARS_PER_EVENT * 10_000)
    ) {
      throw new IngestValidationError(
        `cumulativeBars must be a finite non-negative number (${event.eventId})`,
      );
    }
    if (
      event.deviceId !== undefined &&
      (typeof event.deviceId !== "string" ||
        event.deviceId.trim().length === 0 ||
        event.deviceId.length > 200)
    ) {
      throw new IngestValidationError(`deviceId is invalid (${event.eventId})`);
    }
  } else if (event.kind === "eat") {
    const count = event.count ?? 1;
    if (!Number.isInteger(count) || count <= 0) {
      throw new IngestValidationError(
        `eat count must be a positive integer (${event.eventId})`,
      );
    }
    if (count > MAX_EATS_PER_EVENT) {
      throw new IngestValidationError(`eat count exceeds MAX_EATS_PER_EVENT (${event.eventId})`);
    }
  } else {
    throw new IngestValidationError("unknown event kind");
  }
}

/** Thrown for malformed input; the route maps this to HTTP 400. */
export class IngestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestValidationError";
  }
}

/** Accumulated per-device delta + metadata for the write phase. */
interface DeviceAccumulator {
  deviceId: string;
  barsDelta: number;
  name: string | null;
  platform: string | null;
  lastSeenAtMs: number;
}

/**
 * Apply a batch of ingest events for one user inside a single transaction.
 *
 * @param identity trusted identity (GitHub id is authoritative; display fields
 *                 refresh the public doc each call).
 */
export async function applyEvents(
  identity: IngestIdentity,
  events: IngestEvent[],
): Promise<ApplyResult> {
  const uid = uidForGithubId(identity.githubId);
  const nowMs = Date.now();

  // Cheap, I/O-free validation up front so a bad batch fails as 400 with no
  // partial work.
  for (const event of events) {
    validateEvent(event, nowMs);
  }

  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const eventsCol = userRef.collection(COLLECTIONS.events);
  const dailyCol = userRef.collection(COLLECTIONS.daily);
  const devicesCol = userRef.collection(COLLECTIONS.devices);

  // Pre-resolve unique event ids (dedupe identical ids within the batch so we
  // never read/write the same ref twice in one transaction).
  const uniqueEventIds: string[] = [];
  const seenInBatch = new Set<string>();
  for (const event of events) {
    if (!seenInBatch.has(event.eventId)) {
      seenInBatch.add(event.eventId);
      uniqueEventIds.push(event.eventId);
    }
  }

  // Pre-resolve unique device ids referenced by bars events.
  const uniqueDeviceIds: string[] = [];
  const seenDevices = new Set<string>();
  for (const event of events) {
    if (event.kind === "bars" && event.deviceId) {
      const id = event.deviceId.trim();
      if (!seenDevices.has(id)) {
        seenDevices.add(id);
        uniqueDeviceIds.push(id);
      }
    }
  }

  const result = await db.runTransaction(async (tx) => {
    // --- READS (must all precede writes in a Firestore transaction) ----------
    const userSnap = await tx.get(userRef);
    const existing = userSnap.exists ? (userSnap.data() as UserDoc) : null;

    const eventSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    await Promise.all(
      uniqueEventIds.map(async (eventId) => {
        eventSnaps.set(eventId, await tx.get(eventsCol.doc(eventId)));
      }),
    );

    const deviceSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    await Promise.all(
      uniqueDeviceIds.map(async (deviceId) => {
        deviceSnaps.set(deviceId, await tx.get(devicesCol.doc(deviceId)));
      }),
    );

    // Team fan-out targets: read each team doc + this user's member doc. We read
    // these unconditionally in the read phase so the write phase can increment
    // without a second round trip.
    const teamIds: string[] = Array.isArray(existing?.teamIds)
      ? (existing!.teamIds as string[])
      : [];
    const teamMemberSnaps = new Map<
      string,
      {
        teamRef: FirebaseFirestore.DocumentReference;
        memberRef: FirebaseFirestore.DocumentReference;
        teamExists: boolean;
        memberExists: boolean;
      }
    >();
    await Promise.all(
      teamIds.map(async (teamId) => {
        const teamRef = db.collection(COLLECTIONS.teams).doc(teamId);
        const memberRef = teamRef.collection(COLLECTIONS.members).doc(uid);
        const [teamSnap, memberSnap] = await Promise.all([
          tx.get(teamRef),
          tx.get(memberRef),
        ]);
        teamMemberSnaps.set(teamId, {
          teamRef,
          memberRef,
          teamExists: teamSnap.exists,
          memberExists: memberSnap.exists,
        });
      }),
    );

    // --- PLAN ----------------------------------------------------------------
    // Track in-batch cumulative per eventId so two snapshots for the same bucket
    // in one request compose correctly.
    const cumulativeInBatch = new Map<string, number>();
    const plans: EventPlan[] = [];
    let applied = 0;
    let duplicates = 0;

    for (const event of events) {
      const snap = eventSnaps.get(event.eventId)!;

      if (event.kind === "bars") {
        // Cumulative semantics are keyed on the PRESENCE of cumulativeBars
        // (provider-agnostic). Without it: first-write-wins.
        if (event.cumulativeBars !== undefined) {
          const prevFromDoc = snap.exists
            ? Number((snap.data() as EventDoc).cumulativeBars ?? 0)
            : 0;
          const prevInBatch = cumulativeInBatch.get(event.eventId);
          const prevCumulative =
            prevInBatch !== undefined
              ? prevInBatch
              : Number.isFinite(prevFromDoc)
                ? prevFromDoc
                : 0;
          const incoming = event.cumulativeBars;
          const delta = Math.max(incoming - prevCumulative, 0);
          const newCumulative = Math.max(incoming, prevCumulative);
          cumulativeInBatch.set(event.eventId, newCumulative);

          if (delta <= 0) {
            // Monotonic-but-no-growth resend: a duplicate (no score change) but
            // we still refresh the stored cumulative.
            duplicates += 1;
            plans.push({
              event,
              barsDelta: 0,
              eatDelta: 0,
              ledgerDoc: {
                kind: "bars",
                provider: event.provider,
                bars: 0,
                count: 0,
                cumulativeBars: newCumulative,
                sourceTimestampMs: event.tsMs,
                ingestedAtMs: nowMs,
              },
              isDuplicate: true,
            });
            continue;
          }

          applied += 1;
          plans.push({
            event,
            barsDelta: delta,
            eatDelta: 0,
            ledgerDoc: {
              kind: "bars",
              provider: event.provider,
              bars: delta,
              count: 0,
              cumulativeBars: newCumulative,
              sourceTimestampMs: event.tsMs,
              ingestedAtMs: nowMs,
            },
            isDuplicate: false,
          });
          continue;
        }

        // Non-cumulative (Codex-style): first-write-wins.
        if (snap.exists) {
          duplicates += 1;
          plans.push({ event, barsDelta: 0, eatDelta: 0, isDuplicate: true });
          continue;
        }
        applied += 1;
        plans.push({
          event,
          barsDelta: event.bars,
          eatDelta: 0,
          ledgerDoc: {
            kind: "bars",
            provider: event.provider,
            bars: event.bars,
            count: 0,
            sourceTimestampMs: event.tsMs,
            ingestedAtMs: nowMs,
          },
          isDuplicate: false,
        });
        continue;
      }

      // kind === "eat": first-write-wins.
      const count = event.count ?? 1;
      if (snap.exists) {
        duplicates += 1;
        plans.push({ event, barsDelta: 0, eatDelta: 0, isDuplicate: true });
        continue;
      }
      applied += 1;
      plans.push({
        event,
        barsDelta: 0,
        eatDelta: count,
        ledgerDoc: {
          kind: "eat",
          source: event.source,
          bars: 0,
          count,
          sourceTimestampMs: event.tsMs,
          ingestedAtMs: nowMs,
        },
        isDuplicate: false,
      });
    }

    // --- AGGREGATE deltas ----------------------------------------------------
    let barsDeltaTotal = 0;
    let eatDeltaTotal = 0;
    let lastEventAtMs: number | null = existing?.lastEventAtMs ?? null;
    let lastAteAtMs: number | null = existing?.lastAteAtMs ?? null;

    const providerBars: Partial<Record<Provider, number>> = {};
    const providerEvents: Partial<Record<Provider, number>> = {};
    const providerLastAt: Partial<Record<Provider, number>> = {};
    const eatBySourceDelta: Partial<Record<EatSource, number>> = {};
    const deviceAcc = new Map<string, DeviceAccumulator>();
    const dailyDeltas = new Map<
      string,
      {
        bars: number;
        events: number;
        eats: number;
        byProvider: Partial<Record<Provider, number>>;
      }
    >();

    function bumpDaily(
      day: string,
      patch: {
        bars?: number;
        events?: number;
        eats?: number;
        provider?: Provider;
        providerBars?: number;
      },
    ): void {
      const cur =
        dailyDeltas.get(day) ?? { bars: 0, events: 0, eats: 0, byProvider: {} };
      cur.bars += patch.bars ?? 0;
      cur.events += patch.events ?? 0;
      cur.eats += patch.eats ?? 0;
      if (patch.provider && patch.providerBars) {
        cur.byProvider[patch.provider] =
          (cur.byProvider[patch.provider] ?? 0) + patch.providerBars;
      }
      dailyDeltas.set(day, cur);
    }

    for (const plan of plans) {
      const { event } = plan;
      const day = utcDayKey(event.tsMs);

      if (event.kind === "bars" && plan.barsDelta > 0) {
        barsDeltaTotal += plan.barsDelta;
        const p = event.provider;
        providerBars[p] = (providerBars[p] ?? 0) + plan.barsDelta;
        providerEvents[p] = (providerEvents[p] ?? 0) + 1;
        providerLastAt[p] = Math.max(providerLastAt[p] ?? 0, event.tsMs);
        lastEventAtMs = Math.max(lastEventAtMs ?? 0, event.tsMs);
        bumpDaily(day, {
          bars: plan.barsDelta,
          events: 1,
          provider: p,
          providerBars: plan.barsDelta,
        });

        // Accumulate per-device deltas (only when the event named a device).
        if (event.deviceId) {
          const deviceId = event.deviceId.trim();
          const acc =
            deviceAcc.get(deviceId) ?? {
              deviceId,
              barsDelta: 0,
              name: null,
              platform: null,
              lastSeenAtMs: 0,
            };
          acc.barsDelta += plan.barsDelta;
          if (event.deviceName) acc.name = event.deviceName;
          acc.lastSeenAtMs = Math.max(acc.lastSeenAtMs, event.tsMs);
          deviceAcc.set(deviceId, acc);
        }
      } else if (event.kind === "eat" && plan.eatDelta > 0) {
        eatDeltaTotal += plan.eatDelta;
        const s = event.source;
        eatBySourceDelta[s] = (eatBySourceDelta[s] ?? 0) + plan.eatDelta;
        lastAteAtMs = Math.max(lastAteAtMs ?? 0, event.tsMs);
        lastEventAtMs = Math.max(lastEventAtMs ?? 0, event.tsMs);
        bumpDaily(day, { eats: plan.eatDelta, events: 1 });
      }
    }

    // --- WRITES --------------------------------------------------------------
    // 1. Event ledger docs (skip duplicates that carry no ledger doc; for the
    //    cumulative path we DO rewrite the doc to refresh the stored cumulative).
    for (const plan of plans) {
      if (!plan.ledgerDoc) continue;
      tx.set(eventsCol.doc(plan.event.eventId), plan.ledgerDoc, { merge: true });
    }

    // 2. Daily rollups. The daily doc may not exist yet -> set(..., merge:true).
    //    With set-merge, dotted keys are LITERAL field names, so byProvider must
    //    be a NESTED object carrying increment sentinels, never "byProvider.<p>".
    for (const [day, delta] of dailyDeltas) {
      const update: Record<string, unknown> = { day, updatedAtMs: nowMs };
      if (delta.bars) update.bars = FieldValue.increment(delta.bars);
      if (delta.events) update.events = FieldValue.increment(delta.events);
      if (delta.eats) update.eats = FieldValue.increment(delta.eats);
      const byProvider: Record<string, FirebaseFirestore.FieldValue> = {};
      for (const [provider, bars] of Object.entries(delta.byProvider)) {
        if (bars) byProvider[provider] = FieldValue.increment(bars);
      }
      if (Object.keys(byProvider).length > 0) update.byProvider = byProvider;
      tx.set(dailyCol.doc(day), update, { merge: true });
    }

    // 3. Devices. Upsert each touched device; count newly-seen ones so we can
    //    bump user.deviceCount. createdAtMs is set only on first sight.
    let newDeviceCount = 0;
    for (const acc of deviceAcc.values()) {
      const deviceSnap = deviceSnaps.get(acc.deviceId);
      const deviceRef = devicesCol.doc(acc.deviceId);
      const isNew = !deviceSnap?.exists;
      if (isNew) {
        newDeviceCount += 1;
        const created: DeviceDoc = {
          deviceId: acc.deviceId,
          name: acc.name ?? acc.deviceId,
          platform: acc.platform ?? "unknown",
          bars: acc.barsDelta,
          lastSeenAtMs: acc.lastSeenAtMs || nowMs,
          createdAtMs: nowMs,
        };
        tx.set(deviceRef, created);
      } else {
        const update: Record<string, unknown> = {
          lastSeenAtMs: acc.lastSeenAtMs || nowMs,
        };
        if (acc.barsDelta > 0) {
          update.bars = FieldValue.increment(acc.barsDelta);
        }
        if (acc.name) update.name = acc.name;
        if (acc.platform) update.platform = acc.platform;
        tx.update(deviceRef, update);
      }
    }

    // 4. User aggregate.
    const newTotalBars = (existing?.totalBars ?? 0) + barsDeltaTotal;
    const newScore = computeZakuzakuScore({ bars: newTotalBars });
    const newBlackThunderCount =
      (existing?.blackThunderCount ?? 0) + eatDeltaTotal;
    const newDeviceTotal = (existing?.deviceCount ?? 0) + newDeviceCount;

    if (!userSnap.exists) {
      const created: UserDoc = {
        uid,
        githubId: identity.githubId,
        login: identity.login,
        loginLower: identity.login.toLowerCase(),
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        zakuzakuScore: newScore,
        totalBars: barsDeltaTotal,
        scoreComponents: { bars: barsDeltaTotal },
        byProvider: {},
        totalEvents: applied,
        blackThunderCount: eatDeltaTotal,
        eatBySource: {},
        lastAteAtMs,
        deviceCount: newDeviceCount,
        teamIds: [],
        lastEventAtMs,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      for (const [provider, bars] of Object.entries(providerBars) as [
        Provider,
        number,
      ][]) {
        created.byProvider[provider] = {
          bars,
          events: providerEvents[provider] ?? 0,
          lastEventAtMs: providerLastAt[provider] ?? null,
        };
      }
      for (const [source, count] of Object.entries(eatBySourceDelta) as [
        EatSource,
        number,
      ][]) {
        created.eatBySource[source] = count;
      }
      tx.set(userRef, created);
    } else {
      // update(): dotted keys ARE nested field paths (opposite of set-merge),
      // which is what we want for byProvider.<p>.bars / eatBySource.<s>.
      const update: Record<string, unknown> = {
        githubId: identity.githubId,
        login: identity.login,
        loginLower: identity.login.toLowerCase(),
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        updatedAtMs: nowMs,
      };
      if (barsDeltaTotal > 0) {
        update.totalBars = FieldValue.increment(barsDeltaTotal);
        update["scoreComponents.bars"] = FieldValue.increment(barsDeltaTotal);
        // v1: zakuzakuScore === totalBars, so increment mirrors the bars delta.
        update.zakuzakuScore = FieldValue.increment(barsDeltaTotal);
      }
      if (applied > 0) update.totalEvents = FieldValue.increment(applied);
      if (eatDeltaTotal > 0) {
        update.blackThunderCount = FieldValue.increment(eatDeltaTotal);
      }
      if (newDeviceCount > 0) {
        update.deviceCount = FieldValue.increment(newDeviceCount);
      }
      if (lastEventAtMs !== null) update.lastEventAtMs = lastEventAtMs;
      if (lastAteAtMs !== null) update.lastAteAtMs = lastAteAtMs;
      for (const [provider, bars] of Object.entries(providerBars) as [
        Provider,
        number,
      ][]) {
        update[`byProvider.${provider}.bars`] = FieldValue.increment(bars);
        update[`byProvider.${provider}.events`] = FieldValue.increment(
          providerEvents[provider] ?? 0,
        );
        if (providerLastAt[provider] !== undefined) {
          update[`byProvider.${provider}.lastEventAtMs`] =
            providerLastAt[provider];
        }
      }
      for (const [source, count] of Object.entries(eatBySourceDelta) as [
        EatSource,
        number,
      ][]) {
        update[`eatBySource.${source}`] = FieldValue.increment(count);
      }
      tx.update(userRef, update);
    }

    // 5. TEAM FAN-OUT. Mirror the batch deltas into every team the user belongs
    //    to and the matching member snapshot. We only write if the docs exist
    //    (a stale teamId or a missing member doc is skipped, not created here).
    if (barsDeltaTotal > 0 || eatDeltaTotal > 0) {
      for (const teamId of teamIds) {
        const refs = teamMemberSnaps.get(teamId);
        if (!refs) continue;

        if (refs.teamExists) {
          const teamUpdate: Record<string, unknown> = { updatedAtMs: nowMs };
          if (barsDeltaTotal > 0) {
            teamUpdate.totalBars = FieldValue.increment(barsDeltaTotal);
          }
          if (eatDeltaTotal > 0) {
            teamUpdate.totalBlackThunderCount =
              FieldValue.increment(eatDeltaTotal);
          }
          tx.update(refs.teamRef, teamUpdate);
        }

        if (refs.memberExists) {
          const memberUpdate: Record<string, unknown> = { updatedAtMs: nowMs };
          if (barsDeltaTotal > 0) {
            memberUpdate.bars = FieldValue.increment(barsDeltaTotal);
          }
          if (eatDeltaTotal > 0) {
            memberUpdate.blackThunderCount = FieldValue.increment(eatDeltaTotal);
          }
          tx.update(refs.memberRef, memberUpdate);
        }
      }
    }

    const user: AppliedUser = {
      uid,
      githubId: identity.githubId,
      login: identity.login,
      totalBars: newTotalBars,
      zakuzakuScore: newScore,
      blackThunderCount: newBlackThunderCount,
      deviceCount: newDeviceTotal,
      teamIds,
    };

    return { applied, duplicates, user };
  });

  return result;
}
