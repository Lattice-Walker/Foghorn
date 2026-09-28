/**
 * Hot-seat game state: both players in one browser, no networking.
 *
 * Each player has their **own** board. They are solving the same puzzle from
 * different partial views, not taking turns on one grid, and the game is won
 * only when both grids are finished. Filling a cell does nothing for your
 * partner — they have to reach it themselves.
 *
 * What each player holds privately: their board, their pencil marks, their
 * colours, their fog. What is shared: the markers, which show through fog on
 * both boards, and which are the only channel between the two players.
 *
 * A player may only place a marker on cells they can currently see. That is a
 * weak stand-in for R6's provability rule — you cannot truthfully assert a
 * relation among cells in your own fog — and it is also why a marker is worth
 * anything: it lands where the sender can see and the receiver cannot.
 *
 * Verification is client-side against the solution, which docs/rules.md R3
 * settles as acceptable: Foghorn is co-operative and trust-based, and a player
 * who digs the answers out of devtools has destroyed their own game.
 */

import { ALL, type Digit, type Mask, bit, count } from "../engine/digits.js";
import { carve, clueCount, randomSolution } from "../engine/generate.js";
import type { Values } from "../engine/grid.js";
import { type Difficulty, rate } from "../engine/rate.js";
import { makeRng } from "../engine/rng.js";
import { CELLS, type CellIndex, PEERS, formatCell } from "../engine/units.js";
import { type FogState, fogCount, initialFog, isHidden, reveal } from "./fog.js";
import { MARKER_DEFS, choosePalette, isChain, isPath } from "./markers.js";
import {
  type InputMode,
  type Marker,
  type MarkerType,
  PLAYERS,
  type PlaceResult,
  type PlayerId,
} from "./types.js";

interface PlayerNotes {
  corner: Uint16Array;
  centre: Uint16Array;
  colour: Uint8Array;
}

interface Snapshot {
  boards: Record<PlayerId, Int8Array>;
  fog: Record<PlayerId, Uint8Array>;
  notes: Record<PlayerId, PlayerNotes>;
  markers: Marker[];
  wrongGuesses: Record<PlayerId, number>;
}

function emptyNotes(): PlayerNotes {
  return {
    corner: new Uint16Array(CELLS),
    centre: new Uint16Array(CELLS),
    colour: new Uint8Array(CELLS),
  };
}

function cloneNotes(n: PlayerNotes): PlayerNotes {
  return { corner: n.corner.slice(), centre: n.centre.slice(), colour: n.colour.slice() };
}

/**
 * R8, the no-covert-stacking rule, enforced as what it is actually for.
 *
 * It used to be a flat cap of two markers per cell. That was crude, and it
 * broke outright once markers could be paths: a five-cell whisper line spends
 * cap on five cells at once, so a legal badge or dot elsewhere on the line
 * would be refused for no reason a player could see.
 *
 * The real requirement is that markers piled on one cell must not between them
 * name its digit. Each marker type knows the digits it leaves possible for a
 * cell, considered alone (R7's projection); intersect those across every
 * marker touching the cell, and refuse only if fewer than two survive.
 *
 * This permits everything the old rule permitted and stops forbidding what it
 * never needed to.
 */
export function conjunctionAt(
  markers: readonly Marker[],
  cell: CellIndex,
): Mask {
  let mask = ALL;
  for (const marker of markers) {
    const index = marker.cells.indexOf(cell);
    if (index >= 0) mask &= MARKER_DEFS[marker.type].projectionAt(index);
  }
  return mask;
}

export interface MarkerAttempt {
  readonly ok: boolean;
  readonly reason?: string;
}

export interface PlayerProgress {
  readonly filled: number;
  readonly wrongGuesses: number;
  readonly fogRemaining: number;
  readonly complete: boolean;
}

export interface SessionSummary {
  readonly seed: string;
  readonly clues: number;
  readonly difficulty: string;
  readonly markers: number;
  readonly progress: Record<PlayerId, PlayerProgress>;
  readonly won: boolean;
}

