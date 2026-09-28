/**
 * The join handshake, driven end to end over the real wire format.
 *
 * The case that matters: a host who has been playing alone for ten minutes and
 * then gets a partner. Their markers have to reach the newcomer, and nothing
 * in a live connection reports it when they do not.
 */

import { describe, expect, it } from "vitest";
import { CELLS } from "../../engine/units.js";
import { MARKER_DEFS, areAdjacent } from "../../game/markers.js";
import { Session } from "../../game/session.js";
import type { MarkerType, PlayerId } from "../../game/types.js";
import { needsRebuild, openingMessages, replyToHello } from "../handshake.js";
import { type NetMessage, parseMessage, serialise } from "../protocol.js";

function placeSome(session: Session, player: PlayerId, wanted: number): number {
  let placed = 0;
  for (const type of session.palette) {
    const def = MARKER_DEFS[type];
    for (let cell = 0; cell < CELLS && placed < wanted; cell++) {
      const cells =
        def.minCells === 1
          ? [cell]
          : [cell, cell + 1].every((c) => c < CELLS) && areAdjacent(cell, cell + 1)
            ? [cell, cell + 1]
            : null;
      if (!cells) continue;
      if (cells.length < def.minCells) continue;
      if (session.addMarker(player, type, cells).ok) placed++;
    }
  }
  return placed;
}

/** Run the handshake between two sessions, delivering every frame. */
function handshake(host: Session, guest: Session): void {
  const apply = (to: Session, role: PlayerId, raw: string): NetMessage[] => {
    const message = parseMessage(raw);
    if (!message) return [];
    switch (message.t) {
      case "hello":
        expect(needsRebuild(role, to.seed, message.seed)).toBe(false);
        return replyToHello(to.markers);
      case "sync":
        for (const wire of message.markers) {
          to.applyRemoteMarker({ ...wire, cells: [...wire.cells] });
        }
        return [];
      default:
        return [];
    }
  };

  // Host opens the conversation; the guest answers; the host takes the answer.
  const fromHost = openingMessages("A", host.seed, host.markers);
  const fromGuest = fromHost.flatMap((m) => apply(guest, "B", serialise(m)));
  for (const m of fromGuest) apply(host, "A", serialise(m));
}

describe("join handshake", () => {
  it("sends the host's existing markers to a guest who joins later", () => {
    const host = new Session("late-join");
    const guest = new Session("late-join");

    const placed = placeSome(host, "A", 5);
    expect(placed).toBeGreaterThan(0);
    expect(guest.markers).toHaveLength(0);

    handshake(host, guest);
    expect(guest.markers).toHaveLength(placed);
  });

  it("sends the guest's markers back to the host", () => {
    const host = new Session("both-ways");
    const guest = new Session("both-ways");

    const byHost = placeSome(host, "A", 3);
    const byGuest = placeSome(guest, "B", 3);
    expect(byHost).toBeGreaterThan(0);
    expect(byGuest).toBeGreaterThan(0);

    handshake(host, guest);
    expect(host.markers).toHaveLength(byHost + byGuest);
    expect(guest.markers).toHaveLength(byHost + byGuest);
  });

  it("leaves both boards holding the same markers", () => {
    const host = new Session("agree");
    const guest = new Session("agree");
    placeSome(host, "A", 4);
    placeSome(guest, "B", 4);

    handshake(host, guest);
    const ids = (s: Session) => s.markers.map((m) => m.id).sort();
    expect(ids(host)).toEqual(ids(guest));
  });

  it("does not duplicate markers if the handshake runs twice", () => {
    const host = new Session("twice");
    const guest = new Session("twice");
    placeSome(host, "A", 3);

    handshake(host, guest);
    const after = guest.markers.length;
    handshake(host, guest);
    expect(guest.markers).toHaveLength(after);
  });

  it("only the host announces the seed", () => {
    expect(openingMessages("A", "s", []).map((m) => m.t)).toEqual(["hello", "sync"]);
    // The guest says nothing until it knows which puzzle it is on: a sync sent
    // first would describe a puzzle about to be replaced.
    expect(openingMessages("B", "s", [])).toEqual([]);
  });

  it("rebuilds only the guest, and only on a different seed", () => {
    expect(needsRebuild("B", "mine", "theirs")).toBe(true);
    expect(needsRebuild("B", "same", "same")).toBe(false);
    expect(needsRebuild("A", "mine", "theirs")).toBe(false);
  });
});
