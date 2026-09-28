// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cellAt } from "../../engine/units.js";
import { BoardView, cellCentre, dotLayout, pathPoints } from "../board.js";

function makeView(): BoardView {
  return new BoardView(
    "A",
    () => {},
    () => {},
  );
}

describe("selection gestures", () => {
  it("selects a run by dragging", () => {
    const view = makeView();
    view.beginSelection(10, false);
    view.extendSelection(11);
    view.extendSelection(12);
    expect([...view.selection]).toEqual([10, 11, 12]);
  });

  it("replaces the selection when a drag starts without a modifier", () => {
    const view = makeView();
    view.beginSelection(10, false);
    view.extendSelection(11);
    view.beginSelection(40, false);
    expect([...view.selection]).toEqual([40]);
  });

  it("adds to the selection when a drag starts on an unselected cell", () => {
    const view = makeView();
    view.beginSelection(10, false);
    view.beginSelection(20, true);
    view.extendSelection(21);
    expect([...view.selection]).toEqual([10, 20, 21]);
  });

  it("deselects a whole run when the drag starts on a selected cell", () => {
    const view = makeView();
    view.beginSelection(10, false);
    view.extendSelection(11);
    view.extendSelection(12);
    view.extendSelection(13);

    // Start again on a cell already in the selection: the gesture now removes.
    view.beginSelection(11, true);
    view.extendSelection(12);
    view.extendSelection(13);
    expect([...view.selection]).toEqual([10]);
  });

  it("keeps a gesture's direction fixed, so retracing does not flicker", () => {
    const view = makeView();
    view.beginSelection(10, false);
    view.extendSelection(11);
    // Dragging back over a cell already added must leave it added.
    view.extendSelection(10);
    view.extendSelection(11);
    expect([...view.selection]).toEqual([10, 11]);
  });

  it("leaves untouched cells alone while deselecting", () => {
    const view = makeView();
    for (const cell of [10, 11, 12, 30]) view.beginSelection(cell, true);
    view.beginSelection(11, true);
    view.extendSelection(12);
    expect([...view.selection].sort((a, b) => a - b)).toEqual([10, 30]);
  });
});

describe("line paths", () => {
  it("runs through cell centres, not along borders", () => {
    expect(cellCentre(cellAt(0, 0))).toEqual({ x: 0.5, y: 0.5 });
    expect(pathPoints([cellAt(0, 0), cellAt(0, 1)])).toBe("0.5,0.5 1.5,0.5");
  });

  it("follows a path of any length", () => {
    const cells = [cellAt(2, 2), cellAt(2, 3), cellAt(3, 4), cellAt(4, 4)];
    expect(pathPoints(cells)).toBe("2.5,2.5 3.5,2.5 4.5,3.5 4.5,4.5");
  });

  it("handles a diagonal step", () => {
    expect(pathPoints([cellAt(0, 0), cellAt(1, 1)])).toBe("0.5,0.5 1.5,1.5");
  });
});

describe("dot layout", () => {
  it("centres a lone dot on the shared edge", () => {
    // Columns 3 and 4 meet at x = 4; the pair shares row 3, whose centre is 3.5.
    const [only] = dotLayout(cellAt(3, 3), cellAt(3, 4), 1);
    expect(only).toEqual({ x: 4, y: 3.5 });
  });

  it("spreads two dots along a vertical shared edge", () => {
    // Side-by-side cells: the edge between them runs up and down, so the dots
    // separate in y and stay on the boundary in x.
    const [first, second] = dotLayout(cellAt(3, 3), cellAt(3, 4), 2);
    expect(first!.x).toBe(4);
    expect(second!.x).toBe(4);
    expect(first!.y).toBeLessThan(second!.y);
    expect(second!.y - first!.y).toBeCloseTo(0.33, 5);
  });

  it("spreads two dots along a horizontal shared edge", () => {
    const [first, second] = dotLayout(cellAt(3, 3), cellAt(4, 3), 2);
    expect(first!.y).toBe(4);
    expect(second!.y).toBe(4);
    expect(first!.x).toBeLessThan(second!.x);
  });

  it("keeps the spread symmetric about the midpoint", () => {
    for (const count of [1, 2, 3]) {
      const dots = dotLayout(cellAt(3, 3), cellAt(3, 4), count);
      const mean = dots.reduce((sum, d) => sum + d.y, 0) / dots.length;
      expect(mean).toBeCloseTo(3.5, 5);
    }
  });

  it("keeps every dot inside the two cells it straddles", () => {
    for (const count of [1, 2]) {
      for (const dot of dotLayout(cellAt(3, 3), cellAt(3, 4), count)) {
        expect(dot.y).toBeGreaterThan(3);
        expect(dot.y).toBeLessThan(4);
      }
    }
  });
});
