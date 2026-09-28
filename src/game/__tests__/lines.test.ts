import { describe, expect, it } from "vitest";
import type { Digit } from "../../engine/digits.js";
import type { Values } from "../../engine/grid.js";
import { CELLS, cellAt } from "../../engine/units.js";
import { MARKER_DEFS } from "../markers.js";

/** A grid holding only the digits a test cares about. */
function grid(placed: Record<number, number>): Values {
  const values = new Array<Digit | 0>(CELLS).fill(1 as Digit);
  for (const [cell, digit] of Object.entries(placed)) values[Number(cell)] = digit as Digit;
  return values;
}

/** Lay digits along a run of cells and return both the grid and the cells. */
function along(start: number, digits: number[]): { values: Values; cells: number[] } {
  const cells = digits.map((_, i) => start + i);
  const placed: Record<number, number> = {};
  cells.forEach((cell, i) => (placed[cell] = digits[i] as number));
  return { values: grid(placed), cells };
}

const holds = (type: keyof typeof MARKER_DEFS, digits: number[], start = cellAt(4, 0)) => {
  const { values, cells } = along(start, digits);
  return MARKER_DEFS[type].holds(values, cells);
};

describe("palindrome", () => {
  it("accepts a line that reads the same both ways", () => {
    expect(holds("palindrome", [1, 5, 9, 5, 1])).toBe(true);
    expect(holds("palindrome", [3, 7, 3])).toBe(true);
  });

  it("ignores the middle cell of an odd line", () => {
    expect(holds("palindrome", [2, 8, 2])).toBe(true);
    expect(holds("palindrome", [2, 4, 2])).toBe(true);
  });

  it("rejects a mismatched pair", () => {
    expect(holds("palindrome", [1, 5, 9, 5, 2])).toBe(false);
  });

  it("reads the same reversed", () => {
    const forward = along(cellAt(4, 0), [1, 5, 9, 5, 1]);
    expect(MARKER_DEFS.palindrome.holds(forward.values, [...forward.cells].reverse())).toBe(true);
  });
});

describe("dutch whisper", () => {
  it("accepts a gap of exactly four, which a German whisper refuses", () => {
    expect(holds("dutchWhisper", [1, 5, 1])).toBe(true);
    expect(holds("whisper", [1, 5, 1])).toBe(false);
  });

  it("rejects a gap of three", () => {
    expect(holds("dutchWhisper", [1, 4])).toBe(false);
  });

  it("lets 5 sit on the line, unlike a German whisper", () => {
    expect(holds("dutchWhisper", [9, 5, 1])).toBe(true);
    expect(holds("whisper", [9, 5, 1])).toBe(false);
  });
});

describe("renban", () => {
  it("accepts consecutive digits in any order", () => {
    expect(holds("renban", [4, 2, 3])).toBe(true);
    expect(holds("renban", [7, 9, 8])).toBe(true);
  });

  it("rejects a gap in the run", () => {
    expect(holds("renban", [4, 2, 5])).toBe(false);
  });

  it("rejects a repeat", () => {
    expect(holds("renban", [4, 4, 5])).toBe(false);
  });

  it("needs a 5 once it is five cells long", () => {
    // Every window of five consecutive digits contains 5.
    expect(holds("renban", [1, 2, 3, 4, 5])).toBe(true);
    expect(holds("renban", [5, 6, 7, 8, 9])).toBe(true);
    expect(holds("renban", [1, 2, 3, 4, 6])).toBe(false);
  });
});

describe("thermometer", () => {
  it("accepts digits increasing from the bulb", () => {
    expect(holds("thermo", [1, 5, 9])).toBe(true);
  });

  it("rejects a fall or a repeat", () => {
    expect(holds("thermo", [1, 9, 5])).toBe(false);
    expect(holds("thermo", [3, 3])).toBe(false);
  });

  it("cares which end the bulb is", () => {
    const { values, cells } = along(cellAt(4, 0), [2, 6]);
    expect(MARKER_DEFS.thermo.holds(values, cells)).toBe(true);
    expect(MARKER_DEFS.thermo.holds(values, [...cells].reverse())).toBe(false);
    expect(MARKER_DEFS.thermo.directional).toBe(true);
  });

  it("keeps 9 off the bulb and 1 off everything after it", () => {
    expect(MARKER_DEFS.thermo.projectionAt(0) & (1 << 8)).toBe(0);
    expect(MARKER_DEFS.thermo.projectionAt(1) & 1).toBe(0);
  });
});

describe("region sum line", () => {
  // Row 1 columns 3-5: column 3 is in box 1, columns 4 and 5 in box 2.
  const cells = [cellAt(0, 2), cellAt(0, 3), cellAt(0, 4)];

  it("accepts segments that add to the same total", () => {
    const values = grid({ [cells[0]!]: 9, [cells[1]!]: 4, [cells[2]!]: 5 });
    expect(MARKER_DEFS.regionSum.holds(values, cells)).toBe(true);
  });

  it("rejects segments that do not", () => {
    const values = grid({ [cells[0]!]: 8, [cells[1]!]: 4, [cells[2]!]: 5 });
    expect(MARKER_DEFS.regionSum.holds(values, cells)).toBe(false);
  });

  it("refuses a line that never leaves its box, which says nothing", () => {
    const inside = [cellAt(0, 0), cellAt(0, 1), cellAt(0, 2)];
    const values = grid({ [inside[0]!]: 1, [inside[1]!]: 2, [inside[2]!]: 3 });
    expect(MARKER_DEFS.regionSum.holds(values, inside)).toBe(false);
  });
});

describe("entropic line", () => {
  it("accepts one digit from each band in every window of three", () => {
    expect(holds("entropic", [1, 4, 7])).toBe(true);
    expect(holds("entropic", [3, 6, 9])).toBe(true);
  });

  it("rejects two digits from one band inside a window", () => {
    expect(holds("entropic", [1, 2, 7])).toBe(false);
  });

  it("forces the bands to repeat in a cycle", () => {
    // Low, middle, high, then low again: the fourth is pinned to its band.
    expect(holds("entropic", [1, 4, 7, 2])).toBe(true);
    expect(holds("entropic", [1, 4, 7, 5])).toBe(false);
  });
});

describe("every marker type", () => {
  it("leaves at least two digits possible in every position (R7)", () => {
    for (const def of Object.values(MARKER_DEFS)) {
      for (let index = 0; index < 4; index++) {
        const mask = def.projectionAt(index);
        const count = [...Array(9).keys()].filter((d) => mask & (1 << d)).length;
        expect(count, `${def.type} at ${index}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("refuses a line shorter than its minimum", () => {
    const { values, cells } = along(cellAt(4, 0), [1, 2, 3, 4]);
    for (const def of Object.values(MARKER_DEFS)) {
      if (def.minCells < 2) continue;
      expect(def.holds(values, cells.slice(0, def.minCells - 1)), def.type).toBe(false);
    }
  });
});
