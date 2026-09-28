import { describe, expect, it } from "vitest";
import { makeRng } from "../../engine/rng.js";
import { ALL, digitsOf } from "../../engine/digits.js";
import { CELLS, PEERS, colOf, rowOf } from "../../engine/units.js";
import { fogCount, initialFog, isConnected, neighbourhood } from "../fog.js";
import {
  ALL_MARKER_TYPES,
  MARKER_DEFS,
  MAX_PALETTE,
  areAdjacent,
  areKingAdjacent,
  countInstances,
  knightTargets,
} from "../markers.js";
import { Session, conjunctionAt } from "../session.js";
import { PLAYERS, type MarkerType } from "../types.js";

const SEEDS = Array.from({ length: 40 }, (_, i) => `shape-${i}`);
/** An adjacent pair, both visible to A, whose solution digits satisfy `match`. */
function findPair(
  session: Session,
  match: (a: number, b: number) => boolean,
): [number, number] | null {
  for (let cell = 0; cell < CELLS; cell++) {
    if (session.isHiddenFor("A", cell)) continue;
    for (const other of [cell + 1, cell + 9]) {
      if (other >= CELLS || !areAdjacent(cell, other)) continue;
      if (session.isHiddenFor("A", other)) continue;
      const x = session.solution[cell] as number;
      const y = session.solution[other] as number;
      if (match(x, y)) return [cell, other];
    }
  }
  return null;
}

describe("initial fog shape (R10a, R10b)", () => {
  it("never shows a cell to both players (R10b)", () => {
    for (const seed of SEEDS) {
      const fog = initialFog(makeRng(seed));
      for (let cell = 0; cell < CELLS; cell++) {
        expect(fog.A[cell] === 0 && fog.B[cell] === 0).toBe(false);
      }
    }
  });

  it("keeps every visible and fogged region connected (R10a)", () => {
    for (const seed of SEEDS) {
      const fog = initialFog(makeRng(seed));
      for (const player of PLAYERS) {
        expect(isConnected((c) => fog[player][c] === 1), `${seed} fog ${player}`).toBe(true);
        expect(isConnected((c) => fog[player][c] === 0), `${seed} view ${player}`).toBe(true);
      }
    }
  });

  it("gives both players a workable view", () => {
    for (const seed of SEEDS) {
      const fog = initialFog(makeRng(seed));
      for (const player of PLAYERS) {
        const visible = CELLS - fogCount(fog, player);
        expect(visible, `${seed} ${player}`).toBeGreaterThanOrEqual(20);
        expect(visible).toBeLessThanOrEqual(40);
      }
    }
  });

  it("leaves a no-man's-land neither player can see", () => {
    let withDark = 0;
    for (const seed of SEEDS) {
      const fog = initialFog(makeRng(seed));
      let dark = 0;
      for (let cell = 0; cell < CELLS; cell++) {
        if (fog.A[cell] === 1 && fog.B[cell] === 1) dark++;
      }
      if (dark > 0) withDark++;
    }
    expect(withDark).toBe(SEEDS.length);
  });

  it("draws a different shape for every seed", () => {
    const shapes = new Set(SEEDS.map((s) => initialFog(makeRng(s)).A.join("")));
    expect(shapes.size).toBe(SEEDS.length);
  });

  it("does not cut the board along a straight line", () => {
    // A column split would make every visible region a union of whole columns.
    // Organic growth should leave partial columns almost every time.
    let ragged = 0;
    for (const seed of SEEDS) {
      const fog = initialFog(makeRng(seed));
      const columns = new Map<number, Set<number>>();
      for (let cell = 0; cell < CELLS; cell++) {
        if (fog.A[cell] !== 0) continue;
        const col = colOf(cell);
        if (!columns.has(col)) columns.set(col, new Set());
        columns.get(col)!.add(rowOf(cell));
      }
      if ([...columns.values()].some((rows) => rows.size > 0 && rows.size < 9)) ragged++;
    }
    expect(ragged).toBe(SEEDS.length);
  });
});

describe("two boards, one solution", () => {
  it("gives each player only the givens they can see", () => {
    const session = new Session("boards");
    for (let cell = 0; cell < CELLS; cell++) {
      for (const player of PLAYERS) {
        const expected = session.isHiddenFor(player, cell)
          ? 0
          : (session.givens[cell] ?? 0);
        expect(session.valueAt(player, cell)).toBe(expected);
      }
    }
  });

  it("keeps one player's placements off the other's board", () => {
    const session = new Session("independent");
    const cell = [...Array(CELLS).keys()].find(
      (c) => session.valueAt("A", c) === 0 && session.valueAt("B", c) === 0,
    )!;
    session.setDigit("A", [cell], session.solution[cell] as 1);
    expect(session.valueAt("A", cell)).toBe(session.solution[cell]);
    expect(session.valueAt("B", cell)).toBe(0);
  });

  it("needs both grids finished to win", () => {
    const session = new Session("win");
    for (let cell = 0; cell < CELLS; cell++) {
      session.setDigit("A", [cell], session.solution[cell] as 1);
    }
    expect(session.isCompleteFor("A")).toBe(true);
    expect(session.isCompleteFor("B")).toBe(false);
    expect(session.isWon()).toBe(false);

    for (let cell = 0; cell < CELLS; cell++) {
      session.setDigit("B", [cell], session.solution[cell] as 1);
    }
    expect(session.isWon()).toBe(true);
  });
});

