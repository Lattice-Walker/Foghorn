/**
 * Grid geometry, precomputed once.
 *
 * The grid is always 9x9 (docs/rules.md §1), so every table here is a constant
 * and nothing takes a size parameter.
 */

export const N = 9;
export const BOX = 3;
export const CELLS = N * N;

/** A cell, 0..80, in row-major order. */
export type CellIndex = number;

export function cellAt(row: number, col: number): CellIndex {
  return row * N + col;
}

export function rowOf(cell: CellIndex): number {
  return (cell / N) | 0;
}

export function colOf(cell: CellIndex): number {
  return cell % N;
}

export function boxOf(cell: CellIndex): number {
  return ((rowOf(cell) / BOX) | 0) * BOX + ((colOf(cell) / BOX) | 0);
}

/** "r4c7", one-based, as puzzle discussion writes it. */
export function formatCell(cell: CellIndex): string {
  return `r${rowOf(cell) + 1}c${colOf(cell) + 1}`;
}

export function parseCell(s: string): CellIndex {
  const m = /^r([1-9])c([1-9])$/.exec(s.trim());
  if (!m) throw new Error(`not a cell reference: ${s}`);
  return cellAt(Number(m[1]) - 1, Number(m[2]) - 1);
}

export type UnitKind = "row" | "col" | "box";

export interface Unit {
  readonly index: number;
  readonly kind: UnitKind;
  /** Position of this unit among its own kind, 0..8. */
  readonly ordinal: number;
  readonly cells: readonly CellIndex[];
}

function buildUnits(): readonly Unit[] {
  const units: Unit[] = [];
  const push = (kind: UnitKind, ordinal: number, cells: CellIndex[]) => {
    units.push({ index: units.length, kind, ordinal, cells });
  };

  for (let r = 0; r < N; r++) {
    push("row", r, Array.from({ length: N }, (_, c) => cellAt(r, c)));
  }
  for (let c = 0; c < N; c++) {
    push("col", c, Array.from({ length: N }, (_, r) => cellAt(r, c)));
  }
  for (let b = 0; b < N; b++) {
    const r0 = ((b / BOX) | 0) * BOX;
    const c0 = (b % BOX) * BOX;
    const cells: CellIndex[] = [];
    for (let dr = 0; dr < BOX; dr++) {
      for (let dc = 0; dc < BOX; dc++) cells.push(cellAt(r0 + dr, c0 + dc));
    }
    push("box", b, cells);
  }
  return units;
}

/** All 27 units: 9 rows, then 9 columns, then 9 boxes. */
export const UNITS: readonly Unit[] = buildUnits();

export const ROWS: readonly Unit[] = UNITS.slice(0, N);
export const COLS: readonly Unit[] = UNITS.slice(N, 2 * N);
export const BOXES: readonly Unit[] = UNITS.slice(2 * N, 3 * N);

/** The three units (row, column, box) containing each cell. */
export const UNITS_OF: readonly (readonly Unit[])[] = (() => {
  const out: Unit[][] = Array.from({ length: CELLS }, () => []);
  for (const u of UNITS) for (const c of u.cells) (out[c] as Unit[]).push(u);
  return out;
})();

/** The 20 cells sharing a unit with each cell, excluding itself. */
export const PEERS: readonly (readonly CellIndex[])[] = (() => {
  const out: CellIndex[][] = [];
  for (let c = 0; c < CELLS; c++) {
    const set = new Set<CellIndex>();
    for (const u of UNITS_OF[c] as readonly Unit[]) {
      for (const p of u.cells) if (p !== c) set.add(p);
    }
    out.push([...set].sort((a, b) => a - b));
  }
  return out;
})();

const PEER_SETS: readonly ReadonlySet<CellIndex>[] = PEERS.map((p) => new Set(p));

/** Do these two cells share a row, column or box? */
export function sees(a: CellIndex, b: CellIndex): boolean {
  return (PEER_SETS[a] as ReadonlySet<CellIndex>).has(b);
}

/** Do all of these cells pairwise see one another? */
export function mutuallySee(cells: readonly CellIndex[]): boolean {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (!sees(cells[i] as CellIndex, cells[j] as CellIndex)) return false;
    }
  }
  return true;
}
