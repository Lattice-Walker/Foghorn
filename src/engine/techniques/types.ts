/**
 * The technique interface.
 *
 * Two rules from docs/rules.md shape everything here:
 *
 * G1 — the solver never receives the solution. `SolveState` holds candidates and
 * nothing else. There is no field for `S`, so no technique can consult it, and
 * the compiler rechecks that on every future change.
 *
 * G2 — every deduction carries its justification. A `Deduction` records the
 * technique, the pattern it matched and the units involved, which is what lets a
 * trace be re-checked by something that did not produce it.
 *
 * Hence the split between `find` and `verify`. `find` may be as clever as it
 * likes; `verify` re-establishes the pattern from scratch and is deliberately
 * written to be obvious. The certificate checker (certificate.ts) uses only
 * `verify`, so a bug in a search cannot certify an unsound puzzle.
 */

import type { Digit } from "../digits.js";
import type { Grid } from "../grid.js";
import type { CellIndex } from "../units.js";

/** Cost tier, following docs/metas.md Part 0. */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Placement {
  readonly cell: CellIndex;
  readonly digit: Digit;
}

export interface Elimination {
  readonly cell: CellIndex;
  readonly digit: Digit;
}

export interface Deduction {
  readonly technique: string;
  readonly tier: Tier;
  /** The cells forming the pattern, for re-verification. */
  readonly pattern: readonly CellIndex[];
  /** The digits the pattern is about. */
  readonly digits: readonly Digit[];
  /** Indices into UNITS for any units the pattern is stated over. */
  readonly units: readonly number[];
  readonly placements: readonly Placement[];
  readonly eliminations: readonly Elimination[];
  readonly description: string;
}

/**
 * Solver state: candidates, plus which cells have had their digit propagated
 * to peers. Nothing else. In particular, no solution.
 */
export interface SolveState {
  readonly grid: Grid;
  /** 1 once a cell's digit has been cleared from its 20 peers. */
  readonly placed: Uint8Array;
}

export interface Technique {
  readonly id: string;
  readonly name: string;
  readonly tier: Tier;
  /** Every deduction available in this state. May be empty. */
  find(state: SolveState): Deduction[];
  /**
   * Re-establish a deduction's pattern against a state, independently of how it
   * was found. Must not trust any field of `d` it can derive for itself.
   */
  verify(state: SolveState, d: Deduction): boolean;
}

/** Does this deduction change anything in this state? */
export function isUseful(state: SolveState, d: Deduction): boolean {
  for (const p of d.placements) {
    if (state.placed[p.cell] !== 1) return true;
  }
  for (const e of d.eliminations) {
    if ((state.grid.cand[e.cell] as number) & (1 << (e.digit - 1))) return true;
  }
  return false;
}
