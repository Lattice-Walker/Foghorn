/**
 * One player's view of the board.
 *
 * Fog hides what a player does not know — the solution, the givens, and any
 * trace of their partner. It does not hide what the player wrote themselves:
 * their own digits, pencil marks and colours all sit on top of it, so fog is
 * something you annotate rather than something that erases your work.
 *
 * A digit visible on a fogged cell is always wrong, and rendered red. A correct
 * placement clears the fog beneath it, so it can never be the other case.
 *
 * Markers also show through (Axiom M), because they are the one thing a player
 * is allowed to send.
 */

import { digitsOf, has } from "../engine/digits.js";
import { CELLS, type CellIndex, N, colOf, rowOf } from "../engine/units.js";
import { MARKER_DEFS, areAdjacent } from "../game/markers.js";
import type { Session } from "../game/session.js";
import type { Marker, PlayerId } from "../game/types.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Corner-mark slot order: corners first, then edges, then the middle. */
const CORNER_SLOTS = [0, 2, 6, 8, 1, 7, 3, 5, 4];

function buildLayer(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${N} ${N}`);
  svg.setAttribute("class", className);
  return svg;
}

/** The centre of a cell, in the overlay's 0..9 coordinates. */
export function cellCentre(cell: CellIndex): { x: number; y: number } {
  return { x: colOf(cell) + 0.5, y: rowOf(cell) + 0.5 };
}

/**
 * A line marker runs from the centre of one cell to the centre of the next, as
 * a whisper or renban line does on a real grid — not along the border the way
 * a dot sits.
 *
 * `at` is the position `dotLayout` assigned this marker on the shared edge.
 * Its displacement from the edge midpoint is carried to both endpoints, so
 * several lines on one pair run parallel instead of on top of each other.
 */
/**
 * The polyline through a line marker's cells, as SVG `points`.
 *
 * A line runs centre to centre, the way a whisper or renban line does on a
 * real grid — not along a border, which is where a dot belongs. Steps may be
 * diagonal, so the path follows king's moves.
 */
export function pathPoints(cells: readonly CellIndex[]): string {
  return cells
    .map((cell) => {
      const { x, y } = cellCentre(cell);
      return `${x},${y}`;
    })
    .join(" ");
}

/** How close together two presses on one cell count as a double-click. */
const DOUBLE_CLICK_MS = 400;

const DOT_RADIUS = 0.14;
const DOT_SPACING = 0.33;

/**
 * Where to draw `count` dots on the edge shared by two adjacent cells.
 *
 * More than one relation can hold of the same pair — 1 and 2 are consecutive
 * *and* double — so the dots spread along the shared edge instead of stacking
 * on its midpoint, where the later one simply hides the earlier.
 */
export function dotLayout(
  a: CellIndex,
  b: CellIndex,
  count: number,
): { x: number; y: number }[] {
  const x = (colOf(a) + colOf(b)) / 2 + 0.5;
  const y = (rowOf(a) + rowOf(b)) / 2 + 0.5;

  // Side-by-side neighbours share a vertical edge, so their dots stack along y.
  const sideBySide = rowOf(a) === rowOf(b);
  const dx = sideBySide ? 0 : 1;
  const dy = sideBySide ? 1 : 0;

  return Array.from({ length: count }, (_, i) => {
    const offset = (i - (count - 1) / 2) * DOT_SPACING;
    return { x: x + dx * offset, y: y + dy * offset };
  });
}

export class BoardView {
  readonly root: HTMLElement;
  readonly player: PlayerId;
  readonly selection = new Set<CellIndex>();

  private readonly cells: HTMLElement[] = [];
  /** The rim around ground both players can see, beneath everything drawn. */
  private readonly sight: SVGSVGElement;
  /** Lines, drawn beneath the digits. */
  private readonly underlay: SVGSVGElement;
  /** Dots, edge letters and badges, drawn above them. */
  private readonly overlay: SVGSVGElement;
  private dragging = false;
  /** Which way the current gesture runs, fixed when it starts. */
  private dragMode: "add" | "remove" = "add";
  /** For spotting a double-click ourselves; see attachPointerHandlers. */
  private lastPressCell: CellIndex | null = null;
  private lastPressAt = 0;

  constructor(
    player: PlayerId,
    private readonly onActivate: (view: BoardView) => void,
    private readonly onChange: () => void,
    /** Called when a drag finishes, so a tool can act on the run just drawn. */
    private readonly onGestureEnd?: (view: BoardView) => void,
    /** Called on a double-click, to select everything like that cell. */
    private readonly onCellDoubleClick?: (view: BoardView, cell: CellIndex) => void,
  ) {
    this.player = player;

    this.root = document.createElement("div");
    this.root.className = "board";

    const grid = document.createElement("div");
    grid.className = "grid";
    for (let cell = 0; cell < CELLS; cell++) {
      grid.append(this.buildCell(cell));
    }
    this.root.append(grid);

    // Two layers, because a line and a dot want opposite sides of the digits:
    // a whisper runs through cell centres and must not cover what is written
    // there, while a kropki dot sits on a border and belongs on top.
    this.sight = buildLayer("sight-layer");
    this.underlay = buildLayer("marker-layer under");
    this.overlay = buildLayer("marker-layer over");
    this.root.append(this.sight, this.underlay, this.overlay);

    this.attachPointerHandlers();
  }

  private buildCell(cell: CellIndex): HTMLElement {
    const el = document.createElement("div");
    el.className = "cell";
    el.dataset.cell = String(cell);
    if (colOf(cell) % 3 === 0) el.classList.add("box-left");
    if (rowOf(cell) % 3 === 0) el.classList.add("box-top");
    if (colOf(cell) === N - 1) el.classList.add("edge-right");
    if (rowOf(cell) === N - 1) el.classList.add("edge-bottom");

    el.innerHTML = `
      <div class="fog"></div>
      <div class="colour"></div>
      <div class="corner">${"<span></span>".repeat(9)}</div>
      <div class="centre"></div>
      <div class="value"></div>
    `;
    this.cells.push(el);
    return el;
  }

  private attachPointerHandlers(): void {
    const cellFrom = (target: EventTarget | null): CellIndex | null => {
      const el = (target as HTMLElement | null)?.closest(".cell") as HTMLElement | null;
      if (!el?.dataset.cell) return null;
      return Number(el.dataset.cell);
    };

    this.root.addEventListener("pointerdown", (event) => {
      const cell = cellFrom(event.target);
      if (cell === null) return;
      // preventDefault here stops text selection during a drag, but it also
      // suppresses the compatibility mouse events the browser would derive
      // from this press — click, and therefore dblclick. So the double-click
      // is spotted here instead of listened for.
      event.preventDefault();

      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      const now = Date.now();
      const doubled =
        !additive && cell === this.lastPressCell && now - this.lastPressAt < DOUBLE_CLICK_MS;
      this.lastPressCell = cell;
      this.lastPressAt = now;

      this.onActivate(this);
      this.beginSelection(cell, additive);
      if (doubled) this.onCellDoubleClick?.(this, cell);
      this.dragging = true;
      // Guarded: pointer capture is absent in some test environments.
      if (typeof this.root.setPointerCapture === "function") {
        this.root.setPointerCapture(event.pointerId);
      }
    });

    this.root.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      const cell = cellFrom(document.elementFromPoint(event.clientX, event.clientY));
      if (cell === null) return;
      this.extendSelection(cell);
    });

    const stop = (event: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (
        typeof this.root.hasPointerCapture === "function" &&
        this.root.hasPointerCapture(event.pointerId)
      ) {
        this.root.releasePointerCapture(event.pointerId);
      }
      this.onGestureEnd?.(this);
    };
    this.root.addEventListener("pointerup", stop);
    this.root.addEventListener("pointercancel", stop);


  }

  /**
   * Start a selection gesture, and fix which way it runs.
   *
   * Beginning on a cell that is already selected, with a modifier held, makes
   * the whole drag a deselection. Deciding once at the start rather than
   * toggling per cell is what makes dragging back over your own path
   * predictable instead of flickering.
   */
  beginSelection(cell: CellIndex, additive: boolean): void {
    if (!additive) {
      this.selection.clear();
      this.dragMode = "add";
      this.selection.add(cell);
    } else if (this.selection.has(cell)) {
      this.dragMode = "remove";
      this.selection.delete(cell);
    } else {
      this.dragMode = "add";
      this.selection.add(cell);
    }
    this.onChange();
  }

  /** Continue the gesture over another cell, in the direction it began. */
  extendSelection(cell: CellIndex): void {
    if (this.dragMode === "add") {
      if (this.selection.has(cell)) return;
      this.selection.add(cell);
    } else {
      if (!this.selection.has(cell)) return;
      this.selection.delete(cell);
    }
    this.onChange();
  }

  selectOnly(cell: CellIndex): void {
    this.selectAll([cell]);
  }

  /** Replace the selection with exactly these cells. */
  selectAll(cells: Iterable<CellIndex>): void {
    this.selection.clear();
    for (const cell of cells) this.selection.add(cell);
    this.onChange();
  }

  moveSelection(dRow: number, dCol: number): void {
    const current = [...this.selection].pop();
    const from = current ?? 0;
    const row = Math.min(N - 1, Math.max(0, rowOf(from) + dRow));
    const col = Math.min(N - 1, Math.max(0, colOf(from) + dCol));
    this.selectOnly(row * N + col);
  }

  render(session: Session): void {
    for (let cell = 0; cell < CELLS; cell++) {
      this.renderCell(session, cell);
    }
    this.renderSight(session);
    this.renderMarkers(session);
  }

  private renderCell(session: Session, cell: CellIndex): void {
    const el = this.cells[cell] as HTMLElement;
    const hidden = session.isHiddenFor(this.player, cell);
    const value = session.valueAt(this.player, cell);
    const given = session.isGivenFor(this.player, cell);
    const notes = session.notes[this.player];

    el.classList.toggle("selected", this.selection.has(cell));
    el.classList.toggle("hidden", hidden);
    el.classList.toggle("given", given);
    el.classList.toggle("wrong", session.isWrong(this.player, cell));
    el.classList.toggle(
      "confirmed",
      !hidden && !given && session.isConfirmed(this.player, cell),
    );

    const valueEl = el.querySelector(".value") as HTMLElement;
    const cornerEl = el.querySelector(".corner") as HTMLElement;
    const centreEl = el.querySelector(".centre") as HTMLElement;
    const colourEl = el.querySelector(".colour") as HTMLElement;

    // While a cell is fogged the player's board holds only what they entered
    // themselves: givens arrive on their board as their own fog lifts, and a
    // correct placement lifts it. So showing `value` here can never leak.
    valueEl.textContent = value === 0 ? "" : String(value);

    const showMarks = value === 0;
    // Digits already standing in this cell's units, on this player's board.
    const clash = showMarks ? session.peerDigits(this.player, cell) : 0;

    const corner = showMarks ? digitsOf(notes.corner[cell] as number) : [];
    const slots = cornerEl.children;
    for (let i = 0; i < 9; i++) {
      const slot = slots[i] as HTMLElement;
      slot.textContent = "";
      slot.classList.remove("clash");
    }
    corner.forEach((digit, i) => {
      if (i >= 9) return;
      const slot = slots[CORNER_SLOTS[i] as number] as HTMLElement;
      slot.textContent = String(digit);
      slot.classList.toggle("clash", has(clash, digit));
    });

    centreEl.replaceChildren();
    if (showMarks) {
      for (const digit of digitsOf(notes.centre[cell] as number)) {
        const span = document.createElement("span");
        span.textContent = String(digit);
        if (has(clash, digit)) span.className = "clash";
        centreEl.append(span);
      }
    }

    const colour = notes.colour[cell] as number;
    colourEl.className = `colour${colour ? ` c${colour}` : ""}`;
  }

  /**
   * Light the ground both players can now see.
   *
   * No cell starts shared (R10b), so this is always something the solve
   * earned: one player's reveal reaching into what the other already held.
   *
   * The rim is drawn as one shape rather than per cell. Everything *outside*
   * the shared region is filled, blurred, and then clipped back to the inside,
   * which leaves a glow that is brightest against the boundary and fades
   * inwards. Doing it this way is what makes the corners work: a per-side
   * gradient has to guess what happens where two sides meet, and gets both the
   * outer corner (two fades stacking, too bright) and the inner one (neither
   * side fading, a notch of dark) wrong. A blur has no corners to get wrong.
   */
  private renderSight(session: Session): void {
    this.sight.replaceChildren();

    const shared: CellIndex[] = [];
    for (let cell = 0; cell < CELLS; cell++) {
      if (session.isSharedSight(cell)) shared.push(cell);
    }
    if (shared.length === 0) return;

    const region = shared
      .map((cell) => `M${colOf(cell)} ${rowOf(cell)}h1v1h-1z`)
      .join("");
    // A frame reaching past the grid, with the shared cells punched out of it.
    // The overhang matters: it is what lets a region touching the board's own
    // edge still glow along it.
    const outside = `M-2 -2h${N + 4}v${N + 4}h-${N + 4}z${region}`;

    const defs = document.createElementNS(SVG_NS, "defs");

    const clip = document.createElementNS(SVG_NS, "clipPath");
    clip.setAttribute("id", `sight-clip-${this.player}`);
    const clipPath = document.createElementNS(SVG_NS, "path");
    clipPath.setAttribute("d", region);
    clip.append(clipPath);

    const blur = document.createElementNS(SVG_NS, "filter");
    blur.setAttribute("id", `sight-blur-${this.player}`);
    // The filter region has to cover the frame, or its own edges get clipped
    // and the glow dies short of the board's rim.
    blur.setAttribute("x", "-20%");
    blur.setAttribute("y", "-20%");
    blur.setAttribute("width", "140%");
    blur.setAttribute("height", "140%");
    const gaussian = document.createElementNS(SVG_NS, "feGaussianBlur");
    gaussian.setAttribute("stdDeviation", "0.26");
    blur.append(gaussian);

    defs.append(clip, blur);

    const clipped = document.createElementNS(SVG_NS, "g");
    clipped.setAttribute("clip-path", `url(#sight-clip-${this.player})`);
    const blurred = document.createElementNS(SVG_NS, "g");
    blurred.setAttribute("filter", `url(#sight-blur-${this.player})`);
    const glow = document.createElementNS(SVG_NS, "path");
    glow.setAttribute("d", outside);
    glow.setAttribute("fill-rule", "evenodd");
    glow.setAttribute("class", "sight-glow");
    blurred.append(glow);
    clipped.append(blurred);

    this.sight.append(defs, clipped);
  }

  private renderMarkers(session: Session): void {
    this.underlay.replaceChildren();
    this.overlay.replaceChildren();

    // Pair markers sit on a shared border, so several on one border have to be
    // spread apart. Lines and badges have nothing to collide with.
    const byEdge = new Map<string, Marker[]>();

    for (const marker of session.markers) {
      const def = MARKER_DEFS[marker.type];

      if (def.glyph.kind === "line") {
        const line = document.createElementNS(SVG_NS, "polyline");
        line.setAttribute("points", pathPoints(marker.cells));
        line.setAttribute("class", `line ${def.glyph.tone}`);
        this.underlay.append(line);

        // A thermometer needs its bulb: the line means nothing without knowing
        // which end it counts up from.
        const start = marker.cells[0];
        if (def.glyph.bulb && start !== undefined) {
          const at = cellCentre(start);
          const bulb = document.createElementNS(SVG_NS, "circle");
          bulb.setAttribute("cx", String(at.x));
          bulb.setAttribute("cy", String(at.y));
          bulb.setAttribute("r", "0.3");
          bulb.setAttribute("class", `bulb ${def.glyph.tone}`);
          this.underlay.append(bulb);
        }
        continue;
      }

      if (def.glyph.kind === "badge") {
        const cell = marker.cells[0];
        if (cell === undefined) continue;
        const badge = document.createElementNS(SVG_NS, "text");
        badge.setAttribute("x", String(colOf(cell) + 0.82));
        badge.setAttribute("y", String(rowOf(cell) + 0.24));
        badge.setAttribute("class", "badge");
        badge.textContent = def.glyph.text;
        this.overlay.append(badge);
        continue;
      }

      const [a, b] = marker.cells;
      if (a === undefined || b === undefined) continue;
      const key = [a, b].sort((x, y) => x - y).join(":");
      const group = byEdge.get(key);
      if (group) group.push(marker);
      else byEdge.set(key, [marker]);
    }

    for (const [key, group] of byEdge) {
      const [a, b] = key.split(":").map(Number) as [CellIndex, CellIndex];
      // Stable order, so a redraw never shuffles the glyphs around.
      group.sort((m, n) => m.type.localeCompare(n.type));
      const positions = dotLayout(a, b, group.length);
      const scale = group.length > 1 ? 0.72 : 1;

      group.forEach((marker, i) => {
        const node = edgeGlyph(marker, positions[i] as { x: number; y: number }, scale);
        if (node) this.overlay.append(node);
      });
    }
  }
}

