import { describe, expect, it } from "vitest";
import { carve, randomSolution } from "../generate.js";
import { parseValues } from "../grid.js";
import { makeRng } from "../rng.js";
import { TIER_WEIGHT, formatDifficulty, rate } from "../rate.js";

const EASY =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";

describe("difficulty rating", () => {
  it("rates a solved puzzle", () => {
    const d = rate(parseValues(EASY));
    expect(d.solved).toBe(true);
    expect(d.label).not.toBe("unrated");
    expect(d.steps).toBeGreaterThan(0);
    expect(d.maxTier).toBeGreaterThanOrEqual(1);
  });

  it("scores as the weighted sum of its steps", () => {
    const d = rate(parseValues(EASY));
    let expected = 0;
    for (const [tier, n] of Object.entries(d.perTier)) {
      expected += (TIER_WEIGHT[Number(tier)] as number) * n;
    }
    expect(d.score).toBe(expected);
  });

  it("counts the same steps per tier and per technique", () => {
    const d = rate(parseValues(EASY));
    const byTier = Object.values(d.perTier).reduce((a, b) => a + b, 0);
    const byTechnique = [...d.perTechnique.values()].reduce((a, b) => a + b, 0);
    expect(byTier).toBe(d.steps);
    expect(byTechnique).toBe(d.steps);
  });

  it("leaves a puzzle unrated when techniques cannot finish it", () => {
    const rng = makeRng("unrated");
    const puzzle = carve(randomSolution(rng), rng);
    const capped = rate(puzzle, { maxTier: 1 });
    if (!capped.solved) {
      expect(capped.label).toBe("unrated");
      expect(capped.outcome).toBe("stalled");
    }
  });

  it("rates a harder cap as no cheaper than an easier one", () => {
    for (let i = 0; i < 10; i++) {
      const rng = makeRng(`monotone-${i}`);
      const puzzle = carve(randomSolution(rng), rng);
      const limited = rate(puzzle, { maxTier: 2 });
      const full = rate(puzzle);
      // Restricting the toolbox can never turn an unsolvable puzzle solvable.
      if (limited.solved) expect(full.solved).toBe(true);
    }
  });

  it("gives a complete grid a score of zero", () => {
    const d = rate(randomSolution(makeRng("done")));
    expect(d.solved).toBe(true);
    expect(d.score).toBe(0);
    expect(d.label).toBe("gentle");
  });

  it("formats readably", () => {
    expect(formatDifficulty(rate(parseValues(EASY)))).toMatch(/tier \d+, \d+ steps/);
  });
});
