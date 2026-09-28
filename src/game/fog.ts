/**
 * Fog state, shape and reveals.
 *
 * The starting fog is *grown*, not cut. A straight split reads as a diagram
 * rather than a fog bank, and it is the same board every game. Instead two
 * visible regions grow outward from random seeds, which gives an organic
 * coastline and a different shape from every seed, while still satisfying the
 * rules the spec insists on:
 *
 *   R10a — each player's visible region and fogged region are both a single
 *          orthogonally connected area.
 *   R10b — no cell is visible to both players. Cells claimed by neither are
 *          fogged for both: the no-man's-land that only deduction reaches.
 *
 * A correct placement clears fog on the placer's own board only (R11), so the
 * asymmetry lasts the whole game rather than converging on both players seeing
 * everything. The neighbourhood shape used here is a placeholder for the
 * authored reveal graph the generator will site where its own solve stalled.
 */

import type { Rng } from "../engine/rng.js";
import { CELLS, type CellIndex, N, colOf, rowOf } from "../engine/units.js";
import { PLAYERS, type PlayerId } from "./types.js";

export type FogState = Record<PlayerId, Uint8Array>;

export interface FogShapeOptions {
  /** How many cells each player can see at the start. */
  readonly visiblePerPlayer?: number;
  /** Minimum Manhattan distance between the two seed cells. */
  readonly seedSeparation?: number;
}

/** The up-to-four cells sharing an edge. Connectivity is orthogonal only. */
export function orthogonalNeighbours(cell: CellIndex): CellIndex[] {
  const r = rowOf(cell);
  const c = colOf(cell);
  const out: CellIndex[] = [];
  if (r > 0) out.push(cell - N);
  if (r < N - 1) out.push(cell + N);
  if (c > 0) out.push(cell - 1);
  if (c < N - 1) out.push(cell + 1);
  return out;
}

/** The cell itself plus the up-to-eight cells it touches. */
export function neighbourhood(cell: CellIndex): CellIndex[] {
  const r = rowOf(cell);
  const c = colOf(cell);
  const out: CellIndex[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      out.push(nr * N + nc);
    }
  }
  return out;
}

/** Is the set picked out by `member` a single orthogonally connected area? */
export function isConnected(member: (cell: CellIndex) => boolean): boolean {
  let start = -1;
  let total = 0;
  for (let c = 0; c < CELLS; c++) {
    if (member(c)) {
      if (start < 0) start = c;
      total++;
    }
  }
  if (total === 0) return true;

  const seen = new Uint8Array(CELLS);
  const stack = [start];
  seen[start] = 1;
  let reached = 0;
  while (stack.length > 0) {
    const cell = stack.pop() as CellIndex;
    reached++;
    for (const n of orthogonalNeighbours(cell)) {
      if (seen[n] === 0 && member(n)) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return reached === total;
}

function manhattan(a: CellIndex, b: CellIndex): number {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b));
}

/**
 * Grow two disjoint visible regions from random seeds.
 *
 * Each growth step adds one cell and is rejected if it would break the
 * growing player's *fogged* region into pieces — their visible region stays
 * connected for free, since it only ever grows by adjacency. The two players
 * take turns so neither can starve the other of room.
 */
export function initialFog(rng: Rng, options: FogShapeOptions = {}): FogState {
  const { visiblePerPlayer = 34, seedSeparation = 8 } = options;

  let seedA = rng.int(CELLS);
  let seedB = rng.int(CELLS);
  for (let tries = 0; manhattan(seedA, seedB) < seedSeparation && tries < 200; tries++) {
    seedA = rng.int(CELLS);
    seedB = rng.int(CELLS);
  }

  const owner = new Int8Array(CELLS).fill(-1);
  const seeds: Record<PlayerId, CellIndex> = { A: seedA, B: seedB };
  const sizes: Record<PlayerId, number> = { A: 1, B: 1 };
  const index: Record<PlayerId, number> = { A: 0, B: 1 };
  owner[seedA] = 0;
  owner[seedB] = 1;

  let stalled = 0;
  while (stalled < PLAYERS.length) {
    stalled = 0;
    for (const player of PLAYERS) {
      if (sizes[player] >= visiblePerPlayer) {
        stalled++;
        continue;
      }
      if (!growOnce(owner, index[player], rng)) {
        stalled++;
        continue;
      }
      sizes[player]++;
    }
  }

  const fog: FogState = {
    A: new Uint8Array(CELLS).fill(1),
    B: new Uint8Array(CELLS).fill(1),
  };
  for (let cell = 0; cell < CELLS; cell++) {
    if (owner[cell] === 0) fog.A[cell] = 0;
    if (owner[cell] === 1) fog.B[cell] = 0;
  }
  // Seeds are always visible, whatever the growth did.
  fog.A[seeds.A] = 0;
  fog.B[seeds.B] = 0;
  return fog;
}

function growOnce(owner: Int8Array, player: number, rng: Rng): boolean {
  const frontier: CellIndex[] = [];
  for (let cell = 0; cell < CELLS; cell++) {
    if (owner[cell] !== -1) continue;
    if (orthogonalNeighbours(cell).some((n) => owner[n] === player)) frontier.push(cell);
  }
  rng.shuffle(frontier);

  for (const candidate of frontier) {
    owner[candidate] = player as 0 | 1;
    // The player's fog is everything they do not own; it must stay in one piece.
    if (isConnected((c) => owner[c] !== player)) return true;
    owner[candidate] = -1;
  }
  return false;
}

export function isHidden(fog: FogState, player: PlayerId, cell: CellIndex): boolean {
  return fog[player][cell] === 1;
}

/**
 * Lift fog on one player's board for a correct placement they made. Returns the
 * cells that actually changed, so the UI can animate only those.
 *
 * Monotone by construction (R12): fog is only ever cleared, never restored.
 */
export function reveal(fog: FogState, player: PlayerId, cell: CellIndex): CellIndex[] {
  const changed: CellIndex[] = [];
  for (const target of neighbourhood(cell)) {
    if (fog[player][target] === 1) {
      fog[player][target] = 0;
      changed.push(target);
    }
  }
  return changed;
}

export function fogCount(fog: FogState, player: PlayerId): number {
  let n = 0;
  for (let c = 0; c < CELLS; c++) if (fog[player][c] === 1) n++;
  return n;
}
