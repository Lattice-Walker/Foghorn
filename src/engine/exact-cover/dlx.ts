/**
 * Exact-cover (Algorithm X with dancing links) solver for sudoku.
 *
 * QUARANTINED. See ./README.md — docs/rules.md G5.
 *
 * This is brute force. It exists to answer one question that is a mathematical
 * property of a clue set rather than a claim about human solving: does this clue
 * set have exactly one completion? Nothing on the technique-solving or difficulty-
 * rating path may import it, and `quarantine.test.ts` enforces that.
 */

import type { Digit } from "../digits.js";
import { CELLS, N, boxOf, colOf, rowOf } from "../units.js";
import type { Values } from "../grid.js";

const COLUMNS = 4 * CELLS; // cell filled, row-digit, col-digit, box-digit
const ROWS = CELLS * N; // (cell, digit)
const NODES_PER_ROW = 4;

const ROOT = 0;
const FIRST_COLUMN = 1; // column j lives at node FIRST_COLUMN + j
const FIRST_NODE = FIRST_COLUMN + COLUMNS;
const TOTAL_NODES = FIRST_NODE + ROWS * NODES_PER_ROW;

function rowIdOf(cell: number, digit: Digit): number {
  return cell * N + (digit - 1);
}

function columnsOfRow(cell: number, digit: Digit): [number, number, number, number] {
  const d = digit - 1;
  return [
    cell,
    CELLS + rowOf(cell) * N + d,
    2 * CELLS + colOf(cell) * N + d,
    3 * CELLS + boxOf(cell) * N + d,
  ];
}

interface Matrix {
  readonly L: Int32Array;
  readonly R: Int32Array;
  readonly U: Int32Array;
  readonly D: Int32Array;
  readonly col: Int32Array;
  readonly rowId: Int32Array;
  readonly size: Int32Array;
  /** First node of each matrix row, indexed by rowId. */
  readonly rowHead: Int32Array;
}

function buildMatrix(): Matrix {
  const L = new Int32Array(TOTAL_NODES);
  const R = new Int32Array(TOTAL_NODES);
  const U = new Int32Array(TOTAL_NODES);
  const D = new Int32Array(TOTAL_NODES);
  const col = new Int32Array(TOTAL_NODES);
  const rowId = new Int32Array(TOTAL_NODES).fill(-1);
  const size = new Int32Array(COLUMNS);
  const rowHead = new Int32Array(ROWS);

  // Header ring: root <-> every column header.
  for (let j = 0; j < COLUMNS; j++) {
    const h = FIRST_COLUMN + j;
    col[h] = j;
    U[h] = h;
    D[h] = h;
    L[h] = j === 0 ? ROOT : FIRST_COLUMN + j - 1;
    R[h] = j === COLUMNS - 1 ? ROOT : FIRST_COLUMN + j + 1;
  }
  R[ROOT] = COLUMNS > 0 ? FIRST_COLUMN : ROOT;
  L[ROOT] = COLUMNS > 0 ? FIRST_COLUMN + COLUMNS - 1 : ROOT;

  let node = FIRST_NODE;
  for (let cell = 0; cell < CELLS; cell++) {
    for (let d = 1 as Digit; d <= 9; d = (d + 1) as Digit) {
      const rid = rowIdOf(cell, d);
      const cols = columnsOfRow(cell, d);
      rowHead[rid] = node;
      for (let k = 0; k < NODES_PER_ROW; k++) {
        const n = node + k;
        const c = cols[k] as number;
        const h = FIRST_COLUMN + c;
        col[n] = c;
        rowId[n] = rid;
        L[n] = node + ((k + NODES_PER_ROW - 1) % NODES_PER_ROW);
        R[n] = node + ((k + 1) % NODES_PER_ROW);
        // Append to the bottom of column c.
        U[n] = U[h] as number;
        D[n] = h;
        D[U[h] as number] = n;
        U[h] = n;
        size[c] = (size[c] as number) + 1;
      }
      node += NODES_PER_ROW;
    }
  }

  return { L, R, U, D, col, rowId, size, rowHead };
}

class Dlx {
  private readonly m: Matrix;
  private readonly stack: number[] = [];

  constructor() {
    this.m = buildMatrix();
  }

  private cover(c: number): void {
    const { L, R, U, D, col, size } = this.m;
    const h = FIRST_COLUMN + c;
    L[R[h] as number] = L[h] as number;
    R[L[h] as number] = R[h] as number;
    for (let i = D[h] as number; i !== h; i = D[i] as number) {
      for (let j = R[i] as number; j !== i; j = R[j] as number) {
        U[D[j] as number] = U[j] as number;
        D[U[j] as number] = D[j] as number;
        size[col[j] as number] = (size[col[j] as number] as number) - 1;
      }
    }
  }

  private uncover(c: number): void {
    const { L, R, U, D, col, size } = this.m;
    const h = FIRST_COLUMN + c;
    for (let i = U[h] as number; i !== h; i = U[i] as number) {
      for (let j = L[i] as number; j !== i; j = L[j] as number) {
        size[col[j] as number] = (size[col[j] as number] as number) + 1;
        U[D[j] as number] = j;
        D[U[j] as number] = j;
      }
    }
    L[R[h] as number] = h;
    R[L[h] as number] = h;
  }

