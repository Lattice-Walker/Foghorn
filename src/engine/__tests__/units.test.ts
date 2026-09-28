import { describe, expect, it } from "vitest";
import {
  BOXES,
  CELLS,
  COLS,
  PEERS,
  ROWS,
  UNITS,
  UNITS_OF,
  boxOf,
  cellAt,
  colOf,
  formatCell,
  mutuallySee,
  parseCell,
  rowOf,
  sees,
} from "../units.js";

describe("grid geometry", () => {
  it("has 27 units of nine cells each", () => {
    expect(UNITS).toHaveLength(27);
    expect(ROWS).toHaveLength(9);
    expect(COLS).toHaveLength(9);
    expect(BOXES).toHaveLength(9);
    for (const u of UNITS) expect(u.cells).toHaveLength(9);
  });

  it("covers every cell exactly three times", () => {
    const seen = new Array<number>(CELLS).fill(0);
    for (const u of UNITS) for (const c of u.cells) seen[c]!++;
    expect(seen.every((n) => n === 3)).toBe(true);
    for (let c = 0; c < CELLS; c++) expect(UNITS_OF[c]).toHaveLength(3);
  });

  it("maps cells to row, column and box", () => {
    expect(rowOf(cellAt(3, 5))).toBe(3);
    expect(colOf(cellAt(3, 5))).toBe(5);
    expect(boxOf(cellAt(0, 0))).toBe(0);
    expect(boxOf(cellAt(4, 4))).toBe(4);
    expect(boxOf(cellAt(8, 8))).toBe(8);
    expect(boxOf(cellAt(0, 8))).toBe(2);
    expect(boxOf(cellAt(8, 0))).toBe(6);
  });

  it("gives every cell 20 peers", () => {
    for (let c = 0; c < CELLS; c++) {
      expect(PEERS[c]).toHaveLength(20);
      expect(PEERS[c]).not.toContain(c);
    }
  });

  it("makes seeing symmetric", () => {
    for (let a = 0; a < CELLS; a++) {
      for (const b of PEERS[a]!) expect(sees(b, a)).toBe(true);
    }
  });

  it("detects mutual sight", () => {
    expect(mutuallySee([cellAt(0, 0), cellAt(0, 1), cellAt(0, 2)])).toBe(true);
    expect(mutuallySee([cellAt(0, 0), cellAt(0, 1), cellAt(5, 5)])).toBe(false);
  });

  it("parses and formats cell references", () => {
    expect(formatCell(cellAt(3, 6))).toBe("r4c7");
    expect(parseCell("r4c7")).toBe(cellAt(3, 6));
    expect(() => parseCell("r0c1")).toThrow();
  });
});
