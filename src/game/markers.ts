/**
 * The marker catalogue, and the per-puzzle palette drawn from it.
 *
 * Every type here satisfies R7 — considered alone, each leaves at least two
 * candidates in every cell it touches — and R8's arity floor of two. The badges
 * are drawn on one cell but their relation ranges over that cell and a
 * neighbourhood, which is what keeps them on the right side of the arity rule
 * while "this cell is even" stays banned.
 *
 * R5 caps a puzzle at three types, and says the puzzle fixes its vocabulary at
 * generation time. `choosePalette` is that draw: a different small language
 * every game, so a puzzle is partly about working out what can be said in it.
 *
 * Placement is checked for *truth* against the solution, which is weaker than
 * R6's provability requirement. Two consequences worth knowing while playing:
 * a player can place a marker they could not yet have proved, and a refusal is
 * itself an oracle — being told "not true here" is information the player did
 * not earn. Both close when the two-player solver can decide what a player's
 * knowledge entails.
 */

import { ALL, type Digit, type Mask, maskOf } from "../engine/digits.js";
import type { Values } from "../engine/grid.js";
import type { Rng } from "../engine/rng.js";
import { type CellIndex, N, boxOf, colOf, rowOf } from "../engine/units.js";
import type { MarkerType } from "./types.js";

/** How a marker draws itself. Pair markers sit on the shared edge. */
export type MarkerGlyph =
  | { readonly kind: "dot"; readonly tone: "light" | "dark" }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "line"; readonly tone: string; readonly bulb?: boolean }
  | { readonly kind: "chevron" }
  | { readonly kind: "badge"; readonly text: string };

/** How consecutive selected cells must sit relative to one another. */
export type Adjacency = "none" | "orthogonal" | "king";

export interface MarkerDef {
  readonly type: MarkerType;
  readonly label: string;
  readonly hint: string;
  /** Fewest cells the player may select. */
  readonly minCells: number;
  /** Most cells, or null for an unbounded path. */
  readonly maxCells: number | null;
  readonly adjacency: Adjacency;
  /** The order of selection carries meaning (the first cell is the greater). */
  readonly directional: boolean;
  readonly glyph: MarkerGlyph;
  /**
   * The digits still possible for the cell at `index`, given this relation and
   * nothing else. This is R7's per-cell projection, and R8 uses it to check
   * that the markers piled on one cell cannot between them pin it to a digit.
   */
  projectionAt(index: number): Mask;
  /** Does this hold in the completed grid? */
  holds(solution: Values, cells: readonly CellIndex[]): boolean;
}

/** A marker drawn as a path through cell centres rather than on one border. */
export function isPath(def: MarkerDef): boolean {
  return def.maxCells === null;
}

// ---- geometry -------------------------------------------------------------

function offsets(cell: CellIndex, deltas: readonly (readonly [number, number])[]) {
  const r = rowOf(cell);
  const c = colOf(cell);
  const out: CellIndex[] = [];
  for (const [dr, dc] of deltas) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
    out.push(nr * N + nc);
  }
  return out;
}

export function knightTargets(cell: CellIndex): CellIndex[] {
  return offsets(cell, [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ]);
}

export function kingTargets(cell: CellIndex): CellIndex[] {
  return offsets(cell, [
    [-1, -1], [-1, 0], [-1, 1], [0, -1],
    [0, 1], [1, -1], [1, 0], [1, 1],
  ]);
}

