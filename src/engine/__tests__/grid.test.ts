import { describe, expect, it } from "vitest";
import { count, maskOf } from "../digits.js";
import {
  assign,
  candidatesAt,
  cloneGrid,
  eliminate,
  emptyGrid,
  formatValues,
  fromValues,
  isConsistent,
  isFull,
  parseValues,
  toValues,
  valueAt,
} from "../grid.js";
import { PEERS, cellAt } from "../units.js";

const SOLVED =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("grid state", () => {
  it("starts with every digit possible everywhere", () => {
    const g = emptyGrid();
    expect(count(candidatesAt(g, 0))).toBe(9);
    expect(isFull(g)).toBe(false);
    expect(isConsistent(g)).toBe(true);
  });

  it("clears an assigned digit from all 20 peers", () => {
    const g = emptyGrid();
    const cell = cellAt(4, 4);
    expect(assign(g, cell, 7)).toBe(true);
    expect(valueAt(g, cell)).toBe(7);
    for (const p of PEERS[cell]!) {
      expect(count(candidatesAt(g, p))).toBe(8);
    }
  });

  it("does not cascade past the sudoku rule itself", () => {
    // Filling eight cells of a row leaves the ninth a naked single, but the
    // grid must not place it: that deduction belongs to a technique (G2).
    const g = emptyGrid();
    for (let c = 0; c < 8; c++) expect(assign(g, cellAt(0, c), (c + 1) as 1)).toBe(true);
    expect(candidatesAt(g, cellAt(0, 8))).toBe(maskOf([9]));
    // The mask is a singleton, but nothing downstream was touched on its behalf.
    expect(valueAt(g, cellAt(1, 8))).toBeNull();
  });

  it("refuses an assignment the cell cannot take", () => {
    const g = emptyGrid();
    assign(g, cellAt(0, 0), 5);
    expect(assign(g, cellAt(0, 1), 5)).toBe(false);
  });

  it("reports contradiction when a cell empties", () => {
    const g = emptyGrid();
    for (let d = 1; d <= 8; d++) expect(eliminate(g, 0, d as 1)).toBe(true);
    expect(eliminate(g, 0, 9)).toBe(false);
  });

  it("round-trips a solved grid", () => {
    const values = parseValues(SOLVED);
    const g = fromValues(values);
    expect(g).not.toBeNull();
    expect(isFull(g!)).toBe(true);
    expect(isConsistent(g!)).toBe(true);
    expect(formatValues(toValues(g!))).toBe(SOLVED);
  });

  it("rejects givens that contradict", () => {
    const bad = `55${".".repeat(79)}`;
    expect(fromValues(parseValues(bad))).toBeNull();
  });

  it("clones without aliasing", () => {
    const g = emptyGrid();
    const copy = cloneGrid(g);
    assign(copy, 0, 3);
    expect(count(candidatesAt(g, 0))).toBe(9);
  });

  it("parses dots, zeroes and dashes as empty", () => {
    const v = parseValues(`.0-${"1".repeat(78)}`);
    expect(v.slice(0, 3)).toEqual([0, 0, 0]);
    expect(() => parseValues("123")).toThrow();
  });
});
