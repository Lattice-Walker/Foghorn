/**
 * Tier 4 — basic fish.
 *
 * For one digit: if its candidates in n lines all fall within n crossing lines,
 * those n crossing lines are spoken for and the digit clears from them
 * elsewhere. n = 2 is an X-Wing, 3 a Swordfish, 4 a Jellyfish.
 *
 * Only unfinned, unmutated fish here; finned and franken variants belong to a
 * later tier and are not needed to rate puzzles at this level.
 */

import { DIGITS, type Digit, type Mask, has } from "../digits.js";
import { COLS, type CellIndex, ROWS, UNITS, type Unit, colOf, rowOf } from "../units.js";
import type { Deduction, Elimination, SolveState, Technique } from "./types.js";
import { combinations, placesFor } from "./util.js";

const FISH_NAMES: Record<number, string> = {
  2: "x-wing",
  3: "swordfish",
  4: "jellyfish",
};
const FISH_LABELS: Record<number, string> = {
  2: "X-Wing",
  3: "Swordfish",
  4: "Jellyfish",
};

type Orientation = "row" | "col";

/** Which crossing line a cell belongs to, given the base orientation. */
function crossIndex(cell: CellIndex, base: Orientation): number {
  return base === "row" ? colOf(cell) : rowOf(cell);
}

function crossUnits(base: Orientation): readonly Unit[] {
  return base === "row" ? COLS : ROWS;
}

function findFish(
  state: SolveState,
  size: number,
  base: Orientation,
  id: string,
): Deduction[] {
  const out: Deduction[] = [];
  const baseUnits = base === "row" ? ROWS : COLS;
  const crossing = crossUnits(base);

  for (const digit of DIGITS) {
    const candidateLines = baseUnits.filter((u) => {
      const n = placesFor(state, u, digit).length;
      return n >= 2 && n <= size;
    });
    if (candidateLines.length < size) continue;

    for (const group of combinations(candidateLines, size)) {
      const covered = new Set<number>();
      const pattern: CellIndex[] = [];
      for (const u of group) {
        for (const c of placesFor(state, u, digit)) {
          covered.add(crossIndex(c, base));
          pattern.push(c);
        }
      }
      if (covered.size !== size) continue;

      const eliminations: Elimination[] = [];
      for (const cross of covered) {
        const unit = crossing[cross] as Unit;
        for (const c of unit.cells) {
          if (pattern.includes(c)) continue;
          if (has(state.grid.cand[c] as Mask, digit)) {
            eliminations.push({ cell: c, digit });
          }
        }
      }
      if (eliminations.length === 0) continue;

      out.push({
        technique: id,
        tier: 4,
        pattern: pattern.sort((a, b) => a - b),
        digits: [digit],
        units: group.map((u) => u.index),
        placements: [],
        eliminations,
        description:
          `${FISH_LABELS[size]} on ${digit} across ${base}s ` +
          `${group.map((u) => u.ordinal + 1).join(", ")}`,
      });
    }
  }
  return out;
}

function makeFish(size: number): Technique {
  const id = FISH_NAMES[size] as string;
  return {
    id,
    name: FISH_LABELS[size] as string,
    tier: 4,
    find(state) {
      return [...findFish(state, size, "row", id), ...findFish(state, size, "col", id)];
    },
    verify(state, d) {
      const digit = d.digits[0];
      if (digit === undefined || d.units.length !== size) return false;

      const units = d.units.map((i) => UNITS[i]);
      if (units.some((u) => !u)) return false;
      const base = (units[0] as Unit).kind;
      if (base === "box") return false;
      if (!units.every((u) => (u as Unit).kind === base)) return false;

      const orientation: Orientation = base === "row" ? "row" : "col";
      const covered = new Set<number>();
      const pattern: CellIndex[] = [];
      for (const u of units) {
        const places = placesFor(state, u as Unit, digit);
        if (places.length < 2 || places.length > size) return false;
        for (const c of places) {
          covered.add(crossIndex(c, orientation));
          pattern.push(c);
        }
      }
      if (covered.size !== size) return false;

      const crossing = crossUnits(orientation);
      return d.eliminations.every((e) => {
        if (e.digit !== digit) return false;
        if (pattern.includes(e.cell)) return false;
        return covered.has(crossIndex(e.cell, orientation)) &&
          crossing.some((u) => u.cells.includes(e.cell));
      });
    },
  };
}

export const fish: readonly Technique[] = [2, 3, 4].map(makeFish);
