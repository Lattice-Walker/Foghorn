import { describe, expect, it } from "vitest";
import {
  type CandidateKind,
  RelayFormatError,
  candidateKind,
  describeCandidates,
  iceServers,
  parseRelay,
} from "../ice.js";

describe("candidate kinds", () => {
  it("reads the type out of a candidate line", () => {
    expect(candidateKind("candidate:1 1 udp 2113937151 10.0.40.227 51000 typ host")).toBe("host");
    expect(
      candidateKind("candidate:2 1 udp 1677729535 203.0.113.9 51001 typ srflx raddr 10.0.40.227"),
    ).toBe("srflx");
    expect(candidateKind("candidate:3 1 udp 41885439 198.51.100.4 3478 typ relay")).toBe("relay");
  });

  it("ignores a line with no type it knows", () => {
    expect(candidateKind("candidate:4 1 udp 41885439 198.51.100.4 3478 typ bogus")).toBeNull();
    expect(candidateKind("")).toBeNull();
  });

  // The `.local` form is what browsers publish instead of a real LAN address;
  // it still has to register as a host candidate or the advice goes wrong.
  it("reads an mDNS-obfuscated host candidate", () => {
    const mdns = "candidate:5 1 udp 2113937151 a0b1c2d3-0000-4000-8000-000000000000.local 5 typ host";
    expect(candidateKind(mdns)).toBe("host");
  });
});

const set = (...kinds: CandidateKind[]): ReadonlySet<CandidateKind> => new Set(kinds);

describe("describing what was gathered", () => {
  it("worries when nothing was found", () => {
    expect(describeCandidates(set()).worrying).toBe(true);
  });

  it("worries when only the local network was found", () => {
    expect(describeCandidates(set("host")).worrying).toBe(true);
  });

  it("is content once a public address exists", () => {
    expect(describeCandidates(set("host", "srflx")).worrying).toBe(false);
  });

  it("is content with a relay even without a public address", () => {
    expect(describeCandidates(set("host", "relay")).worrying).toBe(false);
  });
});

describe("reading a relay a player typed", () => {
  it("accepts turn and turns", () => {
    expect(parseRelay("turn:relay.example.com:3478", "user", "pass").url).toBe(
      "turn:relay.example.com:3478",
    );
    expect(parseRelay(" turns:relay.example.com:5349 ", "user", "pass").url).toBe(
      "turns:relay.example.com:5349",
    );
  });

  // A stun: URL in the relay box is the mistake to expect, and it would fail
  // exactly like an empty box: no relay, same "ICE failed".
  it("refuses a scheme that cannot relay", () => {
    expect(() => parseRelay("stun:stun.example.com:3478", "user", "pass")).toThrow(
      RelayFormatError,
    );
    expect(() => parseRelay("relay.example.com", "user", "pass")).toThrow(RelayFormatError);
    expect(() => parseRelay("", "user", "pass")).toThrow(RelayFormatError);
  });

  it("refuses one with no credentials", () => {
    expect(() => parseRelay("turn:relay.example.com:3478", "", "pass")).toThrow(RelayFormatError);
    expect(() => parseRelay("turn:relay.example.com:3478", "user", " ")).toThrow(RelayFormatError);
  });
});

describe("assembling the ICE server list", () => {
  it("is the STUN defaults when there is no relay", () => {
    expect(iceServers(null)).toHaveLength(1);
  });

  it("appends the relay, keeping STUN for the direct path", () => {
    const servers = iceServers({ url: "turn:r.example:3478", username: "u", credential: "p" });
    expect(servers).toHaveLength(2);
    expect(servers[1]).toEqual({ urls: "turn:r.example:3478", username: "u", credential: "p" });
  });
});
