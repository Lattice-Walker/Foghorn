/** Shared helpers for technique searches. */

import { type Digit, type Mask, count, has } from "../digits.js";
import type { CellIndex, Unit } from "../units.js";
import type { SolveState } from "./types.js";

/** Cells of a unit that still hold `digit` as a candidate. */
export function placesFor(
  state: SolveState,
  unit: Unit,
  digit: Digit,
): CellIndex[] {
  const out: CellIndex[] = [];
  for (const c of unit.cells) {
    if (has(state.grid.cand[c] as Mask, digit)) out.push(c);
  }
  return out;
}

/** Cells of a unit that are not yet solved. */
export function unsolvedCells(state: SolveState, unit: Unit): CellIndex[] {
  const out: CellIndex[] = [];
  for (const c of unit.cells) {
    if (count(state.grid.cand[c] as Mask) > 1) out.push(c);
  }
  return out;
}

/** Every combination of `k` items, in index order. */
export function* combinations<T>(items: readonly T[], k: number): Generator<T[]> {
  const n = items.length;
  if (k > n || k <= 0) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  for (;;) {
    yield idx.map((i) => items[i] as T);
    let i = k - 1;
    while (i >= 0 && (idx[i] as number) === n - k + i) i--;
    if (i < 0) return;
    idx[i] = (idx[i] as number) + 1;
    for (let j = i + 1; j < k; j++) idx[j] = (idx[j - 1] as number) + 1;
  }
}

/** Sort key so deductions come out in a stable order regardless of search order. */
export function deductionKey(cells: readonly CellIndex[], digits: readonly Digit[]): string {
  return `${[...cells].sort((a, b) => a - b).join(",")}|${[...digits].sort((a, b) => a - b).join(",")}`;
}
