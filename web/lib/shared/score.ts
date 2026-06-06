import type { ScoreComponents } from "./schema";

/**
 * Single source of truth for the AIザクザク度 ranking metric.
 *
 * v1: identity on bars (zakuzakuScore === totalBars). Firestore `orderBy` needs a
 * real indexed scalar, so the ingestion transaction STORES this result in
 * users/{uid}.zakuzakuScore; readers just orderBy that one field.
 *
 * Future composite (additive, not a rewrite): e.g.
 *   return c.bars + (c.commits ?? 0) * 0.5 + (c.prMerges ?? 0) * 5;
 * When the formula stops being identity-on-bars, switch the ingest write from
 * `increment(delta)` to read scoreComponents -> recompute -> set, inside the same
 * transaction, and run scripts/recompute-scores.ts once to backfill.
 */
export function computeZakuzakuScore(c: ScoreComponents): number {
  return c.bars;
}
