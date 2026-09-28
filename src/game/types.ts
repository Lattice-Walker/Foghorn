import type { Digit } from "../engine/digits.js";
import type { CellIndex } from "../engine/units.js";

export type PlayerId = "A" | "B";
export const PLAYERS: readonly PlayerId[] = ["A", "B"];

/**
 * The marker catalogue. Each puzzle draws its own palette of at most three
 * from these (R5); see markers.ts.
 */
export type MarkerType =
  // Relations between two cells sharing a border.
  | "consecutive"
  | "double"
  | "sum5"
  | "sum10"
  | "greater"
  | "sameParity"
  | "oppositeParity"
  // Lines of any length, running cell to cell by king's moves.
  | "whisper"
  | "dutchWhisper"
  | "palindrome"
  | "renban"
  | "thermo"
  | "regionSum"
  | "entropic"
  // Disequalities asserted of one cell and a neighbourhood.
  | "knight"
  | "king"
  | "nonConsecutive";

export interface Marker {
  readonly id: string;
  readonly type: MarkerType;
  readonly cells: readonly CellIndex[];
  readonly by: PlayerId;
}

/** Private per-player annotations. The board's digits are shared; these are not. */
export interface Notes {
  /** Candidate masks, one per cell. */
  readonly corner: Uint16Array;
  readonly centre: Uint16Array;
  /** Colour index + 1, or 0 for none. */
  readonly colour: Uint8Array;
}

export type InputMode = "normal" | "corner" | "centre" | "colour";

export interface PlaceResult {
  readonly ok: boolean;
  readonly correct: boolean;
  readonly revealed: readonly CellIndex[];
}

export type { Digit, CellIndex };
