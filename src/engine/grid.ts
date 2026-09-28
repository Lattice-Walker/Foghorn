/**
 * Grid state: one candidate mask per cell.
 *
 * `assign` applies the sudoku rule itself (a digit clears from its peers) but
 * deliberately does *not* cascade. Every further deduction has to be found and
 * attributed by a named technique, because docs/rules.md G2 requires each
 * deduction to carry its justification. Recursive propagation here would make
 * placements appear with no technique to credit them to.
 */

import {
  ALL,
  type Digit,
  type Mask,
  bit,
  count,
  digitsOf,
  formatMask,
  has,
  soleDigit,
} from "./digits.js";
import { CELLS, type CellIndex, N, PEERS, UNITS, formatCell } from "./units.js";

export interface Grid {
  /** One 9-bit candidate mask per cell, indexed by CellIndex. */
  readonly cand: Uint16Array;
}

export function emptyGrid(): Grid {
  const cand = new Uint16Array(CELLS);
  cand.fill(ALL);
  return { cand };
}

export function cloneGrid(g: Grid): Grid {
  return { cand: Uint16Array.from(g.cand) };
}

export function candidatesAt(g: Grid, cell: CellIndex): Mask {
  return g.cand[cell] as Mask;
}

/** The digit in a solved cell, or null while more than one remains. */
export function valueAt(g: Grid, cell: CellIndex): Digit | null {
  return soleDigit(g.cand[cell] as Mask);
}

export function isSolvedCell(g: Grid, cell: CellIndex): boolean {
  return count(g.cand[cell] as Mask) === 1;
}

export function isFull(g: Grid): boolean {
  for (let c = 0; c < CELLS; c++) if (count(g.cand[c] as Mask) !== 1) return false;
  return true;
}

/**
 * Remove one digit from one cell.
 * Returns false if that empties the cell, which means the grid is broken.
 */
export function eliminate(g: Grid, cell: CellIndex, d: Digit): boolean {
  const before = g.cand[cell] as Mask;
  const after = before & ~bit(d);
  if (after === before) return true;
  g.cand[cell] = after;
  return after !== 0;
}

/**
 * Place a digit, clearing it from the cell's 20 peers.
 * Returns false on contradiction. Does not cascade; see the module note.
 */
export function assign(g: Grid, cell: CellIndex, d: Digit): boolean {
  if (!has(g.cand[cell] as Mask, d)) return false;
  g.cand[cell] = bit(d);
  for (const p of PEERS[cell] as readonly CellIndex[]) {
    if (!eliminate(g, p, d)) return false;
  }
  return true;
}

/**
 * Structural check: no empty cell, and every unit has somewhere to put every
 * digit. Does not prove solvability, only that nothing is already broken.
 */
export function isConsistent(g: Grid): boolean {
  for (let c = 0; c < CELLS; c++) if ((g.cand[c] as Mask) === 0) return false;
  for (const u of UNITS) {
    let seen = 0;
    for (const c of u.cells) seen |= g.cand[c] as Mask;
    if (seen !== ALL) return false;
    // A solved digit may not appear twice in a unit.
    let solvedMask = 0;
    for (const c of u.cells) {
      const m = g.cand[c] as Mask;
      if (count(m) === 1) {
        if ((solvedMask & m) !== 0) return false;
        solvedMask |= m;
      }
    }
  }
  return true;
}

/** Row-major digits, 0 where unsolved. */
export type Values = readonly (Digit | 0)[];

export function toValues(g: Grid): Values {
  const out: (Digit | 0)[] = [];
  for (let c = 0; c < CELLS; c++) out.push(valueAt(g, c) ?? 0);
  return out;
}

/** Build a grid from givens, propagating each placement's peer eliminations. */
export function fromValues(values: Values): Grid | null {
  const g = emptyGrid();
  for (let c = 0; c < CELLS; c++) {
    const d = values[c];
    if (d) {
      if (!assign(g, c, d)) return null;
    }
  }
  return g;
}

/** Parse 81 characters, using any of `.`, `0` or `-` for an empty cell. */
export function parseValues(s: string): Values {
  const chars = [...s.replace(/\s+/g, "")];
  if (chars.length !== CELLS) {
    throw new Error(`expected ${CELLS} cells, got ${chars.length}`);
  }
  return chars.map((ch) => {
    if (ch === "." || ch === "0" || ch === "-") return 0 as const;
    const d = Number(ch);
    if (!Number.isInteger(d) || d < 1 || d > 9) throw new Error(`bad cell: ${ch}`);
    return d as Digit;
  });
}

export function formatValues(v: Values): string {
  return v.map((d) => (d === 0 ? "." : String(d))).join("");
}

/** Human-readable grid, one row per line, candidates shown for unsolved cells. */
export function formatGrid(g: Grid): string {
  const lines: string[] = [];
  const width = Math.max(
    ...Array.from(g.cand, (m) => formatMask(m as Mask).length),
  );
  for (let r = 0; r < N; r++) {
    const cells: string[] = [];
    for (let c = 0; c < N; c++) {
      cells.push(formatMask(g.cand[r * N + c] as Mask).padEnd(width));
      if (c % 3 === 2 && c !== N - 1) cells.push("|");
    }
    lines.push(cells.join(" "));
    if (r % 3 === 2 && r !== N - 1) lines.push("-".repeat(lines[0]!.length));
  }
  return lines.join("\n");
}

export function describeCell(g: Grid, cell: CellIndex): string {
  return `${formatCell(cell)}=${formatMask(g.cand[cell] as Mask)}`;
}

export { digitsOf };
