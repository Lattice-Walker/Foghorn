import { describe, expect, it } from "vitest";
import { solve as bruteSolve } from "../exact-cover/dlx.js";
import { carve, randomSolution } from "../generate.js";
import { type Values, formatValues, parseValues } from "../grid.js";
import { makeRng } from "../rng.js";
import { applyDeduction, createState, isComplete, solve } from "../solver.js";
import { TECHNIQUES } from "../techniques/index.js";
import { CELLS } from "../units.js";

const EASY =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

/**
 * The strongest correctness property available: replaying a trace against the
 * true solution, every placement must match it and no elimination may ever
 * remove it. An unsound technique fails here immediately.
 */
function assertTraceSound(puzzle: Values, trace: readonly { placements: readonly { cell: number; digit: number }[]; eliminations: readonly { cell: number; digit: number }[]; technique: string }[]): void {
  const solution = bruteSolve(puzzle);
  expect(solution).not.toBeNull();
  const state = createState(puzzle)!;

  for (const d of trace) {
    for (const p of d.placements) {
      expect(
        { technique: d.technique, cell: p.cell, digit: p.digit },
        `${d.technique} placed the wrong digit`,
      ).toEqual({ technique: d.technique, cell: p.cell, digit: solution![p.cell] });
    }
    for (const e of d.eliminations) {
      expect(
        e.digit === solution![e.cell],
        `${d.technique} eliminated the true digit ${e.digit} from cell ${e.cell}`,
      ).toBe(false);
    }
    expect(applyDeduction(state, d as never)).toBe(true);
  }
}

describe("technique solver", () => {
  it("solves a classic easy puzzle", () => {
    const result = solve(parseValues(EASY));
    expect(result.outcome).toBe("solved");
    expect(isComplete(result.state!)).toBe(true);
  });

  it("agrees with brute force wherever it succeeds", () => {
    const puzzle = parseValues(EASY);
    const result = solve(puzzle);
    const brute = bruteSolve(puzzle)!;
    const solved: (number | 0)[] = [];
    for (let c = 0; c < CELLS; c++) {
      solved.push(Math.log2(result.state!.grid.cand[c] as number) + 1);
    }
    expect(solved).toEqual([...brute]);
  });

  it("never eliminates a true digit, across many generated puzzles", () => {
    for (let i = 0; i < 25; i++) {
      const rng = makeRng(`sound-${i}`);
      const puzzle = carve(randomSolution(rng), rng);
      assertTraceSound(puzzle, solve(puzzle).trace);
    }
  });

  it("reports a stall rather than guessing", () => {
    // Only singles allowed: a puzzle needing more must stall, not bifurcate.
    const rng = makeRng("stall");
    const puzzle = carve(randomSolution(rng), rng);
    const result = solve(puzzle, { maxTier: 1 });
    expect(["solved", "stalled"]).toContain(result.outcome);
    if (result.outcome === "stalled") {
      expect(result.solved).toBe(false);
      expect(result.trace.every((d) => d.tier === 1)).toBe(true);
    }
  });

  it("rejects contradictory givens without crashing", () => {
    const result = solve(parseValues(`55${".".repeat(79)}`));
    expect(result.outcome).toBe("invalid-givens");
    expect(result.trace).toHaveLength(0);
  });

  it("solves a complete grid in zero steps", () => {
    const rng = makeRng("complete");
    const result = solve(randomSolution(rng));
    expect(result.outcome).toBe("solved");
    expect(result.trace).toHaveLength(0);
  });

  it("produces only deductions that change something", () => {
    const rng = makeRng("useful");
    const puzzle = carve(randomSolution(rng), rng);
    const result = solve(puzzle);
    for (const d of result.trace) {
      expect(d.placements.length + d.eliminations.length).toBeGreaterThan(0);
    }
  });
});

describe("technique registry", () => {
  it("has unique ids and ascending tiers", () => {
    const ids = TECHNIQUES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TECHNIQUES) expect(t.tier).toBeGreaterThanOrEqual(1);
  });

  it("verifies everything it finds", () => {
    for (let i = 0; i < 12; i++) {
      const rng = makeRng(`verify-${i}`);
      const puzzle = carve(randomSolution(rng), rng);
      const state = createState(puzzle)!;
      // Walk the solve, checking find/verify agreement at every state reached.
      for (let step = 0; step < 40; step++) {
        let applied = false;
        for (const technique of [...TECHNIQUES].sort((a, b) => a.tier - b.tier)) {
          const found = technique.find(state);
          for (const d of found) {
            expect(
              technique.verify(state, d),
              `${technique.id} found a deduction its own verify rejects`,
            ).toBe(true);
          }
          const next = found[0];
          if (next && !applied) {
            applyDeduction(state, next);
            applied = true;
          }
        }
        if (!applied || isComplete(state)) break;
      }
    }
  });
});
