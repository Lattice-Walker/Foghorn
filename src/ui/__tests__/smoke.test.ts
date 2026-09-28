// @vitest-environment jsdom
/**
 * Boot the whole hot-seat app in jsdom and drive it the way a player would.
 * Catches the class of failure a typecheck cannot: a selector that matches
 * nothing, a listener wired to the wrong element, a render that throws.
 */

import { beforeAll, describe, expect, it } from "vitest";

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
}

/**
 * Two quick presses on a cell.
 *
 * Deliberately not a synthetic `dblclick`: the board calls preventDefault on
 * pointerdown, so a real browser never produces one there. Dispatching one
 * directly would test a path that cannot happen.
 */
function doubleClick(el: Element): void {
  click(el);
  click(el);
}

function press(key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
}

/** A physical key press, with whatever character the layout would produce. */
function pressPhysical(code: string, key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { code, key, bubbles: true, ...init }),
  );
}

function pane(player: "A" | "B"): HTMLElement {
  return document.querySelector(`.pane[data-player="${player}"]`) as HTMLElement;
}

function cells(player: "A" | "B"): HTMLElement[] {
  return [...pane(player).querySelectorAll<HTMLElement>(".cell")];
}

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await import("../main.js");

  // The app seeds itself from Math.random() on load, so without pinning one
  // here the whole suite runs against a different puzzle and a different fog
  // shape every time — and tests that need, say, a visible digit with an empty
  // visible neighbour fail on the unlucky draws rather than on a real defect.
  const seed = document.querySelector("#seed") as HTMLInputElement;
  seed.value = "smoke-fixture";
  (document.querySelector("#new") as HTMLElement).dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
});

