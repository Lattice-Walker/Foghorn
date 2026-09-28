// @vitest-environment jsdom
/**
 * The board-fitting arithmetic. The measuring around it needs a real layout
 * engine, but this part is where a wrong answer shows: a board a few pixels
 * too tall is what makes the page scroll, which is the whole thing being
 * avoided.
 */

import { describe, expect, it } from "vitest";
import { fitBoards, squareSide } from "../fit.js";

describe("square side", () => {
  it("takes the width when the pane is taller than it is wide", () => {
    expect(squareSide(400, 900, 40)).toBe(400);
  });

  it("takes what is left of the height when that runs out first", () => {
    expect(squareSide(900, 400, 40)).toBe(360);
  });

  // The heading sits above the grid, so its height is never available to it.
  it("always subtracts the heading", () => {
    expect(squareSide(500, 500, 40)).toBe(460);
    expect(squareSide(500, 500, 0)).toBe(500);
  });

  it("rounds down, so nine cell borders land on whole pixels", () => {
    expect(squareSide(400.7, 900, 0)).toBe(400);
    expect(squareSide(900, 440.9, 40)).toBe(400);
  });

  it("never returns a negative side when the heading outgrows the pane", () => {
    expect(squareSide(400, 30, 40)).toBe(0);
  });
});

describe("fitting in an environment with no layout", () => {
  // jsdom has neither matchMedia nor ResizeObserver, and neither does a very
  // old browser; the stylesheet's sizing has to stand on its own there.
  it("does nothing and hands back a teardown that also does nothing", () => {
    const panes = document.createElement("div");
    const stop = fitBoards(panes);
    expect(() => stop()).not.toThrow();
  });
});