export class Session {
  readonly seed: string;
  readonly solution: Values;
  readonly givens: Values;
  readonly difficultyLabel: string;
  /**
   * What the technique solver made of this puzzle, solved classically with the
   * whole grid in sight. It says nothing about the fogged two-player solve —
   * cooperation depth and interleaving, the other two axes of docs/rules.md
   * §8, need the two-player solver that does not exist yet.
   */
  readonly difficulty: Difficulty;
  /** The marker types legal in this puzzle, drawn at generation time (R5). */
  readonly palette: readonly MarkerType[];

  boards: Record<PlayerId, Int8Array>;
  fog: FogState;
  notes: Record<PlayerId, PlayerNotes>;
  markers: Marker[] = [];
  wrongGuesses: Record<PlayerId, number> = { A: 0, B: 0 };

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private markerSeq = 0;
  /**
   * Markers received from the other player, kept apart from the undo history.
   *
   * Undo restores a whole snapshot, which would otherwise rip out a partner's
   * markers because they happened to arrive after the step being undone. Your
   * history is yours; their markers are not in it.
   */
  private readonly remote = new Map<string, Marker>();

  constructor(seed: string, targetClues = 36) {
    this.seed = seed;
    const rng = makeRng(seed);
    this.solution = randomSolution(rng);
    this.givens = carve(this.solution, rng, { targetClues });
    this.difficulty = rate(this.givens);
    this.difficultyLabel = this.difficulty.label;

    // A separate stream so the fog shape does not shift when puzzle
    // generation changes, and vice versa.
    this.fog = initialFog(makeRng(`${seed}:fog`));
    // Its own stream, so the vocabulary does not shift when fog or puzzle
    // generation changes.
    this.palette = choosePalette(makeRng(`${seed}:palette`), this.solution);
    this.notes = { A: emptyNotes(), B: emptyNotes() };
    this.boards = { A: new Int8Array(CELLS), B: new Int8Array(CELLS) };

    // A player starts with only the givens they can see. The rest arrive as
    // their own fog lifts.
    for (const player of PLAYERS) {
      for (let cell = 0; cell < CELLS; cell++) {
        if (!this.isHiddenFor(player, cell)) {
          this.boards[player][cell] = (this.givens[cell] ?? 0) as number;
        }
      }
    }
  }

  // ---- queries -----------------------------------------------------------

  isGiven(cell: CellIndex): boolean {
    return (this.givens[cell] ?? 0) !== 0;
  }

  /** A given this player can see, and therefore may not edit. */
  isGivenFor(player: PlayerId, cell: CellIndex): boolean {
    return this.isGiven(cell) && !this.isHiddenFor(player, cell);
  }

  isHiddenFor(player: PlayerId, cell: CellIndex): boolean {
    return isHidden(this.fog, player, cell);
  }

  /**
   * Is this cell in sight for *both* players?
   *
   * It never is at the start (R10b), so a shared cell is always something the
   * solve earned: one player's reveal reached into ground the other already
   * held. That is the moment the two boards stop being independent, and it is
   * worth showing — a marker drawn there is one both can check.
   */
  isSharedSight(cell: CellIndex): boolean {
    return !this.isHiddenFor("A", cell) && !this.isHiddenFor("B", cell);
  }

  valueAt(player: PlayerId, cell: CellIndex): Digit | 0 {
    return this.boards[player][cell] as Digit | 0;
  }

  isWrong(player: PlayerId, cell: CellIndex): boolean {
    const v = this.boards[player][cell] as number;
    return v !== 0 && v !== this.solution[cell];
  }

  /**
   * Holds the right digit on this player's board, so it is settled. Nothing is
   * lost by locking it: you can never need to change a correct digit.
   */
  isConfirmed(player: PlayerId, cell: CellIndex): boolean {
    const v = this.boards[player][cell] as number;
    return v !== 0 && v === this.solution[cell];
  }