describe("session play", () => {
  it("lifts fog only on a correct placement", () => {
    const session = new Session("fog-test");
    const target = [...Array(CELLS).keys()].find(
      (c) => !session.isGiven(c) && session.isHiddenFor("A", c),
    )!;
    const truth = session.solution[target] as number;
    const wrong = ((truth % 9) + 1) as 1;

    const before = fogCount(session.fog, "A");
    session.setDigit("A", [target], wrong);
    expect(fogCount(session.fog, "A")).toBe(before);
    expect(session.wrongGuesses.A).toBe(1);

    session.setDigit("A", [target], truth as 1);
    expect(fogCount(session.fog, "A")).toBeLessThan(before);
  });

  it("lifts fog on the placer's board only", () => {
    const session = new Session("own-fog");
    const target = [...Array(CELLS).keys()].find((c) =>
      session.isHiddenFor("A", c) && session.isHiddenFor("B", c),
    )!;
    const beforeB = fogCount(session.fog, "B");
    session.setDigit("A", [target], session.solution[target] as 1);
    expect(session.isHiddenFor("A", target)).toBe(false);
    expect(session.isHiddenFor("B", target)).toBe(true);
    expect(fogCount(session.fog, "B")).toBe(beforeB);
  });

  it("hands over a given that was hiding in the fog it lifts", () => {
    const session = new Session("hidden-givens");
    for (let cell = 0; cell < CELLS; cell++) {
      if (!session.isHiddenFor("A", cell)) continue;
      session.setDigit("A", [cell], session.solution[cell] as 1);
    }
    // Every given is now on A's board, whether or not A could see it initially.
    for (let cell = 0; cell < CELLS; cell++) {
      if (session.isGiven(cell)) {
        expect(session.valueAt("A", cell)).toBe(session.givens[cell]);
      }
    }
  });

  it("allows placing into a fogged cell (R2)", () => {
    const session = new Session("r2-test");
    const target = [...Array(CELLS).keys()].find(
      (c) => !session.isGiven(c) && session.isHiddenFor("A", c),
    )!;
    const result = session.setDigit("A", [target], session.solution[target] as 1);
    expect(result.ok).toBe(true);
    expect(result.correct).toBe(true);
    expect(session.isHiddenFor("A", target)).toBe(false);
  });

  it("locks a cell once it holds the right digit", () => {
    const session = new Session("lock");
    const cell = [...Array(CELLS).keys()].find((c) => session.valueAt("A", c) === 0)!;
    session.setDigit("A", [cell], session.solution[cell] as 1);
    const wrong = (((session.solution[cell] as number) % 9) + 1) as 1;
    expect(session.setDigit("A", [cell], wrong).ok).toBe(false);
    expect(session.valueAt("A", cell)).toBe(session.solution[cell]);
    session.clear("A", [cell]);
    expect(session.valueAt("A", cell)).toBe(session.solution[cell]);
  });

  it("refuses to overwrite a visible given", () => {
    const session = new Session("givens");
    const given = [...Array(CELLS).keys()].find(
      (c) => session.isGiven(c) && !session.isHiddenFor("A", c),
    )!;
    const result = session.setDigit("A", [given], 5);
    expect(result.ok).toBe(false);
    expect(session.valueAt("A", given)).toBe(session.solution[given]);
  });

  it("keeps pencil marks private to each player", () => {
    const session = new Session("notes");
    const cell = [...Array(CELLS).keys()].find((c) => session.valueAt("A", c) === 0)!;
    session.toggleMark("A", "centre", [cell], 4);
    expect(session.notes.A.centre[cell]).not.toBe(0);
    expect(session.notes.B.centre[cell]).toBe(0);
  });

  it("undoes and redoes", () => {
    const session = new Session("undo");
    const cell = [...Array(CELLS).keys()].find(
      (c) => session.valueAt("A", c) === 0 && session.solution[c] !== 7,
    )!;
    session.setDigit("A", [cell], 7);
    expect(session.valueAt("A", cell)).toBe(7);
    expect(session.undo()).toBe(true);
    expect(session.valueAt("A", cell)).toBe(0);
    expect(session.redo()).toBe(true);
    expect(session.valueAt("A", cell)).toBe(7);
  });
});