/**
 * Build the SVG node for a marker sitting on the border between two cells.
 *
 * `scale` shrinks the glyph when several relations share one border, so the
 * spread from `dotLayout` does not run them into each other.
 */
function edgeGlyph(
  marker: Marker,
  at: { x: number; y: number },
  scale: number,
): SVGElement | null {
  const glyph = MARKER_DEFS[marker.type].glyph;
  const [first, second] = marker.cells as [CellIndex, CellIndex];
  // Side-by-side cells share a vertical border; stacked cells a horizontal one.
  const sideBySide = rowOf(first) === rowOf(second);

  switch (glyph.kind) {
    case "dot": {
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", String(at.x));
      dot.setAttribute("cy", String(at.y));
      dot.setAttribute("r", String(DOT_RADIUS * scale));
      dot.setAttribute("class", `dot ${glyph.tone}`);
      return dot;
    }

    case "text": {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(at.x));
      text.setAttribute("y", String(at.y));
      text.setAttribute("class", "edge-text");
      text.setAttribute("font-size", String(0.34 * scale));
      text.textContent = glyph.text;
      return text;
    }

    case "chevron": {
      // cells[0] is the greater, so the apex points at cells[1].
      const towardSmaller = sideBySide
        ? Math.sign(colOf(second) - colOf(first))
        : Math.sign(rowOf(second) - rowOf(first));
      const depth = 0.11 * scale;
      const arm = 0.17 * scale;
      const points = sideBySide
        ? [
            [at.x - depth * towardSmaller, at.y - arm],
            [at.x + depth * towardSmaller, at.y],
            [at.x - depth * towardSmaller, at.y + arm],
          ]
        : [
            [at.x - arm, at.y - depth * towardSmaller],
            [at.x, at.y + depth * towardSmaller],
            [at.x + arm, at.y - depth * towardSmaller],
          ];
      const chevron = document.createElementNS(SVG_NS, "polyline");
      chevron.setAttribute("points", points.map(([x, y]) => `${x},${y}`).join(" "));
      chevron.setAttribute("stroke-width", String(0.075 * scale));
      chevron.setAttribute("class", "chevron");
      return chevron;
    }

    default:
      return null;
  }
}
