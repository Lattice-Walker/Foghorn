import { describe, expect, it } from "vitest";
import { SignalFormatError, decodeSignal, encodeSignal } from "../codec.js";

/** A realistic offer: the SDP is what actually has to survive copy-paste. */
const SDP = {
  type: "offer",
  sdp: [
    "v=0",
    "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    "a=ice-ufrag:4ZcD",
    "a=ice-pwd:2/1muCWoOi3uLifh0NuRHlPy",
    "a=fingerprint:sha-256 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B",
    "a=setup:actpass",
    "a=mid:0",
    "a=sctp-port:5000",
    ...Array.from({ length: 12 }, (_, i) => `a=candidate:${i} 1 udp 2113937151 10.0.40.227 5${i}000 typ host`),
  ].join("\r\n"),
};

describe("signal codec", () => {
  it("round-trips an offer", async () => {
    const code = await encodeSignal(SDP);
    expect(await decodeSignal(code)).toEqual(SDP);
  });

  it("produces something safe to paste into a chat", async () => {
    const code = await encodeSignal(SDP);
    expect(code).toMatch(/^FOG[01]-[A-Za-z0-9_-]+$/);
    expect(code).not.toMatch(/\s/);
  });

  it("compresses substantially", async () => {
    const code = await encodeSignal(SDP);
    const raw = JSON.stringify(SDP).length;
    expect(code.length).toBeLessThan(raw * 0.7);
  });

  it("survives what a chat client does to it", async () => {
    const code = await encodeSignal(SDP);
    const mangled = `  ${code.slice(0, 40)}\n${code.slice(40)}  \n`;
    expect(await decodeSignal(mangled)).toEqual(SDP);
  });

  it("rejects something that is not a code at all", async () => {
    await expect(decodeSignal("hello there")).rejects.toBeInstanceOf(SignalFormatError);
  });

  it("rejects a truncated code rather than half-reading it", async () => {
    const code = await encodeSignal(SDP);
    await expect(decodeSignal(code.slice(0, code.length - 12))).rejects.toBeInstanceOf(
      SignalFormatError,
    );
  });

  it("reads the uncompressed form too", async () => {
    // What a browser without CompressionStream would have produced.
    const json = JSON.stringify({ type: "answer", sdp: "v=0" });
    const b64 = Buffer.from(json, "utf8").toString("base64url");
    expect(await decodeSignal(`FOG0-${b64}`)).toEqual({ type: "answer", sdp: "v=0" });
  });
});
