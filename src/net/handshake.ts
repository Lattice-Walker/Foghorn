/**
 * What each side says when the channel opens.
 *
 * Kept out of the UI because getting it wrong is invisible: the connection
 * reports itself healthy, both players see "connected", and markers placed
 * before the second player arrived simply never appear. That shipped once,
 * because only the guest sent its markers and the host never sent its own.
 *
 * The order matters. The host owns the puzzle, so it announces the seed before
 * anything else. The guest says nothing until it has that seed, since a sync
 * sent beforehand would describe a puzzle that is about to be replaced.
 */

import type { Marker, PlayerId } from "../game/types.js";
import { type NetMessage, PROTOCOL_VERSION, toWire } from "./protocol.js";

/** Messages to send the moment the data channel opens. */
export function openingMessages(
  role: PlayerId,
  seed: string,
  markers: readonly Marker[],
): NetMessage[] {
  if (role !== "A") return [];
  return [
    { t: "hello", version: PROTOCOL_VERSION, seed, role },
    { t: "sync", markers: markers.map(toWire) },
  ];
}

/** Messages the guest sends in reply, once it knows which puzzle it is on. */
export function replyToHello(markers: readonly Marker[]): NetMessage[] {
  return [{ t: "sync", markers: markers.map(toWire) }];
}

/** Does this hello mean the guest must rebuild on a different puzzle? */
export function needsRebuild(role: PlayerId, ownSeed: string, theirSeed: string): boolean {
  return role === "B" && ownSeed !== theirSeed;
}