describe("hot-seat app", () => {
  it("renders two panes of 81 cells", () => {
    expect(document.querySelectorAll(".pane")).toHaveLength(2);
    expect(cells("A")).toHaveLength(81);
    expect(cells("B")).toHaveLength(81);
  });

  it("fogs the two views disjointly, with a no-man's-land between", () => {
    const a = cells("A");
    const b = cells("B");
    let clearA = 0;
    let clearB = 0;
    let dark = 0;

    for (let i = 0; i < 81; i++) {
      const hiddenA = (a[i] as HTMLElement).classList.contains("hidden");
      const hiddenB = (b[i] as HTMLElement).classList.contains("hidden");
      // R10b: never visible to both. The shape itself is random per seed, so
      // asserting a geometry here would just re-encode the generator.
      expect(hiddenA || hiddenB).toBe(true);
      if (!hiddenA) clearA++;
      if (!hiddenB) clearB++;
      if (hiddenA && hiddenB) dark++;
    }

    expect(clearA).toBeGreaterThan(15);
    expect(clearB).toBeGreaterThan(15);
    expect(dark).toBeGreaterThan(0);
  });

  it("keeps board-internal class names out of the page chrome", () => {
    // A class shared between an absolutely-positioned board overlay and a
    // layout element stretches that element across the viewport and hides the
    // page behind it. That shipped once, as `.markers` on both the SVG overlay
    // and the markers control group. jsdom applies no CSS, so the only way to
    // catch it here is structurally.
    const boardClasses = new Set<string>();
    for (const el of document.querySelectorAll(".board *")) {
      for (const name of el.classList) boardClasses.add(name);
    }

    const collisions = new Set<string>();
    for (const el of document.querySelectorAll("#app *")) {
      if (el.closest(".board")) continue;
      for (const name of el.classList) {
        if (boardClasses.has(name)) collisions.add(name);
      }
    }

    expect([...collisions]).toEqual([]);
  });

  it("renders the controls", () => {
    expect(document.querySelectorAll("#digits button")).toHaveLength(9);
    expect(document.querySelectorAll("#modes button")).toHaveLength(4);
    expect(document.querySelectorAll("#markers button")).toHaveLength(3);
  });

  it("selects a cell on click and makes its pane active", () => {
    const target = cells("A")[0] as HTMLElement;
    click(target);
    expect(target.classList.contains("selected")).toBe(true);
    expect(pane("A").classList.contains("active")).toBe(true);
  });

  it("enters a digit into a selected empty cell", () => {
    const empty = cells("A").find(
      (c) => !c.classList.contains("given") && !c.classList.contains("hidden"),
    ) as HTMLElement;
    click(empty);
    press("4");
    const shown = (empty.querySelector(".value") as HTMLElement).textContent;
    expect(shown).toBe("4");
  });

  it("stacks the fog beneath the cell's own layers", () => {
    // jsdom paints nothing, so the orderable proxy is DOM order: the fog must
    // come first, and every layer the player writes to must come after it.
    const cell = cells("A")[0] as HTMLElement;
    const order = [...cell.children].map((c) => c.className.split(" ")[0]);
    expect(order[0]).toBe("fog");
    expect(order.slice(1)).toEqual(["colour", "corner", "centre", "value"]);
  });

  it("lays a wrong guess over the fog in red", () => {
    let found: HTMLElement | null = null;

    for (const cell of cells("A")) {
      if (!cell.classList.contains("hidden")) continue;
      click(cell);
      for (let digit = 1; digit <= 9; digit++) {
        press(String(digit));
        if (!cell.classList.contains("hidden")) break; // that one was right
        const shown = (cell.querySelector(".value") as HTMLElement).textContent;
        if (shown === String(digit)) {
          found = cell;
          break;
        }
      }
      if (found) break;
    }

    expect(found, "no fogged cell accepted a wrong guess").not.toBeNull();
    expect((found as HTMLElement).classList.contains("hidden")).toBe(true);
    expect((found as HTMLElement).classList.contains("wrong")).toBe(true);
  });

  it("lays crayon colour over the fog", () => {
    const fogged = cells("A").find((c) => c.classList.contains("hidden")) as HTMLElement;
    click(fogged);
    press("3", { altKey: true });
    expect((fogged.querySelector(".colour") as HTMLElement).className).toContain("c3");
    expect(fogged.classList.contains("hidden")).toBe(true);
  });

  it("writes centre marks with Ctrl and corner marks with Shift", () => {
    const blank = cells("A").find(
      (c) =>
        !c.classList.contains("given") &&
        !c.classList.contains("hidden") &&
        (c.querySelector(".value") as HTMLElement).textContent === "",
    ) as HTMLElement;
    click(blank);

    press("7", { ctrlKey: true });
    expect((blank.querySelector(".centre") as HTMLElement).textContent).toBe("7");

    press("2", { shiftKey: true });
    const corner = [...blank.querySelectorAll(".corner span")]
      .map((s) => s.textContent)
      .join("");
    expect(corner).toBe("2");
  });

  it("lights up a pencil mark that contradicts the grid", () => {
    const all = cells("A");
    const peersOf = (i: number): number[] => {
      const row = Math.floor(i / 9);
      const col = i % 9;
      const out: number[] = [];
      for (let k = 0; k < 81; k++) {
        if (k === i) continue;
        const sameBox =
          Math.floor(row / 3) === Math.floor(Math.floor(k / 9) / 3) &&
          Math.floor(col / 3) === Math.floor((k % 9) / 3);
        if (Math.floor(k / 9) === row || k % 9 === col || sameBox) out.push(k);
      }
      return out;
    };

    const valueOf = (el: HTMLElement) =>
      (el.querySelector(".value") as HTMLElement).textContent ?? "";

    let flagged = false;
    for (let i = 0; i < 81 && !flagged; i++) {
      const source = all[i] as HTMLElement;
      const digit = valueOf(source);
      if (!digit || source.classList.contains("hidden")) continue;

      for (const p of peersOf(i)) {
        const target = all[p] as HTMLElement;
        if (target.classList.contains("hidden") || valueOf(target) !== "") continue;
        click(target);
        press(digit, { ctrlKey: true });
        const mark = target.querySelector(".centre span") as HTMLElement | null;
        expect(mark?.textContent).toBe(digit);
        expect(mark?.classList.contains("clash")).toBe(true);
        flagged = true;
        break;
      }
    }

    expect(flagged, "found no visible digit with an empty visible peer").toBe(true);
  });

  it("undoes the last action", () => {
    const blank = cells("A").find(
      (c) =>
        !c.classList.contains("given") &&
        !c.classList.contains("hidden") &&
        (c.querySelector(".value") as HTMLElement).textContent === "",
    ) as HTMLElement;
    click(blank);
    press("9");
    expect((blank.querySelector(".value") as HTMLElement).textContent).toBe("9");
    press("z", { ctrlKey: true });
    expect((blank.querySelector(".value") as HTMLElement).textContent).toBe("");
  });

  it("reads digits from the physical key, not the character typed", () => {
    press("Escape");
    // Pristine: earlier tests have left digits and marks on some cells.
    const blank = cells("A").find(
      (c) =>
        !c.classList.contains("given") &&
        !c.classList.contains("hidden") &&
        (c.querySelector(".value") as HTMLElement).textContent === "" &&
        (c.textContent ?? "").trim() === "",
    ) as HTMLElement;
    expect(blank).toBeTruthy();
    click(blank);

    // AZERTY: the key in the "3" position types a double quote unshifted.
    pressPhysical("Digit3", '"');
    expect((blank.querySelector(".value") as HTMLElement).textContent).toBe("3");

    press("z", { ctrlKey: true });
    // QWERTY with Shift: the same key types "#", and should make a corner mark.
    pressPhysical("Digit3", "#", { shiftKey: true });
    const corner = [...blank.querySelectorAll(".corner span")]
      .map((s) => s.textContent)
      .join("");
    expect(corner).toBe("3");
  });

  it("leaves the numpad arrows alone when NumLock is off", () => {
    press("Escape");
    const blank = cells("A").find(
      (c) =>
        !c.classList.contains("given") &&
        !c.classList.contains("hidden") &&
        (c.querySelector(".value") as HTMLElement).textContent === "",
    ) as HTMLElement;
    click(blank);
    // NumLock off: Numpad8 reports itself as ArrowUp and must not write an 8.
    pressPhysical("Numpad8", "ArrowUp");
    expect((blank.querySelector(".value") as HTMLElement).textContent).toBe("");
  });

  it("does not treat two slow presses as a double-click", () => {
    press("Escape");
    const withDigit = cells("A").find((c) => {
      const v = (c.querySelector(".value") as HTMLElement).textContent ?? "";
      return v !== "" && !c.classList.contains("hidden");
    }) as HTMLElement;

    click(withDigit);
    const selectedAfterOne = cells("A").filter((c) => c.classList.contains("selected"));
    expect(selectedAfterOne).toHaveLength(1);
  });

  it("selects every cell showing a digit on double-click", () => {
    press("Escape");
    const all = cells("A");
    const withDigit = all.find((c) => {
      const v = (c.querySelector(".value") as HTMLElement).textContent ?? "";
      return v !== "" && !c.classList.contains("hidden");
    }) as HTMLElement;
    const digit = (withDigit.querySelector(".value") as HTMLElement).textContent;

    doubleClick(withDigit);

    const selected = all.filter((c) => c.classList.contains("selected"));
    expect(selected.length).toBeGreaterThan(0);
    // Everything selected either shows that digit or pencils it.
    for (const cell of selected) {
      const value = (cell.querySelector(".value") as HTMLElement).textContent ?? "";
      const marks = [
        ...[...cell.querySelectorAll(".corner span")].map((s) => s.textContent),
        ...[...cell.querySelectorAll(".centre span")].map((s) => s.textContent),
      ].join("");
      expect(value === digit || marks.includes(digit as string)).toBe(true);
    }
  });

  it("says so when a double-clicked cell holds nothing", () => {
    press("Escape");
    const empty = cells("A").find(
      (c) => (c.querySelector(".value") as HTMLElement).textContent === "",
    ) as HTMLElement;
    doubleClick(empty);
    expect((document.querySelector("#message") as HTMLElement).textContent).toMatch(
      /holds a digit/i,
    );
  });

  it("restyles the digit pad to match the current mode", () => {
    const pad = document.querySelector("#digits") as HTMLElement;
    const modeButton = (m: string) =>
      document.querySelector(`#modes button[data-mode="${m}"]`) as HTMLElement;

    for (const m of ["normal", "corner", "centre", "colour"]) {
      modeButton(m).dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(pad.className).toBe(`digits mode-${m}`);
    }

    // Each key still carries its digit, so the colour swatches can be keyed off it.
    const keys = [...pad.querySelectorAll<HTMLElement>("button")];
    expect(keys.map((k) => k.dataset.digit)).toEqual(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    );
    modeButton("normal").dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  it("switches mode with the toolbar", () => {
    const centre = document.querySelector('#modes button[data-mode="centre"]') as HTMLElement;
    centre.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(centre.classList.contains("active")).toBe(true);
    const normal = document.querySelector('#modes button[data-mode="normal"]') as HTMLElement;
    normal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(normal.classList.contains("active")).toBe(true);
  });

  it("picks up a marker tool on double-click, even with cells selected", () => {
    const empty = cells("A").find(
      (c) => !c.classList.contains("given") && !c.classList.contains("hidden"),
    ) as HTMLElement;
    click(empty);
    expect(empty.classList.contains("selected")).toBe(true);

    const tool = document.querySelector("#markers button") as HTMLElement;
    const before = document.querySelectorAll(".marker-layer *").length;
    tool.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    // Armed, selection dropped, and nothing placed on the way through.
    expect(tool.classList.contains("active")).toBe(true);
    expect(empty.classList.contains("selected")).toBe(false);
    expect(document.querySelectorAll(".marker-layer *").length).toBe(before);
    expect((document.querySelector("#message") as HTMLElement).textContent).toMatch(
      /armed/i,
    );
  });

  it("arms a leftover selection's marker rather than only complaining", () => {
    // A single cell fits no pair or path marker, so clicking one should hand
    // the tool over instead of making the player press Escape first.
    const tools = [...document.querySelectorAll<HTMLElement>("#markers button")];
    const pairTool = tools.find((t) => t.dataset.marker !== "knight") as HTMLElement;
    const empty = cells("A").find(
      (c) => !c.classList.contains("given") && !c.classList.contains("hidden"),
    ) as HTMLElement;

    press("Escape");
    click(empty);
    pairTool.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const message = (document.querySelector("#message") as HTMLElement).textContent ?? "";
    expect(message.length).toBeGreaterThan(0);
    // Either it placed (a one-cell badge) or it armed — never a dead end.
    const armed = pairTool.classList.contains("active");
    expect(armed || /placed/i.test(message)).toBe(true);
  });

  it("explains a marker refusal rather than placing a false one", () => {
    press("Escape");
    const drawnBefore = document.querySelectorAll(".marker-layer *").length;

    // Two cells far apart can never be a legal marker: not a pair sharing an
    // edge, not an unbroken line, and too many cells for a badge.
    const far = cells("A");
    click(far[0] as HTMLElement);
    (far[80] as HTMLElement).dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, shiftKey: true }),
    );

    const tool = document.querySelector("#markers button") as HTMLElement;
    tool.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelectorAll(".marker-layer *").length).toBe(drawnBefore);
    const message = (document.querySelector("#message") as HTMLElement).textContent ?? "";
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toMatch(/placed/i);
  });

  it("labels the difficulty rating and explains it", () => {
    const rating = document.querySelector("#rating") as HTMLElement;
    expect(rating).toBeTruthy();
    const text = (rating.textContent ?? "").replace(/\s+/g, " ").trim();
    // Named as a rating, with what it took to solve, not a bare adjective.
    expect(text).toMatch(/^Rating /);
    expect(text).toMatch(/tier \d|beyond this engine/);

    rating.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const panel = document.querySelector("#difficulty") as HTMLDetailsElement;
    expect(panel.open).toBe(true);

    const body = (document.querySelector("#difficulty-body") as HTMLElement).textContent ?? "";
    // And it says what it does not cover.
    expect(body).toMatch(/classically|stalled/i);
  });

  it("starts a new game from a seed", () => {
    const seed = document.querySelector("#seed") as HTMLInputElement;
    seed.value = "smoke-seed";
    (document.querySelector("#new") as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(seed.value).toBe("smoke-seed");
    expect((document.querySelector("#message") as HTMLElement).textContent).toMatch(
      /smoke-seed/,
    );
  });
});