  /** Cover every column of a row, as if that row were chosen. */
  private selectRow(node: number): void {
    const { R, col } = this.m;
    this.cover(col[node] as number);
    for (let j = R[node] as number; j !== node; j = R[j] as number) {
      this.cover(col[j] as number);
    }
  }

  private deselectRow(node: number): void {
    const { L, col } = this.m;
    for (let j = L[node] as number; j !== node; j = L[j] as number) {
      this.uncover(col[j] as number);
    }
    this.uncover(col[node] as number);
  }

  /** The uncovered column with the fewest remaining rows, or -1 if none left. */
  private chooseColumn(): number {
    const { R, size, col } = this.m;
    let best = -1;
    let bestSize = Infinity;
    for (let h = R[ROOT] as number; h !== ROOT; h = R[h] as number) {
      const c = col[h] as number;
      const s = size[c] as number;
      if (s < bestSize) {
        bestSize = s;
        best = c;
        if (s <= 1) break;
      }
    }
    return best;
  }

  /**
   * Search, stopping once `limit` solutions have been found.
   * Returns how many were found; `onSolution` sees each one.
   */
  private search(
    limit: number,
    found: { n: number },
    onSolution: ((rows: readonly number[]) => void) | undefined,
    order: ((rows: number[]) => void) | undefined,
  ): void {
    if (found.n >= limit) return;
    const { R, D, rowId } = this.m;
    if ((R[ROOT] as number) === ROOT) {
      found.n++;
      onSolution?.(this.stack.map((n) => rowId[n] as number));
      return;
    }
    const c = this.chooseColumn();
    if (c < 0 || (this.m.size[c] as number) === 0) return;

    const h = FIRST_COLUMN + c;
    const candidates: number[] = [];
    for (let i = D[h] as number; i !== h; i = D[i] as number) candidates.push(i);
    order?.(candidates);

    this.cover(c);
    for (const i of candidates) {
      this.stack.push(i);
      const { R: RR, col } = this.m;
      for (let j = RR[i] as number; j !== i; j = RR[j] as number) {
        this.cover(col[j] as number);
      }
      this.search(limit, found, onSolution, order);
      const { L, col: col2 } = this.m;
      for (let j = L[i] as number; j !== i; j = L[j] as number) {
        this.uncover(col2[j] as number);
      }
      this.stack.pop();
      if (found.n >= limit) break;
    }
    this.uncover(c);
  }

  /**
   * Apply givens, then search. Returns null if the givens already conflict.
   */
  run(
    values: Values,
    limit: number,
    onSolution?: (rows: readonly number[]) => void,
    order?: (rows: number[]) => void,
  ): number | null {
    const applied: number[] = [];
    for (let cell = 0; cell < CELLS; cell++) {
      const d = values[cell];
      if (!d) continue;
      const node = this.m.rowHead[rowIdOf(cell, d)] as number;
      if (!this.rowIsAvailable(node)) {
        for (let i = applied.length - 1; i >= 0; i--) {
          this.deselectRow(applied[i] as number);
        }
        return null;
      }
      this.selectRow(node);
      this.stack.push(node);
      applied.push(node);
    }

    const found = { n: 0 };
    this.search(limit, found, onSolution, order);

    for (let i = applied.length - 1; i >= 0; i--) {
      this.stack.pop();
      this.deselectRow(applied[i] as number);
    }
    return found.n;
  }

  /** A row is still available when none of its columns has been covered. */
  private rowIsAvailable(node: number): boolean {
    const { R, col, L, D, U } = this.m;
    const check = (n: number): boolean => {
      const c = col[n] as number;
      const h = FIRST_COLUMN + c;
      // Covered columns are unlinked from the header ring.
      if ((R[L[h] as number] as number) !== h) return false;
      // The row's node must still be linked into its column.
      return (D[U[n] as number] as number) === n;
    };
    if (!check(node)) return false;
    for (let j = R[node] as number; j !== node; j = R[j] as number) {
      if (!check(j)) return false;
    }
    return true;
  }
}

function rowsToValues(rows: readonly number[]): Values {
  const out = new Array<Digit | 0>(CELLS).fill(0);
  for (const rid of rows) {
    out[(rid / N) | 0] = ((rid % N) + 1) as Digit;
  }
  return out;
}

/**
 * How many completions does this clue set have, counting no further than `limit`?
 * Conflicting givens give 0.
 */
export function countSolutions(values: Values, limit = 2): number {
  return new Dlx().run(values, limit) ?? 0;
}

/** Exactly one completion? This is the generator's uniqueness gate. */
export function hasUniqueSolution(values: Values): boolean {
  return countSolutions(values, 2) === 1;
}

/** The first completion found, or null if there is none. */
export function solve(values: Values): Values | null {
  let result: Values | null = null;
  new Dlx().run(values, 1, (rows) => {
    result = rowsToValues(rows);
  });
  return result;
}

/**
 * A completion chosen with the given shuffler deciding branch order.
 * Used by the full-grid generator to get an unbiased random solution.
 */
export function solveWithOrder(
  values: Values,
  shuffle: (rows: number[]) => void,
): Values | null {
  let result: Values | null = null;
  new Dlx().run(
    values,
    1,
    (rows) => {
      result = rowsToValues(rows);
    },
    shuffle,
  );
  return result;
}