describe("contradicting pencil marks", () => {
  it("reports every digit standing in a cell's row, column or box", () => {
    const session = new Session("peers");
    const cell = [...Array(CELLS).keys()].find((c) => session.valueAt("A", c) === 0)!;

    const mask = session.peerDigits("A", cell);
    const expected = new Set<number>();
    for (const peer of PEERS[cell]!) {
      const v = session.valueAt("A", peer);
      if (v !== 0) expected.add(v);
    }
    expect(new Set(digitsOf(mask))).toEqual(expected);
  });

  it("flags a mark once its digit is placed in the same unit", () => {
    const session = new Session("clash");
    const cell = [...Array(CELLS).keys()].find(
      (c) => session.valueAt("A", c) === 0 && session.peerDigits("A", c) !== ALL,
    )!;
    const free = digitsOf(ALL & ~session.peerDigits("A", cell))[0]!;
    expect(digitsOf(session.peerDigits("A", cell))).not.toContain(free);

    // Put that digit in a peer the player may still write to.
    const peer = PEERS[cell]!.find((c) => session.valueAt("A", c) === 0)!;
    session.setDigit("A", [peer], free);
    expect(digitsOf(session.peerDigits("A", cell))).toContain(free);
  });

  it("never consults the solution", () => {
    // A cell's own answer is not a clash until something on the board says so.
    const session = new Session("no-oracle");
    const cell = [...Array(CELLS).keys()].find((c) => session.valueAt("A", c) === 0)!;
    expect(digitsOf(session.peerDigits("A", cell))).not.toContain(session.solution[cell]);
  });
});

/** A session whose drawn palette happens to contain every listed type. */
function sessionWithPalette(required: readonly MarkerType[]): Session {
  for (let i = 0; i < 400; i++) {
    const session = new Session(`palette-${required.join("-")}-${i}`);
    if (required.every((type) => session.palette.includes(type))) return session;
  }
  throw new Error(`no seed drew a palette containing ${required.join(", ")}`);
}

