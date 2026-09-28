import { describe, expect, it } from "vitest";
import { countSolutions, hasUniqueSolution, solve } from "../exact-cover/dlx.js";
import { formatValues, fromValues, isConsistent, isFull, parseValues } from "../grid.js";
import { CELLS } from "../units.js";

const PUZZLE =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("exact-cover solver", () => {
  it("solves a classic puzzle", () => {
    const got = solve(parseValues(PUZZLE));
    expect(got).not.toBeNull();
    expect(formatValues(got!)).toBe(SOLUTION);
  });

  it("returns a genuinely valid grid", () => {
    const got = solve(parseValues(PUZZLE))!;
    const g = fromValues(got)!;
    expect(isFull(g)).toBe(true);
    expect(isConsistent(g)).toBe(true);
  });

  it("finds that puzzle unique", () => {
    expect(hasUniqueSolution(parseValues(PUZZLE))).toBe(true);
    expect(countSolutions(parseValues(PUZZLE), 5)).toBe(1);
  });

  it("finds an empty grid wildly non-unique", () => {
    const blank = ".".repeat(CELLS);
    expect(countSolutions(parseValues(blank), 2)).toBe(2);
    expect(hasUniqueSolution(parseValues(blank))).toBe(false);
  });

  it("reports zero solutions for conflicting givens", () => {
    const bad = `55${".".repeat(79)}`;
    expect(countSolutions(parseValues(bad))).toBe(0);
    expect(solve(parseValues(bad))).toBeNull();
  });

  it("reports zero solutions when a clue contradicts a unique puzzle", () => {
    // Since PUZZLE is unique, any deviation from SOLUTION kills it — even a
    // digit that conflicts with no peer and so survives `fromValues`.
    const puzzle = parseValues(PUZZLE);
    const solution = parseValues(SOLUTION);
    let checked = 0;

    for (let cell = 0; cell < CELLS && checked < 12; cell++) {
      if (puzzle[cell] !== 0) continue;
      for (let d = 1; d <= 9; d++) {
        if (d === solution[cell]) continue;
        const wrong = [...puzzle];
        wrong[cell] = d as 1;
        if (fromValues(wrong) === null) continue; // rejected by peers alone
        expect(countSolutions(wrong)).toBe(0);
        checked++;
        break;
      }
    }

    expect(checked).toBeGreaterThan(0);
  });

  it("leaves the solved grid unchanged", () => {
    expect(countSolutions(parseValues(SOLUTION))).toBe(1);
  });
});
