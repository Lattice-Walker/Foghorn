/**
 * A peer connection with no signalling server.
 *
 * GitHub Pages serves files and nothing else, so the two browsers cannot be
 * introduced by anything we host. Instead they are introduced by the players:
 * the host produces a code, sends it however they already talk to each other,
 * and pastes back the code that comes in reply.
 *
 * That has one consequence worth understanding. With a signalling server, ICE
 * candidates trickle across as they are found. Here there is no channel to
 * trickle over, so each side must finish gathering before its code exists —
 * hence the wait, and the timeout for the networks where gathering never
 * formally completes.
 *
 * STUN servers are contacted while gathering. They learn that some address is
 * looking for a peer and nothing else; they never see the game, the puzzle or
 * the codes. On a shared network you can drop them entirely and still connect,
 * since host candidates are enough.
 *
 * STUN is not always enough, though. When both players sit behind a NAT that
 * refuses direct connections there is no path to find, and the browser reports
 * a bare "ICE failed". So each peer remembers which kinds of candidate it
 * gathered, which is what turns that into advice a player can act on — see
 * `./ice.js` for the relay that advice points them at.
 */

import { type CandidateKind, candidateKind, iceServers } from "./ice.js";
import { type NetMessage, parseMessage, serialise } from "./protocol.js";

export type ConnectionState =
  | "idle"
  | "gathering"
  | "waiting"
  | "connecting"
  | "open"
  | "closed"
  | "failed";

export interface PeerEvents {
  readonly onMessage: (message: NetMessage) => void;
  readonly onState: (state: ConnectionState, detail?: string) => void;
}

export { DEFAULT_ICE } from "./ice.js";

/** How long to wait for ICE gathering before using the candidates we have. */
const GATHER_TIMEOUT_MS = 8000;

function waitForGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = (): void => {
      if (pc.iceGatheringState === "complete") finish();
    };
    // Some networks never report completion; the candidates found by now are
    // usually enough, and waiting forever is worse than trying.
    const timer = setTimeout(finish, GATHER_TIMEOUT_MS);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

export class ManualPeer {
  readonly connection: RTCPeerConnection;
  /** The candidate types gathered locally, for diagnosing a failure. */
  readonly gathered = new Set<CandidateKind>();
  private channel: RTCDataChannel | null = null;
  private currentState: ConnectionState = "idle";

  private constructor(
    private readonly events: PeerEvents,
    servers: readonly RTCIceServer[],
  ) {
    this.connection = new RTCPeerConnection({ iceServers: [...servers] });

    this.connection.addEventListener("icecandidate", (event) => {
      const kind = event.candidate && candidateKind(event.candidate.candidate);
      if (kind) this.gathered.add(kind);
    });

    this.connection.addEventListener("connectionstatechange", () => {
      const s = this.connection.connectionState;
      if (s === "failed") this.setState("failed", this.failureAdvice());
      else if (s === "disconnected" || s === "closed") this.setState("closed");
    });
  }

  /**
   * Why a failure probably happened. The browser only ever says that no path
   * was found, which leaves a player with nothing to try; what they can act on
   * is whether the two of them ever had a hope of a direct path.
   */
  private failureAdvice(): string {
    if (this.gathered.has("relay")) {
      return "Could not reach the other player, even through the relay — check the relay address and password.";
    }
    if (!this.gathered.has("srflx")) {
      return "Could not reach the other player. This browser never found a public address for itself, so a direct connection was never possible: add a relay under Connection settings.";
    }
    return "Could not reach the other player. You are both behind a firewall or router that refuses direct connections, so this game needs a relay: add one under Connection settings.";
  }

  get state(): ConnectionState {
    return this.currentState;
  }

  private setState(state: ConnectionState, detail?: string): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.events.onState(state, detail);
  }

  private attach(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.addEventListener("open", () => this.setState("open"));
    channel.addEventListener("close", () => this.setState("closed"));
    channel.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = parseMessage(event.data);
      // A frame we cannot validate is dropped, not acted on and not fatal:
      // the peer may be on another version.
      if (message) this.events.onMessage(message);
    });
  }

  /**
   * Start a game. Returns the code to hand to the other player; feed their
   * reply to `acceptAnswer`.
   */
  static async host(
    events: PeerEvents,
    servers: readonly RTCIceServer[] = iceServers(),
  ): Promise<{ peer: ManualPeer; offer: RTCSessionDescriptionInit }> {
    const peer = new ManualPeer(events, servers);
    peer.attach(peer.connection.createDataChannel("foghorn", { ordered: true }));

    peer.setState("gathering");
    await peer.connection.setLocalDescription(await peer.connection.createOffer());
    await waitForGathering(peer.connection);
    peer.setState("waiting");

    const offer = peer.connection.localDescription;
    if (!offer) throw new Error("no local description after gathering");
    return { peer, offer: { type: offer.type, sdp: offer.sdp } };
  }

  /** Finish hosting, with the code the other player sent back. */
  async acceptAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    this.setState("connecting");
    await this.connection.setRemoteDescription(answer);
  }

  /**
   * Join a game from the host's code. Returns the code to send back, and the
   * channel opens once the host pastes it in.
   */
  static async join(
    offer: RTCSessionDescriptionInit,
    events: PeerEvents,
    servers: readonly RTCIceServer[] = iceServers(),
  ): Promise<{ peer: ManualPeer; answer: RTCSessionDescriptionInit }> {
    const peer = new ManualPeer(events, servers);
    peer.connection.addEventListener("datachannel", (event) => peer.attach(event.channel));

    peer.setState("gathering");
    await peer.connection.setRemoteDescription(offer);
    await peer.connection.setLocalDescription(await peer.connection.createAnswer());
    await waitForGathering(peer.connection);
    peer.setState("connecting");

    const answer = peer.connection.localDescription;
    if (!answer) throw new Error("no local description after gathering");
    return { peer, answer: { type: answer.type, sdp: answer.sdp } };
  }

  send(message: NetMessage): boolean {
    if (this.channel?.readyState !== "open") return false;
    this.channel.send(serialise(message));
    return true;
  }

  close(): void {
    this.send({ t: "bye" });
    this.channel?.close();
    this.connection.close();
    this.setState("closed");
  }
}
