/**
 * Sizing the boards to the window, so the page never scrolls.
 *
 * A board is square, and the space it is given rarely is: in hot seat two grids
 * share the width left over by the sidebar, while the height is whatever the
 * header, the two-player bar and the footer have not taken. Which of the two
 * runs out first depends on the window, so the side of the square is the
 * smaller of them.
 *
 * `aspect-ratio` alone cannot express that. It derives one axis from the other,
 * so it can fit a square to a width or to a height, but not to whichever is
 * tighter — the case this layout is made of. Hence the measurement here.
 *
 * The measurement is only safe because it reads boxes the boards cannot change.
 * `.play` takes its height from the flex column above it and `#panes` takes its
 * width from a `minmax(0, 1fr)` track, so neither can be pushed out by what is
 * written back here. Deliberately nothing is read from the panes themselves:
 * they now shrink to fit their board, so measuring one would be measuring this
 * function's own last answer. Sizes are written only when they differ, which is
 * the belt to that braces.
 */

/**
 * The stylesheet sets `--fits: 1` on `:root` inside the media query that turns
 * the one-screen layout on, and 0 outside it. Reading the flag instead of
 * repeating the query keeps one breakpoint rather than two that can drift.
 */
function pageFits(): boolean {
  return getComputedStyle(document.documentElement).getPropertyValue("--fits").trim() === "1";
}

function numeric(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The side of the largest square fitting a content box of `width` by `height`
 * once the pane's heading has taken `head` off the top. Whole pixels, because a
 * fractional side leaves the 9 cell borders landing on different subpixels.
 */
export function squareSide(width: number, height: number, head: number): number {
  return Math.max(0, Math.floor(Math.min(width, height - head)));
}

/** The padding and border a pane puts around its board, per axis. */
function paneChrome(pane: HTMLElement): { x: number; y: number } {
  const s = getComputedStyle(pane);
  return {
    x:
      numeric(s.paddingLeft) +
      numeric(s.paddingRight) +
      numeric(s.borderLeftWidth) +
      numeric(s.borderRightWidth),
    y:
      numeric(s.paddingTop) +
      numeric(s.paddingBottom) +
      numeric(s.borderTopWidth) +
      numeric(s.borderBottomWidth),
  };
}

/**
 * Keep every board in `panes` sized to its pane. Returns a function that stops
 * observing and hands the boards back to the stylesheet.
 */
export function fitBoards(panes: HTMLElement): () => void {
  // Nothing to measure where there is no layout — jsdom has no ResizeObserver.
  // The stylesheet's own sizing is the answer there, and in any browser too old
  // to observe, so this is a fallback rather than only a test affordance.
  if (typeof ResizeObserver !== "function") {
    return () => {};
  }

  const play = panes.closest<HTMLElement>(".play");

  const clear = (): void => {
    for (const board of panes.querySelectorAll<HTMLElement>(".board")) {
      board.style.removeProperty("width");
      board.style.removeProperty("height");
    }
  };

  const apply = (): void => {
    if (!play || !pageFits()) {
      clear();
      return;
    }

    // A pane hidden by `main.online` has no layout box; it keeps the size it
    // was last given, which is already right when it comes back.
    const visible = [...panes.querySelectorAll<HTMLElement>(".pane")].filter(
      (pane) => pane.offsetParent !== null,
    );
    if (visible.length === 0) return;

    // Measured off `.play`, never off `#panes`: the board column is sized to
    // its content now, so `#panes` is exactly as wide as the last answer this
    // function gave and reading it would be reading ourselves. `.play` takes
    // its width from the page and its height from the flex column, so neither
    // can be moved by what is written back below.
    const sidebar = play.querySelector<HTMLElement>(".controls");
    const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
    const playGap = sidebarWidth > 0 ? numeric(getComputedStyle(play).columnGap) : 0;
    const panesGap = numeric(getComputedStyle(panes).columnGap);

    const forBoards = play.clientWidth - sidebarWidth - playGap;
    const column = (forBoards - panesGap * (visible.length - 1)) / visible.length;
    const available = play.clientHeight;

    for (const pane of visible) {
      const board = pane.querySelector<HTMLElement>(".board");
      if (!board) continue;

      const chrome = paneChrome(pane);
      const head = pane.querySelector<HTMLElement>(".pane-head");
      const headHeight = head
        ? head.offsetHeight + numeric(getComputedStyle(head).marginBottom)
        : 0;

      const side = `${squareSide(column - chrome.x, available - chrome.y, headHeight)}px`;
      if (board.style.width !== side) {
        board.style.width = side;
        board.style.height = side;
      }
    }
  };

  const observer = new ResizeObserver(apply);
  observer.observe(play ?? panes);
  // The sidebar and the two-player panel change height without `.play` resizing
  // on the same frame; a window listener catches what is left, and it is also
  // what notices the layout crossing the breakpoint.
  addEventListener("resize", apply);
  apply();

  return () => {
    observer.disconnect();
    removeEventListener("resize", apply);
    clear();
  };
}
