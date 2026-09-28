/**
 * What the two peers say to each other.
 *
 * The design makes this small. Everything about a puzzle — solution, givens,
 * fog shapes, palette — falls out of its seed, and each player's board, notes
 * and fog are private. So the whole shared state is a seed and a list of
 * markers, and the protocol is: agree the seed, then exchange markers.
 *
 * Everything arriving over the wire is untrusted input. `parseMessage`
 * validates structurally and returns null rather than throwing, so a peer on a
 * different version, or a corrupted frame, cannot crash the game.
 */

import { CELLS } from "../engine/units.js";
import { ALL_MARKER_TYPES } from "../game/markers.js";
import type { Marker, MarkerType, PlayerId } from "../game/types.js";

export const PROTOCOL_VERSION = 1;

export interface WireMarker {
  readonly id: string;
  readonly type: MarkerType;
  readonly cells: readonly number[];
  readonly by: PlayerId;
}

export type NetMessage =
  /** First frame each side sends. The host's seed wins. */
  | { readonly t: "hello"; readonly version: number; readonly seed: string; readonly role: PlayerId }
  /** Everything the sender has, sent once the link is up. */
  | { readonly t: "sync"; readonly markers: readonly WireMarker[] }
  | { readonly t: "marker-add"; readonly marker: WireMarker }
  | { readonly t: "marker-remove"; readonly ids: readonly string[] }
  /** Enough for the partner's progress bar and the shared win condition. */
  | { readonly t: "progress"; readonly filled: number; readonly complete: boolean }
  | { readonly t: "bye" };

const MARKER_TYPES = new Set<string>(ALL_MARKER_TYPES);

function isWireMarker(value: unknown): value is WireMarker {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  if (typeof m.id !== "string" || m.id.length === 0 || m.id.length > 64) return false;
  if (typeof m.type !== "string" || !MARKER_TYPES.has(m.type)) return false;
  if (m.by !== "A" && m.by !== "B") return false;
  if (!Array.isArray(m.cells) || m.cells.length === 0 || m.cells.length > CELLS) return false;
  return m.cells.every(
    (c) => typeof c === "number" && Number.isInteger(c) && c >= 0 && c < CELLS,
  );
}

export function serialise(message: NetMessage): string {
  return JSON.stringify(message);
}

/** Parse and validate a frame. Returns null for anything we cannot trust. */
export function parseMessage(raw: string): NetMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;

  switch (m.t) {
    case "hello":
      if (typeof m.version !== "number") return null;
      if (typeof m.seed !== "string" || m.seed.length === 0 || m.seed.length > 128) return null;
      if (m.role !== "A" && m.role !== "B") return null;
      return { t: "hello", version: m.version, seed: m.seed, role: m.role };

    case "sync":
      if (!Array.isArray(m.markers) || !m.markers.every(isWireMarker)) return null;
      return { t: "sync", markers: m.markers };

    case "marker-add":
      if (!isWireMarker(m.marker)) return null;
      return { t: "marker-add", marker: m.marker };

    case "marker-remove":
      if (!Array.isArray(m.ids) || !m.ids.every((i) => typeof i === "string")) return null;
      return { t: "marker-remove", ids: m.ids };

    case "progress":
      if (typeof m.filled !== "number" || typeof m.complete !== "boolean") return null;
      return { t: "progress", filled: m.filled, complete: m.complete };

    case "bye":
      return { t: "bye" };

    default:
      return null;
  }
}

export function toWire(marker: Marker): WireMarker {
  return { id: marker.id, type: marker.type, cells: [...marker.cells], by: marker.by };
}
