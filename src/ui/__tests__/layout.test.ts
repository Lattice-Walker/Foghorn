// @vitest-environment jsdom
/**
 * The order of the page. Cheap to assert, and easy to break by accident when
 * a section is added: the two-player panel first shipped below both boards,
 * where nobody would scroll to find it.
 *
 * Asserted in document order rather than as `#app`'s direct children, because
 * the controls moved into a wrapper beside the boards and the thing worth
 * protecting is the reading order, not the nesting that produces it.
 */

import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await import("../main.js");
});

/** Where each landmark falls in the rendered document, top to bottom. */
function readingOrder(): string[] {
  const landmarks = "header, #status, #connect, #panes, .controls, #message, footer";
  return [...document.querySelectorAll<HTMLElement>(landmarks)].map(
    (el) => el.id || el.className || el.tagName.toLowerCase(),
  );
}

describe("page layout", () => {
  it("puts the sections in a usable order", () => {
    expect(readingOrder()).toEqual([
      "header",
      "status",
      "connect",
      "panes",
      "controls",
      "message",
      "footer",
    ]);
  });

  it("keeps the two-player controls above the boards", () => {
    const order = readingOrder();
    expect(order.indexOf("connect")).toBeGreaterThan(-1);
    expect(order.indexOf("connect")).toBeLessThan(order.indexOf("panes"));
  });

  // The sidebar is a layout choice, so it is CSS that places it; what the
  // markup has to get right is that the controls share a parent with the
  // boards, since nothing can sit beside them otherwise.
  it("puts the boards and the controls in one row", () => {
    const play = document.querySelector(".play");
    expect(play?.querySelector("#panes")).not.toBeNull();
    expect(play?.querySelector(".controls")).not.toBeNull();
  });

  it("offers hot seat, host and join, with hot seat current", () => {
    const buttons = [...document.querySelectorAll<HTMLElement>("#connect .buttons button")];
    expect(buttons.map((b) => b.id)).toEqual(["hotseat", "host", "join"]);
    expect(buttons[0]!.classList.contains("active")).toBe(true);
  });

  it("says what mode you are in before you touch anything", () => {
    const status = document.querySelector("#connect-status") as HTMLElement;
    expect(status.textContent).toMatch(/hot seat/i);
  });

  it("shows no code boxes until a game is being set up", () => {
    expect(document.querySelectorAll("#connect textarea")).toHaveLength(0);
  });
});
