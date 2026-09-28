/**
 * The technique registry, ordered by cost.
 *
 * The solver always applies the cheapest applicable technique, so this order is
 * also the difficulty ladder from docs/metas.md Part 0. Tiers 5 and up (chains,
 * wings, ALS) are not implemented yet; puzzles needing them are reported as
 * unsolved rather than guessed at, which is the honest outcome.
 */

import { fish } from "./fish.js";
import { lockedCandidates } from "./locked.js";
import { singles } from "./singles.js";
import { subsets } from "./subsets.js";
import type { Technique } from "./types.js";

export const TECHNIQUES: readonly Technique[] = [
  ...singles,
  ...lockedCandidates,
  ...subsets,
  ...fish,
];

export const BY_ID: ReadonlyMap<string, Technique> = new Map(
  TECHNIQUES.map((t) => [t.id, t]),
);

/** The highest tier the registry can currently reach. */
export const MAX_TIER = Math.max(...TECHNIQUES.map((t) => t.tier));

export * from "./types.js";
export { fish, lockedCandidates, singles, subsets };
