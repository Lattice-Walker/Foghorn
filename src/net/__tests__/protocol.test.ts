import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, parseMessage, serialise, toWire } from "../protocol.js";

describe("wire protocol", () => {
  it("round-trips every message kind", () => {
    const messages = [
      { t: "hello", version: PROTOCOL_VERSION, seed: "abc123", role: "A" },
      { t: "sync", markers: [{ id: "A-1", type: "double", cells: [0, 1], by: "A" }] },
      { t: "marker-add", marker: { id: "B-7", type: "whisper", cells: [3, 4, 14], by: "B" } },
      { t: "marker-remove", ids: ["A-1", "A-2"] },
      { t: "progress", filled: 42, complete: false },
      { t: "bye" },
    ] as const;

    for (const message of messages) {
      expect(parseMessage(serialise(message as never))).toEqual(message);
    }
  });

  it("converts a marker to the wire without leaking anything else", () => {
    const wire = toWire({ id: "A-3", type: "king", cells: [40], by: "A" });
    expect(Object.keys(wire).sort()).toEqual(["by", "cells", "id", "type"]);
  });

  it("returns null rather than throwing on rubbish", () => {
    for (const raw of ["", "{", "null", "[]", '"hello"', "{}", '{"t":"nope"}']) {
      expect(parseMessage(raw)).toBeNull();
    }
  });

  it("rejects a marker naming a cell outside the grid", () => {
    const bad = '{"t":"marker-add","marker":{"id":"A-1","type":"double","cells":[0,81],"by":"A"}}';
    expect(parseMessage(bad)).toBeNull();
  });

  it("rejects a marker type it does not know", () => {
    const bad = '{"t":"marker-add","marker":{"id":"A-1","type":"telepathy","cells":[0,1],"by":"A"}}';
    expect(parseMessage(bad)).toBeNull();
  });

  it("rejects a hello with no seed or a silly one", () => {
    expect(parseMessage('{"t":"hello","version":1,"role":"A"}')).toBeNull();
    expect(parseMessage('{"t":"hello","version":1,"seed":"","role":"A"}')).toBeNull();
    expect(
      parseMessage(`{"t":"hello","version":1,"seed":"${"x".repeat(200)}","role":"A"}`),
    ).toBeNull();
  });

  it("rejects an unknown player", () => {
    expect(parseMessage('{"t":"hello","version":1,"seed":"s","role":"C"}')).toBeNull();
  });

  it("keeps the version so a mismatch can be reported", () => {
    const m = parseMessage('{"t":"hello","version":99,"seed":"s","role":"B"}');
    expect(m).toEqual({ t: "hello", version: 99, seed: "s", role: "B" });
  });
});
