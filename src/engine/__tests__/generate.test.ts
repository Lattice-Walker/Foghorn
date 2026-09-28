import { describe, expect, it } from "vitest";
import { carve, clueCount, randomSolution } from "../generate.js";
import { countSolutions, hasUniqueSolution } from "../exact-cover/dlx.js";
import { formatValues, fromValues, isConsistent, isFull } from "../grid.js";
import { makeRng } from "../rng.js";
import { CELLS } from "../units.js";

describe("full-grid generation", () => {
  it("produces a complete, valid grid", () => {
    const g = fromValues(randomSolution(makeRng("seed-1")));
    expect(g).not.toBeNull();
    expect(isFull(g!)).toBe(true);
    expect(isConsistent(g!)).toBe(true);
  });

  it("is reproducible from its seed", () => {
    const a = randomSolution(makeRng("same"));
    const b = randomSolution(makeRng("same"));
    expect(formatValues(a)).toBe(formatValues(b));
  });

  it("varies across seeds", () => {
    const grids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      grids.add(formatValues(randomSolution(makeRng(`seed-${i}`))));
    }
    expect(grids.size).toBe(20);
  });

  it("produces grids that are themselves the unique solution of themselves", () => {
    const solution = randomSolution(makeRng("unique-check"));
    expect(countSolutions(solution)).toBe(1);
  });
});

describe("carving clues", () => {
  it("keeps the puzzle unique at every step", () => {
    const rng = makeRng("carve-1");
    const solution = randomSolution(rng);
    const puzzle = carve(solution, rng);
    expect(hasUniqueSolution(puzzle)).toBe(true);
    expect(clueCount(puzzle)).toBeLessThan(CELLS);
  });

  it("solves back to the grid it came from", () => {
    const rng = makeRng("carve-2");
    const solution = randomSolution(rng);
    const puzzle = carve(solution, rng);
    for (let c = 0; c < CELLS; c++) {
      if (puzzle[c] !== 0) expect(puzzle[c]).toBe(solution[c]);
    }
  });

  it("reaches a sensible clue count unaided", () => {
    const rng = makeRng("carve-3");
    const puzzle = carve(randomSolution(rng), rng);
    // Minimal-ish puzzles land in the low-to-mid twenties; anything above 40
    // means the carve loop is bailing out early.
    expect(clueCount(puzzle)).toBeLessThanOrEqual(40);
    expect(clueCount(puzzle)).toBeGreaterThanOrEqual(17);
  });

  it("honours 180-degree symmetry when asked", () => {
    const rng = makeRng("carve-sym");
    const puzzle = carve(randomSolution(rng), rng, { symmetric: true });
    for (let c = 0; c < CELLS; c++) {
      const mirrored = CELLS - 1 - c;
      expect(puzzle[c] === 0).toBe(puzzle[mirrored] === 0);
    }
    expect(hasUniqueSolution(puzzle)).toBe(true);
  });

  it("stops at a requested clue count", () => {
    const rng = makeRng("carve-target");
    const solution = randomSolution(rng);
    const puzzle = carve(solution, rng, { targetClues: 60 });
    expect(clueCount(puzzle)).toBeGreaterThanOrEqual(60);
    expect(hasUniqueSolution(puzzle)).toBe(true);
  });
});
