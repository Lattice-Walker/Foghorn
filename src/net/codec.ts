/**
 * Turning a WebRTC session description into something a person can paste into
 * a chat window, and back.
 *
 * With no signalling server, the two browsers have to exchange their offer and
 * answer by hand, so the blob has to survive being copied, pasted, wrapped and
 * quoted. That means: no whitespace, no characters a chat client will mangle,
 * and as short as the SDP allows.
 *
 * Deflate then base64url gets a typical offer from around 3 kB to roughly a
 * third of that. `CompressionStream` is not everywhere, so the codec announces
 * which form it used in the prefix and reads both.
 */

const COMPRESSED = "FOG1-";
const PLAIN = "FOG0-";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** A Blob over a fresh copy, so the buffer is a plain ArrayBuffer. */
function blobOf(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer]);
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function hasCompression(): boolean {
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
}

/** Pack any JSON-serialisable signal into a single pasteable token. */
export async function encodeSignal(signal: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(signal));
  if (!hasCompression()) return PLAIN + toBase64Url(bytes);

  const deflated = await collect(
    blobOf(bytes).stream().pipeThrough(new CompressionStream("deflate-raw")),
  );
  return COMPRESSED + toBase64Url(deflated);
}

export class SignalFormatError extends Error {}

/** Read a token back. Throws SignalFormatError on anything malformed. */
export async function decodeSignal<T = unknown>(code: string): Promise<T> {
  // Tolerate whatever a chat client did to it on the way.
  const cleaned = code.trim().replace(/\s+/g, "");

  const compressed = cleaned.startsWith(COMPRESSED);
  if (!compressed && !cleaned.startsWith(PLAIN)) {
    throw new SignalFormatError("That does not look like a Foghorn code");
  }

  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(cleaned.slice(COMPRESSED.length));
  } catch {
    throw new SignalFormatError("The code is damaged — copy the whole thing again");
  }

  if (compressed) {
    if (!hasCompression()) {
      throw new SignalFormatError("This browser cannot read compressed codes");
    }
    try {
      bytes = await collect(
        blobOf(bytes).stream().pipeThrough(new DecompressionStream("deflate-raw")),
      );
    } catch {
      throw new SignalFormatError("The code is damaged — copy the whole thing again");
    }
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new SignalFormatError("The code is damaged — copy the whole thing again");
  }
}
