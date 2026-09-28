import { describe, expect, it } from "vitest";
import { checkCertificate } from "../certificate.js";
import { carve, randomSolution } from "../generate.js";
import { parseValues } from "../grid.js";
import { makeRng } from "../rng.js";
import { solve } from "../solver.js";
import type { Deduction } from "../techniques/types.js";

const EASY =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

describe("certificate checker (G3)", () => {
  it("accepts a trace the solver produced", () => {
    const puzzle = parseValues(EASY);
    const { trace } = solve(puzzle);
    const result = checkCertificate(puzzle, trace);
    expect(result.valid).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.steps).toBe(trace.length);
  });

  it("accepts traces for many generated puzzles", () => {
    for (let i = 0; i < 20; i++) {
      const rng = makeRng(`cert-${i}`);
      const puzzle = carve(randomSolution(rng), rng);
      const { trace, solved } = solve(puzzle);
      const result = checkCertificate(puzzle, trace);
      expect(result.valid, `trace ${i} rejected: ${result.failure?.reason}`).toBe(true);
      expect(result.complete).toBe(solved);
    }
  });

  it("rejects a trace whose placement was altered", () => {
    const puzzle = parseValues(EASY);
    const trace = [...solve(puzzle).trace];
    const victim = trace.findIndex((d) => d.placements.length > 0);
    const original = trace[victim] as Deduction;
    const placement = original.placements[0]!;
    trace[victim] = {
      ...original,
      placements: [{ cell: placement.cell, digit: ((placement.digit % 9) + 1) as 1 }],
    };

    const result = checkCertificate(puzzle, trace);
    expect(result.valid).toBe(false);
    expect(result.failure?.step).toBe(victim);
    expect(result.failure?.reason).toBe("pattern-not-present");
  });

  it("rejects a trace with steps reordered into an unsupported position", () => {
    const puzzle = parseValues(EASY);
    const trace = [...solve(puzzle).trace];
    expect(trace.length).toBeGreaterThan(5);
    const moved = trace.splice(trace.length - 1, 1)[0] as Deduction;
    trace.unshift(moved);
    expect(checkCertificate(puzzle, trace).valid).toBe(false);
  });

  it("rejects an unknown technique", () => {
    const puzzle = parseValues(EASY);
    const trace = [...solve(puzzle).trace];
    trace[0] = { ...(trace[0] as Deduction), technique: "telepathy" };
    const result = checkCertificate(puzzle, trace);
    expect(result.valid).toBe(false);
    expect(result.failure?.reason).toBe("unknown-technique");
  });

  it("rejects a deduction relabelled to a cheaper tier", () => {
    const puzzle = parseValues(EASY);
    const trace = [...solve(puzzle).trace];
    const victim = trace.findIndex((d) => d.tier > 1);
    if (victim >= 0) {
      trace[victim] = { ...(trace[victim] as Deduction), tier: 1 };
      const result = checkCertificate(puzzle, trace);
      expect(result.valid).toBe(false);
      expect(result.failure?.reason).toBe("tier-mismatch");
    }
  });

  it("reports incomplete for a truncated but honest trace", () => {
    const puzzle = parseValues(EASY);
    const trace = solve(puzzle).trace.slice(0, 3);
    const result = checkCertificate(puzzle, trace);
    expect(result.valid).toBe(true);
    expect(result.complete).toBe(false);
  });
});
