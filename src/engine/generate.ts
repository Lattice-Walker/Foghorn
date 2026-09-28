/**
 * Full-grid generation.
 *
 * This is the authoring side of the engine and may use the solution freely —
 * docs/rules.md §10 draws the line between authoring (may know the answer) and
 * proving (may not). The quarantined exact-cover solver is a legitimate import
 * here; it is not one in `solver.ts` or anything under `techniques/`.
 */

import type { Rng } from "./rng.js";
import type { Values } from "./grid.js";
import { CELLS } from "./units.js";
import { solveWithOrder, hasUniqueSolution } from "./exact-cover/dlx.js";

const BLANK: Values = new Array(CELLS).fill(0) as Values;

/**
 * A random complete, valid grid.
 *
 * Produced by solving an empty grid with the branch order shuffled at every
 * node, which gives good variety without the bias of filling cells in a fixed
 * sweep.
 */
export function randomSolution(rng: Rng): Values {
  const solution = solveWithOrder(BLANK, (rows) => rng.shuffle(rows));
  if (!solution) throw new Error("empty grid has no solution — impossible");
  return solution;
}

export interface CarveOptions {
  /**
   * Stop once this many clues remain. The generator still refuses any removal
   * that costs uniqueness, so the result may hold more clues than asked.
   */
  readonly targetClues?: number;
  /** Remove cells in symmetric pairs about the grid centre. */
  readonly symmetric?: boolean;
}

/**
 * Remove clues from a complete grid for as long as the puzzle stays unique.
 *
 * Uniqueness is the one place brute force is correct: it is a property of the
 * clue set, not a claim about how a person would solve it. Whether the result is
 * solvable *by techniques* is a separate question the technique solver answers,
 * and a puzzle that survives carving may still be rejected there.
 */
export function carve(
  solution: Values,
  rng: Rng,
  options: CarveOptions = {},
): Values {
  const { targetClues = 0, symmetric = false } = options;
  const puzzle: (Values[number])[] = [...solution];
  let clues = CELLS;

  const order = Array.from({ length: CELLS }, (_, i) => i);
  rng.shuffle(order);

  for (const cell of order) {
    if (clues <= targetClues) break;
    const partner = symmetric ? CELLS - 1 - cell : cell;
    const group = partner === cell ? [cell] : [cell, partner];
    if (group.some((c) => puzzle[c] === 0)) continue;

    const saved = group.map((c) => puzzle[c]);
    for (const c of group) puzzle[c] = 0;

    if (hasUniqueSolution(puzzle as Values)) {
      clues -= group.length;
    } else {
      group.forEach((c, i) => {
        puzzle[c] = saved[i] as Values[number];
      });
    }
  }

  return puzzle as Values;
}

export function clueCount(values: Values): number {
  let n = 0;
  for (const v of values) if (v !== 0) n++;
  return n;
}