export function orthogonalTargets(cell: CellIndex): CellIndex[] {
  return offsets(cell, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
}

/** Share an edge. */
export function areAdjacent(a: CellIndex, b: CellIndex): boolean {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
}

/** Share an edge or a corner — a king's move, which is what a line may follow. */
export function areKingAdjacent(a: CellIndex, b: CellIndex): boolean {
  const dr = Math.abs(rowOf(a) - rowOf(b));
  const dc = Math.abs(colOf(a) - colOf(b));
  return dr <= 1 && dc <= 1 && dr + dc > 0;
}

/** Do consecutive cells chain under this adjacency rule? */
export function isChain(cells: readonly CellIndex[], adjacency: Adjacency): boolean {
  if (adjacency === "none") return true;
  const linked = adjacency === "king" ? areKingAdjacent : areAdjacent;
  for (let i = 1; i < cells.length; i++) {
    if (!linked(cells[i - 1] as CellIndex, cells[i] as CellIndex)) return false;
  }
  return true;
}

// ---- definitions ----------------------------------------------------------

function pair(
  type: MarkerType,
  label: string,
  hint: string,
  glyph: MarkerGlyph,
  test: (x: Digit, y: Digit) => boolean,
  directional = false,
  projections?: readonly [Mask, Mask],
): MarkerDef {
  return {
    type,
    label,
    hint,
    minCells: 2,
    maxCells: 2,
    adjacency: "orthogonal",
    directional,
    glyph,
    projectionAt(index) {
      return projections?.[index as 0 | 1] ?? ALL;
    },
    holds(solution, cells) {
      const [a, b] = cells;
      if (a === undefined || b === undefined) return false;
      return test(solution[a] as Digit, solution[b] as Digit);
    },
  };
}

/**
 * A line of any length, running cell to cell by king's moves, whose relation
 * must hold of every consecutive pair along it — as a whisper line does.
 */
function path(
  type: MarkerType,
  label: string,
  hint: string,
  glyph: MarkerGlyph,
  test: (x: Digit, y: Digit) => boolean,
  projection: Mask = ALL,
): MarkerDef {
  return {
    type,
    label,
    hint,
    minCells: 2,
    maxCells: null,
    adjacency: "king",
    directional: false,
    glyph,
    projectionAt() {
      return projection;
    },
    holds(solution, cells) {
      if (cells.length < 2) return false;
      for (let i = 1; i < cells.length; i++) {
        const x = solution[cells[i - 1] as CellIndex] as Digit;
        const y = solution[cells[i] as CellIndex] as Digit;
        if (!test(x, y)) return false;
      }
      return true;
    },
  };
}

function badge(
  type: MarkerType,
  label: string,
  hint: string,
  text: string,
  targets: (cell: CellIndex) => CellIndex[],
  forbidden: (value: Digit, other: Digit) => boolean,
): MarkerDef {
  return {
    type,
    label,
    hint,
    minCells: 1,
    maxCells: 1,
    adjacency: "none",
    directional: false,
    glyph: { kind: "badge", text },
    // A badge is a pure disequality: it rules out nothing for its own cell.
    projectionAt() {
      return ALL;
    },
    holds(solution, cells) {
      const cell = cells[0];
      if (cell === undefined) return false;
      const value = solution[cell] as Digit;
      return targets(cell).every((t) => !forbidden(value, solution[t] as Digit));
    },
  };
}

/**
 * A line whose rule is about the whole run rather than each step.
 *
 * Whispers can be checked a pair at a time; a palindrome, a renban or a region
 * sum line cannot, so these take the digits of the entire line at once.
 */
function line(
  type: MarkerType,
  label: string,
  hint: string,
  glyph: MarkerGlyph,
  test: (digits: readonly Digit[], cells: readonly CellIndex[]) => boolean,
  options: {
    readonly minCells?: number;
    readonly directional?: boolean;
    readonly projectionAt?: (index: number) => Mask;
  } = {},
): MarkerDef {
  const minCells = options.minCells ?? 3;
  return {
    type,
    label,
    hint,
    minCells,
    maxCells: null,
    adjacency: "king",
    directional: options.directional ?? false,
    glyph,
    projectionAt(index) {
      return options.projectionAt?.(index) ?? ALL;
    },
    holds(solution, cells) {
      if (cells.length < minCells) return false;
      return test(
        cells.map((c) => solution[c] as Digit),
        cells,
      );
    },
  };
}

/** Which third of the digits a value falls in: low, middle or high. */
function band(digit: Digit): 0 | 1 | 2 {
  return Math.floor((digit - 1) / 3) as 0 | 1 | 2;
}

/** A line's runs of consecutive cells lying in the same box. */
function boxSegments(cells: readonly CellIndex[]): CellIndex[][] {
  const segments: CellIndex[][] = [];
  let current: CellIndex[] = [];
  for (const cell of cells) {
    const previous = current[current.length - 1];
    if (previous !== undefined && boxOf(previous) !== boxOf(cell)) {
      segments.push(current);
      current = [];
    }
    current.push(cell);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

export const MARKER_DEFS: Readonly<Record<MarkerType, MarkerDef>> = {
  consecutive: pair(
    "consecutive",
    "Consecutive",
    "Two adjacent cells differing by one. A white dot, as in kropki.",
    { kind: "dot", tone: "light" },
    (x, y) => Math.abs(x - y) === 1,
  ),
  double: pair(
    "double",
    "Double",
    "One is twice the other. A black dot: only 1/2, 2/4, 4/8 and 3/6 qualify, so 5, 7 and 9 are ruled out.",
    { kind: "dot", tone: "dark" },
    (x, y) => x === 2 * y || y === 2 * x,
    false,
    [maskOf([1, 2, 3, 4, 6, 8]), maskOf([1, 2, 3, 4, 6, 8])],
  ),
  sum5: pair(
    "sum5",
    "Sum 5",
    "The pair adds to 5, so it is 1+4 or 2+3.",
    { kind: "text", text: "V" },
    (x, y) => x + y === 5,
    false,
    [maskOf([1, 2, 3, 4]), maskOf([1, 2, 3, 4])],
  ),
  sum10: pair(
    "sum10",
    "Sum 10",
    "The pair adds to 10, so one is low and one is high, and neither is 5.",
    { kind: "text", text: "X" },
    (x, y) => x + y === 10,
    false,
    [maskOf([1, 2, 3, 4, 6, 7, 8, 9]), maskOf([1, 2, 3, 4, 6, 7, 8, 9])],
  ),
  whisper: path(
    "whisper",
    "German whisper",
    "Neighbours along the line differ by at least 5, so no cell on it is 5 and the line alternates low and high.",
    { kind: "line", tone: "whisper" },
    (x, y) => Math.abs(x - y) >= 5,
    maskOf([1, 2, 3, 4, 6, 7, 8, 9]),
  ),
  dutchWhisper: path(
    "dutchWhisper",
    "Dutch whisper",
    "Neighbours differ by at least 4. Weaker than a German whisper: every digit can appear, and the line only alternates low and high where 5 is ruled out.",
    { kind: "line", tone: "dutch" },
    (x, y) => Math.abs(x - y) >= 4,
  ),
  palindrome: line(
    "palindrome",
    "Palindrome",
    "The line reads the same from either end, so cells the same distance from the middle hold the same digit. Every elimination on one counts twice.",
    { kind: "line", tone: "palindrome" },
    (digits) => digits.every((d, i) => d === digits[digits.length - 1 - i]),
  ),
  renban: line(
    "renban",
    "Renban",
    "The line holds a set of consecutive digits in some order, with no repeats. Five cells or more must contain a 5.",
    { kind: "line", tone: "renban" },
    (digits) => {
      const seen = new Set(digits);
      if (seen.size !== digits.length) return false;
      return Math.max(...digits) - Math.min(...digits) === digits.length - 1;
    },
  ),
  thermo: line(
    "thermo",
    "Thermometer",
    "Digits increase strictly from the bulb. Draw it starting at the bulb: 1 can only sit there, and 9 only at the far tip.",
    { kind: "line", tone: "thermo", bulb: true },
    (digits) => digits.every((d, i) => i === 0 || d > (digits[i - 1] as Digit)),
    {
      minCells: 2,
      directional: true,
      // The bulb is never 9, and nothing past the bulb is ever 1.
      projectionAt: (index) =>
        index === 0 ? maskOf([1, 2, 3, 4, 5, 6, 7, 8]) : maskOf([2, 3, 4, 5, 6, 7, 8, 9]),
    },
  ),
  regionSum: line(
    "regionSum",
    "Region sum line",
    "Box borders cut the line into segments, and every segment adds to the same total. The line has to cross at least one border to say anything.",
    { kind: "line", tone: "region" },
    (digits, cells) => {
      const segments = boxSegments(cells);
      if (segments.length < 2) return false;
      const value = new Map(cells.map((c, i) => [c, digits[i] as Digit]));
      const total = (segment: CellIndex[]) =>
        segment.reduce((sum, c) => sum + (value.get(c) as number), 0);
      const first = total(segments[0] as CellIndex[]);
      return segments.every((segment) => total(segment) === first);
    },
  ),
  entropic: line(
    "entropic",
    "Entropic line",
    "Any three cells in a row along the line hold one low digit (1 to 3), one middle (4 to 6) and one high (7 to 9). The bands then repeat in a fixed cycle.",
    { kind: "line", tone: "entropic" },
    (digits) => {
      for (let i = 2; i < digits.length; i++) {
        const window = new Set([
          band(digits[i - 2] as Digit),
          band(digits[i - 1] as Digit),
          band(digits[i] as Digit),
        ]);
        if (window.size !== 3) return false;
      }
      return true;
    },
  ),
  greater: pair(
    "greater",
    "Greater than",
    "Select the larger cell first. The chevron points at the smaller.",
    { kind: "chevron" },
    (x, y) => x > y,
    true,
    [maskOf([2, 3, 4, 5, 6, 7, 8, 9]), maskOf([1, 2, 3, 4, 5, 6, 7, 8])],
  ),
  sameParity: pair(
    "sameParity",
    "Same parity",
    "Both odd or both even.",
    { kind: "text", text: "=" },
    (x, y) => x % 2 === y % 2,
  ),
  oppositeParity: pair(
    "oppositeParity",
    "Opposite parity",
    "One odd, one even.",
    { kind: "text", text: "≠" },
    (x, y) => x % 2 !== y % 2,
  ),
  knight: badge(
    "knight",
    "Knight badge",
    "This digit does not repeat a knight's move away. A pure disequality — it can never name a value.",
    "♞",
    knightTargets,
    (value, other) => value === other,
  ),
  king: badge(
    "king",
    "King badge",
    "This digit does not repeat in any of the eight cells it touches.",
    "♚",
    kingTargets,
    (value, other) => value === other,
  ),
  nonConsecutive: badge(
    "nonConsecutive",
    "No neighbours",
    "No cell sharing an edge with this one holds a consecutive digit.",
    "⊘",
    orthogonalTargets,
    (value, other) => Math.abs(value - other) === 1,
  ),
};

export const ALL_MARKER_TYPES = Object.keys(MARKER_DEFS) as MarkerType[];

// ---- palette --------------------------------------------------------------

/** R5's cap: a puzzle fixes at most three marker types. */
export const MAX_PALETTE = 3;

/** How many true instances a type needs before it is worth putting in a palette. */
const MIN_INSTANCES = 4;

/**
 * Count the places a marker type could legally be used on this grid.
 *
 * Authoring, so consulting the solution is fine (docs/rules.md §10 draws the
 * line at *proving*). A palette holding a type with no instances would be a
 * button that never works.
 */
/**
 * Adjacency tables, built once.
 *
 * `countInstances` walks every short path on the grid for every candidate
 * marker type, every time a puzzle is generated. Recomputing neighbours inside
 * that walk made it the slowest thing in the app by a wide margin.
 */
function neighbourTable(linked: (a: CellIndex, b: CellIndex) => boolean): CellIndex[][] {
  return Array.from({ length: N * N }, (_, cell) => {
    const out: CellIndex[] = [];
    for (let other = 0; other < N * N; other++) if (linked(cell, other)) out.push(other);
    return out;
  });
}

const KING_NEIGHBOURS = neighbourTable(areKingAdjacent);
const EDGE_NEIGHBOURS = neighbourTable(areAdjacent);

export function countInstances(def: MarkerDef, solution: Values): number {
  if (def.adjacency === "none") {
    let found = 0;
    for (let cell = 0; cell < N * N; cell++) {
      if (def.holds(solution, [cell])) found++;
    }
    return found;
  }

  // Enumerate paths of exactly the shortest legal length. A line that needs
  // three cells has no two-cell instances, and counting only those would drop
  // it from every palette.
  const table = def.adjacency === "king" ? KING_NEIGHBOURS : EDGE_NEIGHBOURS;
  const neighbours = (cell: CellIndex): readonly CellIndex[] => table[cell] as CellIndex[];

  let found = 0;
  const walk = (path: CellIndex[]): void => {
    if (path.length === def.minCells) {
      if (def.holds(solution, path)) found++;
      return;
    }
    for (const next of neighbours(path[path.length - 1] as CellIndex)) {
      if (path.includes(next)) continue;
      path.push(next);
      walk(path);
      path.pop();
    }
  };
  for (let cell = 0; cell < N * N; cell++) walk([cell]);

  // Undirected lines are found once from each end.
  return def.directional ? found : Math.ceil(found / 2);
}

/**
 * Draw this puzzle's palette: up to three types, chosen at random from the
 * catalogue and filtered to those that actually occur on this grid.
 */
export function choosePalette(
  rng: Rng,
  solution: Values,
  size = MAX_PALETTE,
): MarkerType[] {
  const usable = ALL_MARKER_TYPES.filter(
    (type) => countInstances(MARKER_DEFS[type], solution) >= MIN_INSTANCES,
  );
  rng.shuffle(usable);

  const chosen = usable.slice(0, Math.min(size, MAX_PALETTE));
  // A grid with almost no usable types is vanishingly unlikely, but a palette
  // must never come back empty.
  if (chosen.length === 0) chosen.push("consecutive");
  return chosen;
}
