/**
 * Which servers the ICE agent may use, and what it found.
 *
 * STUN alone is enough when at least one side's NAT is well behaved: each peer
 * learns its own public address and they talk directly. It is not enough when
 * both sides sit behind a NAT that gives every destination a different port, or
 * behind a firewall that drops the unsolicited packets a direct path needs. In
 * those cases the only route left runs through a relay, and the browser says as
 * much — Firefox's wording is "ICE failed, add a TURN server".
 *
 * A relay costs money to run and cannot be hosted on GitHub Pages, so Foghorn
 * does not ship one. What it does instead is let a player point at a relay they
 * have: pasted into the connection panel, kept in `localStorage`, and used for
 * every game after that.
 */

const STORAGE_KEY = "foghorn.ice";

export const DEFAULT_ICE: readonly RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
];

/** A relay, in the shape the connection panel asks for it. */
export interface RelayConfig {
  readonly url: string;
  readonly username: string;
  readonly credential: string;
}

function isRelayShaped(value: unknown): value is RelayConfig {
  if (typeof value !== "object" || value === null) return false;
  const { url, username, credential } = value as Record<string, unknown>;
  return (
    typeof url === "string" &&
    url.length > 0 &&
    typeof username === "string" &&
    typeof credential === "string"
  );
}

/** The relay this browser has been told about, if any. */
export function loadRelay(): RelayConfig | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private windows and blocked site data both throw; no relay is a fine
    // answer, and it must not stop the panel from rendering.
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRelayShaped(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRelay(relay: RelayConfig | null): void {
  try {
    if (relay === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(relay));
  } catch {
    // Same as above: the relay simply will not be remembered next time.
  }
}

export class RelayFormatError extends Error {}

/**
 * Read what a player typed into a relay. Deliberately strict about the scheme,
 * because a wrong one fails silently later: the browser ignores servers it
 * cannot parse and reports the same "ICE failed" as having no relay at all.
 */
export function parseRelay(url: string, username: string, credential: string): RelayConfig {
  const trimmed = url.trim();
  if (trimmed.length === 0) throw new RelayFormatError("Enter the relay address");
  if (!/^turns?:/i.test(trimmed)) {
    throw new RelayFormatError("A relay address starts with turn: or turns:");
  }

  const user = username.trim();
  const secret = credential.trim();
  // Anonymous TURN is not a thing in practice, and a relay that quietly refuses
  // every allocation looks exactly like no relay at all.
  if (user.length === 0 || secret.length === 0) {
    throw new RelayFormatError("A relay needs a username and a password too");
  }
  return { url: trimmed, username: user, credential: secret };
}

/** The ICE servers to hand a peer connection: the STUN defaults plus any relay. */
export function iceServers(relay: RelayConfig | null = loadRelay()): readonly RTCIceServer[] {
  if (!relay) return DEFAULT_ICE;
  return [
    ...DEFAULT_ICE,
    { urls: relay.url, username: relay.username, credential: relay.credential },
  ];
}

export type CandidateKind = "host" | "srflx" | "prflx" | "relay";

/** The `typ` of one candidate line, or null if it has none we recognise. */
export function candidateKind(candidate: string): CandidateKind | null {
  const match = /\btyp (host|srflx|prflx|relay)\b/.exec(candidate);
  return match ? (match[1] as CandidateKind) : null;
}

/**
 * What the gathered candidates mean for this connection's chances, in the words
 * a player needs to act on. Reachability is not knowable until the check phase,
 * so this only reports the shapes that are already known to be hopeless.
 */
export function describeCandidates(kinds: ReadonlySet<CandidateKind>): {
  readonly text: string;
  readonly worrying: boolean;
} {
  if (kinds.size === 0) {
    return {
      text: "No network addresses were found at all — check that this browser is allowed to make connections.",
      worrying: true,
    };
  }
  if (kinds.has("relay")) {
    return { text: "Found a relay address: this should connect from anywhere.", worrying: false };
  }
  if (!kinds.has("srflx")) {
    return {
      text: "Only local network addresses were found, so this will connect over your own network but probably not over the internet. Add a relay below if the other player is elsewhere.",
      worrying: true,
    };
  }
  return {
    text: "Found a public address. If the connection still fails, both of you are behind strict NAT and will need a relay.",
    worrying: false,
  };
}
