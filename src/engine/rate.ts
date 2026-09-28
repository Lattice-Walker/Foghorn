/**
 * Single-player difficulty rating.
 *
 * One of the three axes from docs/rules.md §8; cooperation depth and
 * interleaving arrive with the two-player solver. Rating a puzzle means
 * solving it by techniques and pricing what that took.
 *
 * Nothing here may reach the exact-cover solver (G5). A puzzle that techniques
 * cannot finish is unrated — reporting it as "hard" because brute force cracked
 * it would be exactly the lie the S-blindness rule exists to prevent.
 */

import type { Values } from "./grid.js";
import { MAX_TIER } from "./techniques/index.js";
import type { Tier } from "./techniques/types.js";
import { type SolveOptions, type SolveOutcome, solve } from "./solver.js";

/** What one step of each tier costs, following docs/metas.md Part 0. */
export const TIER_WEIGHT: Readonly<Record<number, number>> = {
  1: 1,
  2: 5,
  3: 15,
  4: 40,
  5: 60,
  6: 80,
  7: 120,
  8: 200,
};

/** What each tier of docs/metas.md Part 0 is called, for display. */
export const TIER_NAME: Readonly<Record<number, string>> = {
  1: "singles",
  2: "locked candidates",
  3: "subsets",
  4: "basic fish",
  5: "single-digit chains",
  6: "wings",
  7: "chains and almost-locked sets",
  8: "global patterns",
};

export type Label = "gentle" | "moderate" | "tricky" | "tough" | "brutal" | "unrated";

export interface Difficulty {
  readonly solved: boolean;
  readonly outcome: SolveOutcome;
  /** The highest tier the solve actually needed. 0 when nothing was needed. */
  readonly maxTier: number;
  readonly steps: number;
  readonly perTier: Readonly<Record<number, number>>;
  readonly perTechnique: ReadonlyMap<string, number>;
  /** Weighted cost of the whole solve. */
  readonly score: number;
  readonly label: Label;
}

function labelFor(solved: boolean, maxTier: number, score: number): Label {
  if (!solved) return "unrated";
  if (maxTier <= 1) return "gentle";
  if (maxTier <= 2) return "moderate";
  if (maxTier <= 3) return score < 120 ? "tricky" : "tough";
  return score < 300 ? "tough" : "brutal";
}

export function rate(values: Values, options: SolveOptions = {}): Difficulty {
  const result = solve(values, options);

  const perTier: Record<number, number> = {};
  const perTechnique = new Map<string, number>();
  let maxTier = 0;
  let score = 0;

  for (const d of result.trace) {
    perTier[d.tier] = (perTier[d.tier] ?? 0) + 1;
    perTechnique.set(d.technique, (perTechnique.get(d.technique) ?? 0) + 1);
    if (d.tier > maxTier) maxTier = d.tier;
    score += TIER_WEIGHT[d.tier] ?? 0;
  }

  return {
    solved: result.solved,
    outcome: result.outcome,
    maxTier,
    steps: result.trace.length,
    perTier,
    perTechnique,
    score,
    label: labelFor(result.solved, maxTier, score),
  };
}

/** Can the technique registry finish this puzzle at all? */
export function isSolvableByTechniques(values: Values): boolean {
  return solve(values, { maxTier: MAX_TIER as Tier }).solved;
}

export function formatDifficulty(d: Difficulty): string {
  if (!d.solved) return `unrated (${d.outcome} after ${d.steps} steps)`;
  const tiers = Object.entries(d.perTier)
    .map(([tier, n]) => `T${tier}x${n}`)
    .join(" ");
  return `${d.label} — tier ${d.maxTier}, ${d.steps} steps, score ${d.score} [${tiers}]`;
}
