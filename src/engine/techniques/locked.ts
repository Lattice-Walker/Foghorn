/**
 * Tier 2 — locked candidates.
 *
 * Pointing: a digit confined to one line within a box clears from the rest of
 * that line. Claiming: a digit confined to one box within a line clears from the
 * rest of that box. Both are the same observation read from opposite sides.
 */

import { DIGITS, type Digit, type Mask, has } from "../digits.js";
import {
  BOXES,
  COLS,
  type CellIndex,
  ROWS,
  UNITS,
  type Unit,
  boxOf,
  colOf,
  rowOf,
} from "../units.js";
import type { Deduction, Elimination, SolveState, Technique } from "./types.js";
import { placesFor } from "./util.js";

function sameLine(cells: readonly CellIndex[]): Unit | null {
  if (cells.length === 0) return null;
  const first = cells[0] as CellIndex;
  if (cells.every((c) => rowOf(c) === rowOf(first))) return ROWS[rowOf(first)] as Unit;
  if (cells.every((c) => colOf(c) === colOf(first))) return COLS[colOf(first)] as Unit;
  return null;
}

function eliminationsIn(
  state: SolveState,
  unit: Unit,
  digit: Digit,
  except: readonly CellIndex[],
): Elimination[] {
  const skip = new Set(except);
  const out: Elimination[] = [];
  for (const c of unit.cells) {
    if (skip.has(c)) continue;
    if (has(state.grid.cand[c] as Mask, digit)) out.push({ cell: c, digit });
  }
  return out;
}

export const pointing: Technique = {
  id: "pointing",
  name: "Pointing",
  tier: 2,

  find(state) {
    const out: Deduction[] = [];
    for (const box of BOXES) {
      for (const digit of DIGITS) {
        const places = placesFor(state, box, digit);
        if (places.length < 2 || places.length > 3) continue;
        const line = sameLine(places);
        if (!line) continue;
        const eliminations = eliminationsIn(state, line, digit, places);
        if (eliminations.length === 0) continue;
        out.push({
          technique: this.id,
          tier: this.tier,
          pattern: places,
          digits: [digit],
          units: [box.index, line.index],
          placements: [],
          eliminations,
          description:
            `${digit} in box ${box.ordinal + 1} sits only in ${line.kind} ` +
            `${line.ordinal + 1}, so it clears from the rest of that ${line.kind}`,
        });
      }
    }
    return out;
  },

  verify(state, d) {
    const [boxIndex, lineIndex] = d.units;
    const digit = d.digits[0];
    if (boxIndex === undefined || lineIndex === undefined || digit === undefined) {
      return false;
    }
    const box = UNITS[boxIndex];
    const line = UNITS[lineIndex];
    if (!box || !line || box.kind !== "box" || line.kind === "box") return false;
    const places = placesFor(state, box, digit);
    if (places.length < 2 || places.length > 3) return false;
    if (sameLine(places)?.index !== line.index) return false;
    return d.eliminations.every(
      (e) => line.cells.includes(e.cell) && !places.includes(e.cell) && e.digit === digit,
    );
  },
};

export const claiming: Technique = {
  id: "claiming",
  name: "Claiming",
  tier: 2,

  find(state) {
    const out: Deduction[] = [];
    for (const line of [...ROWS, ...COLS]) {
      for (const digit of DIGITS) {
        const places = placesFor(state, line, digit);
        if (places.length < 2 || places.length > 3) continue;
        const first = places[0] as CellIndex;
        if (!places.every((c) => boxOf(c) === boxOf(first))) continue;
        const box = BOXES[boxOf(first)] as Unit;
        const eliminations = eliminationsIn(state, box, digit, places);
        if (eliminations.length === 0) continue;
        out.push({
          technique: this.id,
          tier: this.tier,
          pattern: places,
          digits: [digit],
          units: [line.index, box.index],
          placements: [],
          eliminations,
          description:
            `${digit} in ${line.kind} ${line.ordinal + 1} sits only in box ` +
            `${box.ordinal + 1}, so it clears from the rest of that box`,
        });
      }
    }
    return out;
  },

  verify(state, d) {
    const [lineIndex, boxIndex] = d.units;
    const digit = d.digits[0];
    if (lineIndex === undefined || boxIndex === undefined || digit === undefined) {
      return false;
    }
    const line = UNITS[lineIndex];
    const box = UNITS[boxIndex];
    if (!line || !box || line.kind === "box" || box.kind !== "box") return false;
    const places = placesFor(state, line, digit);
    if (places.length < 2 || places.length > 3) return false;
    const first = places[0] as CellIndex;
    if (!places.every((c) => boxOf(c) === boxOf(first))) return false;
    if (boxOf(first) !== box.ordinal) return false;
    return d.eliminations.every(
      (e) => box.cells.includes(e.cell) && !places.includes(e.cell) && e.digit === digit,
    );
  },
};

export const lockedCandidates: readonly Technique[] = [pointing, claiming];
