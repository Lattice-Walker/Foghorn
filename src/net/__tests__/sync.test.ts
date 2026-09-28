/**
 * Two sessions on the same seed, exchanging markers the way two peers do.
 *
 * The data channel is stubbed out: what matters here is that the shared state
 * really is just a seed plus a marker list, and that it stays consistent.
 */

import { describe, expect, it } from "vitest";
import { CELLS } from "../../engine/units.js";
import { MARKER_DEFS, areAdjacent } from "../../game/markers.js";
import { Session } from "../../game/session.js";
import type { MarkerType, PlayerId } from "../../game/types.js";
import { type NetMessage, parseMessage, serialise, toWire } from "../protocol.js";

/** A pair of sessions wired to each other through the real wire format. */
function connect(seed: string) {
  const sessions: Record<PlayerId, Session> = {
    A: new Session(seed),
    B: new Session(seed),
  };

  const deliver = (to: PlayerId, raw: string): void => {
    const message = parseMessage(raw);
    if (!message) return;
    if (message.t === "marker-add") {
      sessions[to].applyRemoteMarker({
        ...message.marker,
        cells: [...message.marker.cells],
      });
    } else if (message.t === "marker-remove") {
      sessions[to].removeRemoteMarkers(message.ids);
    }
  };

  const send = (from: PlayerId, message: NetMessage): void => {
    deliver(from === "A" ? "B" : "A", serialise(message));
  };

  return { sessions, send };
}

/**
 * A legal placement for `player` of whatever this puzzle's palette offers.
 *
 * A palette can come out as three badges, so a helper that only looked for
 * pairs would find nothing on some seeds.
 */
function findPlacement(
  session: Session,
  player: PlayerId,
): { type: MarkerType; cells: number[] } | null {
  const visible = (c: number) => !session.isHiddenFor(player, c);

  for (const type of session.palette) {
    const def = MARKER_DEFS[type];

    if (def.minCells === 1) {
      for (let cell = 0; cell < CELLS; cell++) {
        if (visible(cell) && def.holds(session.solution, [cell])) return { type, cells: [cell] };
      }
      continue;
    }

    for (let cell = 0; cell < CELLS; cell++) {
      for (const other of [cell + 1, cell + 9]) {
        if (other >= CELLS || !areAdjacent(cell, other)) continue;
        if (!visible(cell) || !visible(other)) continue;
        if (def.holds(session.solution, [cell, other])) return { type, cells: [cell, other] };
      }
    }
  }
  return null;
}

describe("two peers on one seed", () => {
  it("generate the identical puzzle, fog and palette", () => {
    const { sessions } = connect("sync-1");
    expect(sessions.A.solution).toEqual(sessions.B.solution);
    expect(sessions.A.givens).toEqual(sessions.B.givens);
    expect([...sessions.A.fog.A]).toEqual([...sessions.B.fog.A]);
    expect([...sessions.A.fog.B]).toEqual([...sessions.B.fog.B]);
    expect(sessions.A.palette).toEqual(sessions.B.palette);
  });

  it("carries a marker from one board to the other", () => {
    const { sessions, send } = connect("sync-2");
    const placement = findPlacement(sessions.A, "A");
    expect(placement).not.toBeNull();

    const { type, cells } = placement as { type: MarkerType; cells: number[] };
    expect(sessions.A.addMarker("A", type, cells).ok).toBe(true);
    send("A", { t: "marker-add", marker: toWire(sessions.A.lastMarkerBy("A")!) });

    expect(sessions.B.markers).toHaveLength(1);
    expect(sessions.B.markers[0]!.cells).toEqual(cells);
    expect(sessions.B.markers[0]!.by).toBe("A");
  });

  it("keeps ids apart so two peers never collide", () => {
    const { sessions } = connect("sync-3");
    const a = findPlacement(sessions.A, "A");
    const b = findPlacement(sessions.B, "B");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    sessions.A.addMarker("A", a!.type as MarkerType, a!.cells);
    sessions.B.addMarker("B", b!.type as MarkerType, b!.cells);
    expect(sessions.A.lastMarkerBy("A")!.id).not.toBe(sessions.B.lastMarkerBy("B")!.id);
  });

  it("does not let a local undo rip out the partner's marker", () => {
    const { sessions, send } = connect("sync-4");
    const placement = findPlacement(sessions.A, "A") as { type: MarkerType; cells: number[] };
    sessions.A.addMarker("A", placement.type, placement.cells);
    send("A", { t: "marker-add", marker: toWire(sessions.A.lastMarkerBy("A")!) });
    expect(sessions.B.markers).toHaveLength(1);

    // B now does several things of their own, then walks them all back.
    const cell = [...Array(CELLS).keys()].find((c) => sessions.B.valueAt("B", c) === 0)!;
    sessions.B.setDigit("B", [cell], 5);
    sessions.B.toggleMark("B", "centre", [cell], 3);
    sessions.B.undo();
    sessions.B.undo();
    sessions.B.undo();

    expect(sessions.B.markers).toHaveLength(1);
    expect(sessions.B.markers[0]!.by).toBe("A");
  });

  it("retracts a marker across the link", () => {
    const { sessions, send } = connect("sync-5");
    const placement = findPlacement(sessions.A, "A") as { type: MarkerType; cells: number[] };
    sessions.A.addMarker("A", placement.type, placement.cells);
    send("A", { t: "marker-add", marker: toWire(sessions.A.lastMarkerBy("A")!) });

    const removed = sessions.A.removeMarkersAt("A", placement.cells);
    expect(removed).toHaveLength(1);
    send("A", { t: "marker-remove", ids: removed });
    expect(sessions.B.markers).toHaveLength(0);
  });

  it("refuses a marker that is not true, however it arrived", () => {
    const { sessions } = connect("sync-6");
    const type = sessions.A.palette.find((t) => MARKER_DEFS[t].minCells === 2);
    if (!type) return; // an all-badge palette has no pair to falsify

    // Find a pair the relation does not hold for and push it in directly.
    for (let cell = 0; cell < CELLS - 1; cell++) {
      if (!areAdjacent(cell, cell + 1)) continue;
      if (MARKER_DEFS[type].holds(sessions.B.solution, [cell, cell + 1])) continue;
      const accepted = sessions.B.applyRemoteMarker({
        id: "A-99",
        type,
        cells: [cell, cell + 1],
        by: "A",
      });
      expect(accepted).toBe(false);
      expect(sessions.B.markers).toHaveLength(0);
      return;
    }
  });

  it("ignores a marker sent twice", () => {
    const { sessions } = connect("sync-7");
    const placement = findPlacement(sessions.A, "A") as { type: MarkerType; cells: number[] };
    sessions.A.addMarker("A", placement.type, placement.cells);
    const wire = toWire(sessions.A.lastMarkerBy("A")!);

    expect(sessions.B.applyRemoteMarker({ ...wire, cells: [...wire.cells] })).toBe(true);
    expect(sessions.B.applyRemoteMarker({ ...wire, cells: [...wire.cells] })).toBe(false);
    expect(sessions.B.markers).toHaveLength(1);
  });
});