describe("palette (R5)", () => {
  it("draws at most three types", () => {
    for (let i = 0; i < 30; i++) {
      const { palette } = new Session(`pal-size-${i}`);
      expect(palette.length).toBeGreaterThan(0);
      expect(palette.length).toBeLessThanOrEqual(MAX_PALETTE);
      expect(new Set(palette).size).toBe(palette.length);
    }
  });

  it("varies the vocabulary from puzzle to puzzle", () => {
    const seen = new Set<string>();
    const types = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const { palette } = new Session(`pal-vary-${i}`);
      seen.add([...palette].sort().join(","));
      for (const type of palette) types.add(type);
    }
    expect(seen.size).toBeGreaterThan(5);
    // Over forty puzzles the draw should reach most of the catalogue.
    expect(types.size).toBeGreaterThanOrEqual(ALL_MARKER_TYPES.length - 2);
  });

  it("only offers types that actually occur on the grid", () => {
    for (let i = 0; i < 20; i++) {
      const session = new Session(`pal-usable-${i}`);
      for (const type of session.palette) {
        expect(
          countInstances(MARKER_DEFS[type], session.solution),
          `${type} has no instances`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("refuses a marker type outside the palette", () => {
    const session = new Session("pal-refuse");
    const absent = ALL_MARKER_TYPES.find((t) => !session.palette.includes(t))!;
    const visible = [...Array(CELLS).keys()].find((c) => !session.isHiddenFor("A", c))!;
    const result = session.addMarker("A", absent, [visible]);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/palette/);
  });
});

describe("markers", () => {
  it("accepts a true relation and refuses a false one", () => {
    const session = sessionWithPalette(["consecutive"]);
    let placed = false;
    let refused = false;

    for (let cell = 0; cell < CELLS && !(placed && refused); cell++) {
      for (const other of [cell + 1, cell + 9]) {
        if (other >= CELLS || !areAdjacent(cell, other)) continue;
        if (session.isHiddenFor("A", cell) || session.isHiddenFor("A", other)) continue;
        const holds = MARKER_DEFS.consecutive.holds(session.solution, [cell, other]);
        const result = session.addMarker("A", "consecutive", [cell, other]);
        expect(result.ok).toBe(holds);
        if (holds) placed = true;
        else refused = true;
      }
    }

    expect(placed).toBe(true);
    expect(refused).toBe(true);
  });

  it("refuses a marker on cells the placer cannot see", () => {
    const session = new Session("markers-own-side");
    const type = session.palette[0] as MarkerType;
    const def = MARKER_DEFS[type];
    const hidden = [...Array(CELLS).keys()].filter((c) => session.isHiddenFor("A", c));
    const cells = def.minCells === 1 ? [hidden[0]!] : [hidden[0]!, hidden[0]! + 1];

    const result = session.addMarker("A", type, cells);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cannot see|sharing an edge|unbroken/);
  });

  it("refuses a pair that is not adjacent", () => {
    const session = sessionWithPalette(["double"]);
    const visible = [...Array(CELLS).keys()].filter((c) => !session.isHiddenFor("A", c));
    const pair = visible.flatMap((a) =>
      visible.filter((b) => b > a && !areAdjacent(a, b)).map((b) => [a, b]),
    )[0]!;

    const result = session.addMarker("A", "double", pair);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/sharing an edge/);
  });

  it("places a badge only where its disequality holds", () => {
    const session = sessionWithPalette(["knight"]);
    for (let cell = 0; cell < CELLS; cell++) {
      if (session.isHiddenFor("A", cell)) continue;
      const value = session.solution[cell];
      const holds = knightTargets(cell).every((t) => session.solution[t] !== value);
      expect(session.addMarker("A", "knight", [cell]).ok).toBe(holds);
    }
  });

  it("respects the order of a directional marker", () => {
    const session = sessionWithPalette(["greater"]);
    const pair = findPair(session, (x, y) => x !== y);
    expect(pair).not.toBeNull();
    const [a, b] = pair as [number, number];
    const larger = (session.solution[a] as number) > (session.solution[b] as number);

    expect(session.addMarker("A", "greater", [a, b]).ok).toBe(larger);
    expect(session.addMarker("A", "greater", [b, a]).ok).toBe(!larger);
  });

  it("accepts consecutive and double on the same pair when both hold", () => {
    // 1 and 2 are consecutive *and* double, so both relations are true of that
    // pair and both are legal.
    for (let attempt = 0; attempt < 400; attempt++) {
      const session = new Session(`both-hold-${attempt}`);
      if (!["consecutive", "double"].every((t) => session.palette.includes(t as MarkerType))) {
        continue;
      }
      const pair = findPair(session, (x, y) => (x === 1 && y === 2) || (x === 2 && y === 1));
      if (!pair) continue;

      expect(session.addMarker("A", "consecutive", pair).ok).toBe(true);
      expect(session.addMarker("A", "double", pair).ok).toBe(true);
      expect(session.markers).toHaveLength(2);

      const third = session.addMarker("A", "consecutive", pair);
      expect(third.ok).toBe(false);
      expect(third.reason).toMatch(/already on/);
      return;
    }
    throw new Error("no seed gave both types and a visible 1/2 pair");
  });

  it("does not refuse a marker merely because others touch the cell (R8)", () => {
    // The old rule was a flat cap of two markers per cell, which a whisper
    // line broke by spending cap on every cell it crossed. What R8 actually
    // forbids is markers that between them name a digit.
    const session = sessionWithPalette(["whisper", "king"]);

    const line = findPair(session, (x, y) => Math.abs(x - y) >= 5);
    expect(line).not.toBeNull();
    const [a, b] = line as [number, number];
    expect(session.addMarker("A", "whisper", [a, b]).ok).toBe(true);

    // A badge on a cell the line already crosses must still be allowed when
    // its disequality holds — a badge rules out nothing for its own cell.
    for (const cell of [a, b]) {
      const result = session.addMarker("A", "king", [cell]);
      const trulyHolds = MARKER_DEFS.king.holds(session.solution, [cell]);
      expect(result.ok, result.reason).toBe(trulyHolds);
    }
  });

  it("keeps at least two digits possible wherever markers meet", () => {
    const session = sessionWithPalette(["whisper"]);
    const line = findPair(session, (x, y) => Math.abs(x - y) >= 5) as [number, number];
    session.addMarker("A", "whisper", line);

    for (const cell of line) {
      // A whisper rules out 5 and nothing else, so eight digits survive.
      const mask = conjunctionAt(session.markers, cell);
      expect(digitsOf(mask)).not.toContain(5);
      expect(digitsOf(mask)).toHaveLength(8);
    }
    // A cell no marker touches is unconstrained.
    const untouched = [...Array(CELLS).keys()].find((c) => !line.includes(c))!;
    expect(digitsOf(conjunctionAt(session.markers, untouched))).toHaveLength(9);
  });

  it("removes markers touching a selection, but only the placer's own", () => {
    const session = sessionWithPalette(["knight"]);
    const cell = [...Array(CELLS).keys()].find(
      (c) => !session.isHiddenFor("A", c) && session.addMarker("A", "knight", [c]).ok,
    )!;
    expect(session.markers).toHaveLength(1);
    // R9: only the placer may retract.
    expect(session.removeMarkersAt("B", [cell])).toHaveLength(0);
    expect(session.removeMarkersAt("A", [cell])).toHaveLength(1);
    expect(session.markers).toHaveLength(0);
  });
});