  /**
   * Digits already standing in this cell's row, column or box on the player's
   * own board — givens and their own entries alike. A pencil mark for one of
   * these contradicts the grid in front of them and is flagged.
   *
   * Deliberately computed from the board and never from the solution. Checking
   * a mark against the answer would quietly hand over the puzzle; checking it
   * against what the player can already see only catches their slips.
   *
   * A wrong entry therefore poisons its own neighbourhood, which is correct:
   * it really does contradict those marks, and it is already shown in red, so
   * the player can see why.
   */
  peerDigits(player: PlayerId, cell: CellIndex): Mask {
    let mask = 0;
    for (const peer of PEERS[cell] as readonly CellIndex[]) {
      const value = this.boards[player][peer] as number;
      if (value !== 0) mask |= bit(value as Digit);
    }
    return mask;
  }

  /**
   * Every cell where this player is showing `digit`: as their entered digit or
   * a given they can see, or as one of their pencil marks.
   *
   * Fog is not consulted. What is on a player's own board shows through it
   * anyway, so a hidden cell they have pencilled is still theirs to find.
   */
  cellsShowing(player: PlayerId, digit: Digit): CellIndex[] {
    const wanted = bit(digit);
    const notes = this.notes[player];
    const out: CellIndex[] = [];

    for (let cell = 0; cell < CELLS; cell++) {
      const value = this.boards[player][cell] as number;
      if (value === digit) {
        out.push(cell);
      } else if (
        value === 0 &&
        (((notes.corner[cell] as number) & wanted) !== 0 ||
          ((notes.centre[cell] as number) & wanted) !== 0)
      ) {
        out.push(cell);
      }
    }
    return out;
  }

  isCompleteFor(player: PlayerId): boolean {
    for (let c = 0; c < CELLS; c++) {
      if (this.boards[player][c] !== this.solution[c]) return false;
    }
    return true;
  }

  /** Both grids finished. Neither player wins alone. */
  isWon(): boolean {
    return PLAYERS.every((p) => this.isCompleteFor(p));
  }

  progress(player: PlayerId): PlayerProgress {
    let filled = 0;
    for (let c = 0; c < CELLS; c++) if (this.boards[player][c] !== 0) filled++;
    return {
      filled,
      wrongGuesses: this.wrongGuesses[player],
      fogRemaining: fogCount(this.fog, player),
      complete: this.isCompleteFor(player),
    };
  }

  summary(): SessionSummary {
    return {
      seed: this.seed,
      clues: clueCount(this.givens),
      difficulty: this.difficultyLabel,
      markers: this.markers.length,
      progress: { A: this.progress("A"), B: this.progress("B") },
      won: this.isWon(),
    };
  }

  // ---- history -----------------------------------------------------------

  private snapshot(): Snapshot {
    return {
      boards: { A: this.boards.A.slice(), B: this.boards.B.slice() },
      fog: { A: this.fog.A.slice(), B: this.fog.B.slice() },
      notes: { A: cloneNotes(this.notes.A), B: cloneNotes(this.notes.B) },
      markers: [...this.markers],
      wrongGuesses: { ...this.wrongGuesses },
    };
  }

  private restore(s: Snapshot): void {
    this.boards = { A: s.boards.A.slice(), B: s.boards.B.slice() };
    this.fog = { A: s.fog.A.slice(), B: s.fog.B.slice() };
    this.notes = { A: cloneNotes(s.notes.A), B: cloneNotes(s.notes.B) };
    this.markers = [...s.markers];
    this.wrongGuesses = { ...s.wrongGuesses };

    // Put the partner's markers back: they were never part of this history.
    for (const marker of this.remote.values()) {
      if (!this.markers.some((m) => m.id === marker.id)) this.markers.push(marker);
    }
  }

