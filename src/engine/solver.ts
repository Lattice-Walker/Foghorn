/**
 * The technique solver.
 *
 * S-blind by construction (docs/rules.md G1): it takes a clue set and nothing
 * else. There is no parameter through which a solution could reach it, so it
 * cannot check a candidate against the answer even by accident.
 *
 * It applies the cheapest applicable technique, one deduction at a time, and
 * records each one. Applying a single deduction per step is slower than batching
 * but keeps attribution exact, which is what the difficulty rating is made of.
 *
 * It never guesses (G4). When no technique fires, the puzzle stalls and is
 * reported as unsolved — that is a real answer about the puzzle, not a failure
 * of the solver.
 */

import { type Values, assign, cloneGrid, eliminate, fromValues, isFull } from "./grid.js";
import { CELLS } from "./units.js";
import { TECHNIQUES } from "./techniques/index.js";
import type { Deduction, SolveState, Technique, Tier } from "./techniques/types.js";
import { isUseful } from "./techniques/types.js";

export type SolveOutcome = "solved" | "stalled" | "contradiction" | "invalid-givens";

export interface SolveResult {
  readonly outcome: SolveOutcome;
  readonly solved: boolean;
  readonly state: SolveState | null;
  /** Every deduction applied, in order. This is the proof certificate. */
  readonly trace: readonly Deduction[];
}

export interface SolveOptions {
  /** Refuse techniques above this tier. Default: all available. */
  readonly maxTier?: Tier;
  /** Override the registry, e.g. to measure one technique's reach. */
  readonly techniques?: readonly Technique[];
  /** Give up after this many deductions. Guards against a buggy technique. */
  readonly maxSteps?: number;
}

/** Build solver state from a clue set, propagating each given to its peers. */
export function createState(values: Values): SolveState | null {
  const grid = fromValues(values);
  if (!grid) return null;
  const placed = new Uint8Array(CELLS);
  for (let c = 0; c < CELLS; c++) if (values[c]) placed[c] = 1;
  return { grid, placed };
}

export function cloneState(state: SolveState): SolveState {
  return { grid: cloneGrid(state.grid), placed: Uint8Array.from(state.placed) };
}

/** Apply a deduction's placements and eliminations. False on contradiction. */
export function applyDeduction(state: SolveState, d: Deduction): boolean {
  for (const p of d.placements) {
    if (!assign(state.grid, p.cell, p.digit)) return false;
    state.placed[p.cell] = 1;
  }
  for (const e of d.eliminations) {
    if (!eliminate(state.grid, e.cell, e.digit)) return false;
  }
  return true;
}

/** Is every cell solved and propagated? */
export function isComplete(state: SolveState): boolean {
  if (!isFull(state.grid)) return false;
  for (let c = 0; c < CELLS; c++) if (state.placed[c] !== 1) return false;
  return true;
}

export function solve(values: Values, options: SolveOptions = {}): SolveResult {
  const { maxTier = 8, techniques = TECHNIQUES, maxSteps = 2000 } = options;

  const state = createState(values);
  if (!state) {
    return { outcome: "invalid-givens", solved: false, state: null, trace: [] };
  }

  const usable = techniques
    .filter((t) => t.tier <= maxTier)
    .slice()
    .sort((a, b) => a.tier - b.tier);

  const trace: Deduction[] = [];

  while (trace.length < maxSteps) {
    if (isComplete(state)) {
      return { outcome: "solved", solved: true, state, trace };
    }

    let applied = false;
    for (const technique of usable) {
      const found = technique.find(state).filter((d) => isUseful(state, d));
      const next = found[0];
      if (!next) continue;
      if (!applyDeduction(state, next)) {
        trace.push(next);
        return { outcome: "contradiction", solved: false, state, trace };
      }
      trace.push(next);
      applied = true;
      break;
    }

    if (!applied) {
      return { outcome: "stalled", solved: false, state, trace };
    }
  }

  return { outcome: "stalled", solved: false, state, trace };
}
