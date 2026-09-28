/**
 * Tier 3 — naked and hidden subsets.
 *
 * Naked: n cells in a unit whose candidates union to exactly n digits, so those
 * digits belong to those cells and clear from the rest of the unit.
 * Hidden: n digits in a unit confined to exactly n cells, so those cells hold
 * nothing else.
 *
 * The two are the same deduction seen from opposite sides — a naked subset of
 * size n is a hidden subset of size 9-n in the same unit — but both are worth
 * having, because which one a person spots depends on which is smaller.
 */

import { DIGITS, type Digit, type Mask, count, digitsOf, has } from "../digits.js";
import { UNITS, type Unit, formatCell } from "../units.js";
import type { Deduction, Elimination, SolveState, Technique } from "./types.js";
import { combinations, placesFor, unsolvedCells } from "./util.js";

const SIZES = [2, 3, 4] as const;
const SIZE_NAMES: Record<number, string> = { 2: "pair", 3: "triple", 4: "quad" };

function nakedIn(state: SolveState, unit: Unit, size: number, id: string, tier: 3) {
  const out: Deduction[] = [];
  const cells = unsolvedCells(state, unit);
  if (cells.length <= size) return out;

  for (const group of combinations(cells, size)) {
    let union = 0;
    for (const c of group) union |= state.grid.cand[c] as Mask;
    if (count(union) !== size) continue;

    const digits = digitsOf(union);
    const eliminations: Elimination[] = [];
    for (const c of cells) {
      if (group.includes(c)) continue;
      for (const d of digits) {
        if (has(state.grid.cand[c] as Mask, d)) eliminations.push({ cell: c, digit: d });
      }
    }
    if (eliminations.length === 0) continue;

    out.push({
      technique: id,
      tier,
      pattern: group,
      digits,
      units: [unit.index],
      placements: [],
      eliminations,
      description:
        `${digits.join("")} fill ${group.map(formatCell).join(", ")} in ` +
        `${unit.kind} ${unit.ordinal + 1}`,
    });
  }
  return out;
}

function hiddenIn(state: SolveState, unit: Unit, size: number, id: string, tier: 3) {
  const out: Deduction[] = [];
  const open = DIGITS.filter((d) => placesFor(state, unit, d).length > 1);
  if (open.length <= size) return out;

  for (const group of combinations(open, size)) {
    const cells = new Set<number>();
    for (const d of group) for (const c of placesFor(state, unit, d)) cells.add(c);
    if (cells.size !== size) continue;

    let groupMask = 0;
    for (const d of group) groupMask |= 1 << (d - 1);

    const eliminations: Elimination[] = [];
    for (const c of cells) {
      const extra = (state.grid.cand[c] as Mask) & ~groupMask;
      for (const d of digitsOf(extra)) eliminations.push({ cell: c, digit: d });
    }
    if (eliminations.length === 0) continue;

    out.push({
      technique: id,
      tier,
      pattern: [...cells].sort((a, b) => a - b),
      digits: [...group],
      units: [unit.index],
      placements: [],
      eliminations,
      description:
        `${group.join("")} fit only ${[...cells].sort((a, b) => a - b).map(formatCell).join(", ")} ` +
        `in ${unit.kind} ${unit.ordinal + 1}`,
    });
  }
  return out;
}

function makeNaked(size: number): Technique {
  const id = `naked-${SIZE_NAMES[size]}`;
  return {
    id,
    name: `Naked ${SIZE_NAMES[size]}`,
    tier: 3,
    find(state) {
      return UNITS.flatMap((u) => nakedIn(state, u, size, id, 3));
    },
    verify(state, d) {
      const unitIndex = d.units[0];
      if (unitIndex === undefined || d.pattern.length !== size) return false;
      const unit = UNITS[unitIndex];
      if (!unit) return false;
      if (!d.pattern.every((c) => unit.cells.includes(c))) return false;

      let union = 0;
      for (const c of d.pattern) {
        const m = state.grid.cand[c] as Mask;
        if (count(m) < 2) return false;
        union |= m;
      }
      if (count(union) !== size) return false;

      return d.eliminations.every(
        (e) =>
          unit.cells.includes(e.cell) &&
          !d.pattern.includes(e.cell) &&
          has(union, e.digit),
      );
    },
  };
}

function makeHidden(size: number): Technique {
  const id = `hidden-${SIZE_NAMES[size]}`;
  return {
    id,
    name: `Hidden ${SIZE_NAMES[size]}`,
    tier: 3,
    find(state) {
      return UNITS.flatMap((u) => hiddenIn(state, u, size, id, 3));
    },
    verify(state, d) {
      const unitIndex = d.units[0];
      if (unitIndex === undefined || d.digits.length !== size) return false;
      const unit = UNITS[unitIndex];
      if (!unit) return false;

      const cells = new Set<number>();
      for (const digit of d.digits) {
        for (const c of placesFor(state, unit, digit)) cells.add(c);
      }
      if (cells.size !== size) return false;

      let groupMask = 0;
      for (const digit of d.digits) groupMask |= 1 << (digit - 1);

      return d.eliminations.every(
        (e) => cells.has(e.cell) && !has(groupMask, e.digit),
      );
    },
  };
}

export const nakedSubsets: readonly Technique[] = SIZES.map(makeNaked);
export const hiddenSubsets: readonly Technique[] = SIZES.map(makeHidden);
export const subsets: readonly Technique[] = [...nakedSubsets, ...hiddenSubsets];