  private checkpoint(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 250) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(this.snapshot());
    this.restore(previous);
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.snapshot());
    this.restore(next);
    return true;
  }

  // ---- input -------------------------------------------------------------

  /**
   * Enter a digit on this player's own board. R2 allows any cell, fogged or
   * not — if you have proved what belongs there, you may place it. Fog lifts
   * on this player's board alone.
   */
  setDigit(player: PlayerId, cells: readonly CellIndex[], digit: Digit): PlaceResult {
    const targets = cells.filter((c) => !this.isConfirmed(player, c));
    if (targets.length === 0) return { ok: false, correct: false, revealed: [] };
    this.checkpoint();

    const revealed: CellIndex[] = [];
    let allCorrect = true;

    for (const cell of targets) {
      this.boards[player][cell] = digit;
      if (this.solution[cell] === digit) {
        for (const r of this.lift(player, cell)) {
          if (!revealed.includes(r)) revealed.push(r);
        }
      } else {
        allCorrect = false;
        this.wrongGuesses[player]++;
      }
    }

    return { ok: true, correct: allCorrect, revealed };
  }

  /**
   * Clear this player's fog around a cell they solved, and hand them any
   * givens that were hiding there.
   */
  private lift(player: PlayerId, cell: CellIndex): CellIndex[] {
    const changed = reveal(this.fog, player, cell);
    for (const revealedCell of changed) {
      if (this.isGiven(revealedCell)) {
        this.boards[player][revealedCell] = (this.givens[revealedCell] ?? 0) as number;
      }
    }
    return changed;
  }

  toggleMark(
    player: PlayerId,
    kind: "corner" | "centre",
    cells: readonly CellIndex[],
    digit: Digit,
  ): void {
    const open = cells.filter(
      (c) => !this.isConfirmed(player, c) && this.boards[player][c] === 0,
    );
    if (open.length === 0) return;
    this.checkpoint();

    const store = this.notes[player][kind];
    const bit = 1 << (digit - 1);
    // Match SudokuPad: if every cell already has it, remove; otherwise add.
    const allSet = open.every((c) => ((store[c] as number) & bit) !== 0);
    for (const c of open) {
      store[c] = allSet ? (store[c] as number) & ~bit : (store[c] as number) | bit;
    }
  }

  toggleColour(player: PlayerId, cells: readonly CellIndex[], colour: number): void {
    if (cells.length === 0) return;
    this.checkpoint();
    const store = this.notes[player].colour;
    const allSet = cells.every((c) => store[c] === colour);
    for (const c of cells) store[c] = allSet ? 0 : colour;
  }

  clear(player: PlayerId, cells: readonly CellIndex[]): void {
    if (cells.length === 0) return;
    this.checkpoint();
    for (const cell of cells) {
      if (this.isConfirmed(player, cell)) continue;
      if (this.boards[player][cell] !== 0) {
        this.boards[player][cell] = 0;
        continue;
      }
      const n = this.notes[player];
      if (n.centre[cell] || n.corner[cell]) {
        n.centre[cell] = 0;
        n.corner[cell] = 0;
        continue;
      }
      n.colour[cell] = 0;
    }
  }

  // ---- markers -----------------------------------------------------------

  addMarker(
    player: PlayerId,
    type: MarkerType,
    cells: readonly CellIndex[],
  ): MarkerAttempt {
    const def = MARKER_DEFS[type];
    if (!this.palette.includes(type)) {
      return { ok: false, reason: `${def.label} is not in this puzzle's palette` };
    }
    if (cells.length < def.minCells) {
      return {
        ok: false,
        reason: isPath(def)
          ? `${def.label} needs a line of at least ${def.minCells} cells — you have ${cells.length}`
          : `${def.label} needs ${def.minCells} cells — you have ${cells.length}`,
      };
    }
    if (def.maxCells !== null && cells.length > def.maxCells) {
      return { ok: false, reason: `${def.label} takes only ${def.maxCells} cell(s)` };
    }
    // Only on your own side: you cannot assert a relation among cells you
    // cannot see, and a marker on your side is the one your partner needs.
    const fogged = cells.filter((c) => this.isHiddenFor(player, c));
    if (fogged.length > 0) {
      return {
        ok: false,
        reason: `You cannot see ${fogged.map(formatCell).join(", ")}, so you cannot vouch for it`,
      };
    }
    if (!isChain(cells, def.adjacency)) {
      return {
        ok: false,
        reason:
          def.adjacency === "king"
            ? `${def.label} must be an unbroken line — drag through touching cells`
            : `${def.label} needs two cells sharing an edge`,
      };
    }
    // A path and its reverse are the same line, so compare as sets unless the
    // order itself carries meaning.
    const duplicate = this.markers.some(
      (m) =>
        m.type === type &&
        (def.directional
          ? m.cells.length === cells.length && m.cells.every((c, i) => c === cells[i])
          : sameCells(m.cells, cells)),
    );
    if (duplicate) {
      return {
        ok: false,
        reason: `${def.label} is already on ${cells.map(formatCell).join("–")}`,
      };
    }
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] as CellIndex;
      const mask = conjunctionAt(this.markers, cell) & def.projectionAt(i);
      if (count(mask) < 2) {
        return {
          ok: false,
          reason: `That would pin ${formatCell(cell)} to one digit (R8)`,
        };
      }
    }
    if (!def.holds(this.solution, cells)) {
      return {
        ok: false,
        reason: `Not true of ${cells.map(formatCell).join("–")} — ${def.label.toLowerCase()} does not hold there`,
      };
    }

    this.checkpoint();
    // Namespaced by player, so ids stay unique once two peers are placing them.
    this.markers.push({
      id: `${player}-${this.markerSeq++}`,
      type,
      cells: [...cells],
      by: player,
    });
    return { ok: true };
  }

  /** Retract your own markers on these cells. Returns the ids removed. */
  removeMarkersAt(player: PlayerId, cells: readonly CellIndex[]): string[] {
    const set = new Set(cells);
    // R9: only the placer may retract their own marker.
    const doomed = this.markers.filter(
      (m) => m.by === player && m.cells.some((c) => set.has(c)),
    );
    if (doomed.length === 0) return [];
    this.checkpoint();
    this.markers = this.markers.filter((m) => !doomed.includes(m));
    return doomed.map((m) => m.id);
  }

  /** The marker this player most recently placed, for sending on. */
  lastMarkerBy(player: PlayerId): Marker | null {
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const marker = this.markers[i] as Marker;
      if (marker.by === player && !this.remote.has(marker.id)) return marker;
    }
    return null;
  }

  /**
   * Accept a marker from the other player.
   *
   * Their side of the board is theirs, so the own-side rule (R6a) cannot be
   * rechecked here — this client does not know their fog. What it can and does
   * check is that the relation is real and the type belongs to this puzzle,
   * which catches version drift and bugs without pretending to catch cheating.
   * Cheating is out of scope by R3: this is a co-operative game.
   */
  applyRemoteMarker(marker: Marker): boolean {
    if (this.remote.has(marker.id)) return false;
    if (this.markers.some((m) => m.id === marker.id)) return false;
    if (!this.palette.includes(marker.type)) return false;

    const def = MARKER_DEFS[marker.type];
    if (marker.cells.length < def.minCells) return false;
    if (def.maxCells !== null && marker.cells.length > def.maxCells) return false;
    if (!isChain(marker.cells, def.adjacency)) return false;
    if (!def.holds(this.solution, marker.cells)) return false;

    this.remote.set(marker.id, marker);
    this.markers.push(marker);
    return true;
  }

  /** Drop markers the other player retracted. */
  removeRemoteMarkers(ids: readonly string[]): number {
    let removed = 0;
    for (const id of ids) {
      if (!this.remote.delete(id)) continue;
      const at = this.markers.findIndex((m) => m.id === id);
      if (at >= 0) {
        this.markers.splice(at, 1);
        removed++;
      }
    }
    return removed;
  }

  markersTouching(cell: CellIndex): Marker[] {
    return this.markers.filter((m) => m.cells.includes(cell));
  }
}

function sameCells(a: readonly CellIndex[], b: readonly CellIndex[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export { PLAYERS };
export type { InputMode, PlayerId, MarkerType, Marker };
