/**
 * Hot-seat Foghorn: both players in one browser, two panes, no networking.
 *
 * This is milestone M4 from the plan, deliberately ahead of the transport
 * layer: the whole game is easier to debug in one window than through a peer
 * connection.
 */

import "./style.css";

import type { Digit } from "../engine/digits.js";
import { type CellIndex, formatCell } from "../engine/units.js";
import { TIER_NAME } from "../engine/rate.js";
import { BY_ID } from "../engine/techniques/index.js";
import { MARKER_DEFS } from "../game/markers.js";
import { Session } from "../game/session.js";
import type { InputMode, Marker, MarkerType, PlayerId } from "../game/types.js";
import type { NetMessage } from "../net/protocol.js";
import { toWire } from "../net/protocol.js";
import { needsRebuild, openingMessages, replyToHello } from "../net/handshake.js";
import { BoardView } from "./board.js";
import { type Link, createConnectPanel } from "./connect.js";
import { fitBoards } from "./fit.js";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

let session = new Session(randomSeed());
let mode: InputMode = "normal";
let activeView: BoardView;
/** A marker tool waiting for the next drag to draw it. */
let armedMarker: MarkerType | null = null;
/** The peer link, or null in hot seat. */
let link: Link | null = null;
/** Which board is this browser's, or null when both are. */
let localPlayer: PlayerId | null = null;
/** What the partner last told us about their grid. */
let partner = { filled: 0, complete: false };
let startedAt = Date.now();

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ---- layout --------------------------------------------------------------

app.innerHTML = `
  <header>
    <div class="brand">
      <img class="logo" src="./icon-180.png" alt="" width="52" height="52" />
      <div>
        <h1>Foghorn</h1>
        <p class="tagline">Two-player co-op sudoku played through fog</p>
      </div>
    </div>
    <div class="meta">
      <label>Seed <input id="seed" spellcheck="false" /></label>
      <button id="new">New game</button>
    </div>
  </header>

  <div class="topbar">
    <section class="status" id="status"></section>

    <section class="players" id="connect">
      <div class="players-bar">
        <span class="group-label">Players</span>
        <div class="buttons">
          <button id="hotseat" class="active">Hot seat</button>
          <button id="host">Host a game</button>
          <button id="join">Join a game</button>
        </div>
        <p class="hint" id="connect-status"></p>
      </div>
      <div id="connect-flow"></div>
    </section>
  </div>

  <div class="play">
    <main id="panes"></main>

    <section class="controls">
      <div class="group modes">
        <span class="group-label">Mode</span>
        <div class="buttons" id="modes"></div>
        <p class="hint">
          Hold <kbd>Shift</kbd> for corner marks, <kbd>Ctrl</kbd> for centre
          marks. A mark turns red when that digit already stands in the cell's
          row, column or box on your grid.
        </p>
      </div>

      <div class="group pad">
        <span class="group-label">Digits</span>
        <div class="digits" id="digits"></div>
        <div class="buttons">
          <button data-action="delete">Delete</button>
          <button data-action="undo">Undo</button>
          <button data-action="redo">Redo</button>
        </div>
      </div>

      <div class="group markers">
        <span class="group-label">Markers</span>
        <div class="buttons" id="markers"></div>
        <button data-action="unmark" class="wide">Remove markers on selection</button>
        <p class="hint" id="marker-hint"></p>
      </div>

      <div class="group legend">
        <span class="group-label">Legend</span>
        <p class="hint">
          <span class="swatch sight" aria-hidden="true"></span>
          A yellow rim marks ground <em>both</em> of you can see.
        </p>
      </div>

      <p class="message" id="message"></p>
    </section>
  </div>

  <footer>
    <details id="difficulty">
      <summary>Difficulty</summary>
      <div class="help" id="difficulty-body"></div>
    </details>

    <details>
      <summary>Keys and rules</summary>
      <div class="help">
        <dl>
          <dt><kbd>1</kbd>–<kbd>9</kbd></dt><dd>enter a digit in the current mode (any keyboard layout; the numpad works too)</dd>
          <dt><kbd>Shift</kbd>+digit</dt><dd>corner mark</dd>
          <dt><kbd>Ctrl</kbd>+digit</dt><dd>centre mark</dd>
          <dt><kbd>Alt</kbd>+digit</dt><dd>colour</dd>
          <dt><kbd>Space</kbd></dt><dd>cycle mode</dd>
          <dt><kbd>Del</kbd></dt><dd>clear digit, then marks, then colour</dd>
          <dt><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd></dt><dd>undo / redo</dd>
          <dt>arrows</dt><dd>move selection</dd>
          <dt>drag</dt><dd>select a run of cells</dd>
          <dt><kbd>Shift</kbd>-click</dt><dd>add a cell, or remove a selected one</dd>
          <dt><kbd>Shift</kbd>-drag</dt><dd>from a selected cell, deselects the run</dd>
          <dt><kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd></dt><dd>place the first, second or third marker in the palette</dd>
          <dt>double-click a cell</dt><dd>selects every cell showing that digit, pencil marks included</dd>
          <dt>double-click a marker</dt><dd>picks the tool up; the next drag draws it</dd>
          <dt><kbd>Shift</kbd>+<kbd>Q</kbd>/<kbd>W</kbd>/<kbd>E</kbd></dt><dd>the same, from the keyboard</dd>
          <dt><kbd>Esc</kbd></dt><dd>deselect</dd>
        </dl>
        <p>
          A sees columns 1–4, B sees columns 6–9, and column 5 starts dark to
          both. No cell is visible to both players at the start (R10b).
        </p>
        <p>
          <strong>You each have your own grid, and both must be finished to
          win.</strong> Filling a cell does nothing for your partner — they have
          to reach it themselves. A correct digit lifts fog around it on
          <em>your own</em> board only; a wrong one reveals nothing. You may
          place into a fogged cell if you can prove it (R2), and a cell already
          holding the right digit is locked.
        </p>
        <p>
          Fog hides what you do not know: the solution, the givens, and any
          trace of your partner. It does not hide your own work — your digits,
          pencil marks and colours all sit on top of it, and a digit showing
          through fog is always a wrong guess, in red. Markers are shared — they
          show through fog on both boards. You may only place a marker on cells
          <em>you</em> can see, which is what makes one worth sending: it lands
          where you can see and your partner cannot, and they have to work out
          what it implies. A marker states a relation, can never name a digit,
          and is refused if it is not true of the solution.
        </p>
      </div>
    </details>
  </footer>
`;

const panes = document.querySelector<HTMLElement>("#panes")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;
const messageEl = document.querySelector<HTMLElement>("#message")!;
const seedInput = document.querySelector<HTMLInputElement>("#seed")!;

const views: Record<PlayerId, BoardView> = {
  A: buildPane("A", "Player A"),
  B: buildPane("B", "Player B"),
};
activeView = views.A;

// The boards are sized to what is left of the window, so the page never
// scrolls; below the breakpoint in `fit.ts` this stands down and the page
// scrolls as it used to.
fitBoards(panes);

function buildPane(player: PlayerId, title: string): BoardView {
  const pane = document.createElement("section");
  pane.className = "pane";
  pane.dataset.player = player;

  // No fixed description of the view: fog is grown per puzzle, so any wording
  // about columns would be a lie on most of them. The counter says what is
  // true right now instead.
  const head = document.createElement("div");
  head.className = "pane-head";
  head.innerHTML = `<h2>${title}</h2><span class="fog-count" data-fog="${player}"></span>`;
  pane.append(head);

  const view = new BoardView(
    player,
    setActive,
    render,
    finishGesture,
    selectMatching,
  );
  pane.append(view.root);
  panes.append(pane);
  return view;
}

/**
 * A drag has finished. If a marker tool is armed, the run just drawn is the
 * marker — which is how a line of more than two cells gets made.
 */
function finishGesture(view: BoardView): void {
  if (!armedMarker || view.selection.size === 0) return;
  const type = armedMarker;
  armedMarker = null;

  const cells = [...view.selection];
  const result = session.addMarker(view.player, type, cells);
  if (result.ok) {
    lastPlacement = { type, at: Date.now() };
    shareMarker(session.lastMarkerBy(view.player));
    view.selection.clear();
    say(`${MARKER_DEFS[type].label} drawn across ${cells.length} cells`);
  } else {
    say(result.reason ?? "Could not draw that marker");
  }
  render();
}

/**
 * Double-clicking a cell selects everything that player is showing the same
 * digit in — as a placed digit or as a pencil mark. The quickest way to see
 * where a digit has got to, and to colour or clear a whole family at once.
 */
function selectMatching(view: BoardView, cell: CellIndex): void {
  const digit = session.valueAt(view.player, cell);
  if (digit === 0) {
    say("Double-click a cell that holds a digit");
    return;
  }
  const matches = session.cellsShowing(view.player, digit);
  view.selectAll(matches);
  say(`${matches.length} cell(s) showing ${digit}, pencil marks included`);
}

function setActive(view: BoardView): void {
  activeView = view;
  for (const other of Object.values(views)) {
    if (other !== view) other.selection.clear();
  }
  render();
}

// ---- controls ------------------------------------------------------------

const MODES: readonly { id: InputMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "corner", label: "Corner" },
  { id: "centre", label: "Centre" },
  { id: "colour", label: "Colour" },
];

const modesEl = document.querySelector<HTMLElement>("#modes")!;
for (const m of MODES) {
  const button = document.createElement("button");
  button.textContent = m.label;
  button.dataset.mode = m.id;
  button.addEventListener("click", () => {
    mode = m.id;
    render();
  });
  modesEl.append(button);
}

const digitsEl = document.querySelector<HTMLElement>("#digits")!;
for (let d = 1; d <= 9; d++) {
  const button = document.createElement("button");
  button.textContent = String(d);
  button.dataset.digit = String(d);
  button.addEventListener("click", () => applyDigit(d as Digit, mode));
  digitsEl.append(button);
}

const markersEl = document.querySelector<HTMLElement>("#markers")!;
const markerHintEl = document.querySelector<HTMLElement>("#marker-hint")!;

/** Palette keys, by position: the vocabulary changes from puzzle to puzzle. */
const PALETTE_KEYS = ["q", "w", "e"] as const;

/**
 * Rebuild the marker buttons for this puzzle's palette.
 *
 * R5 fixes a small vocabulary per puzzle, drawn at generation time, so the
 * controls cannot be built once — part of a puzzle is working out what can be
 * said in it.
 */
function renderPalette(): void {
  markersEl.replaceChildren();

  session.palette.forEach((type, i) => {
    const def = MARKER_DEFS[type];
    const button = document.createElement("button");
    button.innerHTML = `${def.label} <kbd>${(PALETTE_KEYS[i] ?? "").toUpperCase()}</kbd>`;
    button.title = def.hint;
    button.dataset.marker = type;
    button.addEventListener("click", () => clickMarker(type));
    button.addEventListener("dblclick", () => armMarker(type, true));
    button.addEventListener("pointerenter", () => {
      markerHintEl.textContent = def.hint;
    });
    markersEl.append(button);
  });

  markerHintEl.textContent =
    "Select cells, then choose a marker. Double-click a marker to pick it up " +
    "instead, then drag to draw. Both players see it, fog or not.";
}

document.querySelector("#new")!.addEventListener("click", () => {
  newGame(seedInput.value.trim() || randomSeed());
});
seedInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") newGame(seedInput.value.trim() || randomSeed());
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-action]")) {
  button.addEventListener("click", () => runAction(button.dataset.action as string));
}

function runAction(action: string): void {
  const cells = [...activeView.selection];
  switch (action) {
    case "delete":
      session.clear(activeView.player, cells);
      break;
    case "undo":
      if (!session.undo()) say("Nothing to undo");
      break;
    case "redo":
      if (!session.redo()) say("Nothing to redo");
      break;
    case "unmark": {
      const removed = session.removeMarkersAt(activeView.player, cells);
      if (removed.length > 0) link?.send({ t: "marker-remove", ids: removed });
      say(
        removed.length > 0
          ? `Removed ${removed.length} marker(s)`
          : "No markers of yours on the selection",
      );
      break;
    }
  }
  render();
}

// ---- input ---------------------------------------------------------------

function applyDigit(digit: Digit, useMode: InputMode): void {
  const cells = [...activeView.selection];
  if (cells.length === 0) {
    say("Select a cell first");
    return;
  }

  switch (useMode) {
    case "normal": {
      const player = activeView.player;
      const result = session.setDigit(player, cells, digit);
      const wrong = session.wrongGuesses[player];
      if (!result.ok) {
        say("Already solved — nothing to place there");
      } else if (!result.correct) {
        say(`Wrong — nothing revealed (${wrong} so far for ${player})`);
      } else if (result.revealed.length > 0) {
        say(`Correct. Fog lifted on ${result.revealed.length} of your cells`);
      } else {
        say("Correct");
      }
      shareProgress();
      break;
    }
    case "corner":
      session.toggleMark(activeView.player, "corner", cells, digit);
      break;
    case "centre":
      session.toggleMark(activeView.player, "centre", cells, digit);
      break;
    case "colour":
      session.toggleColour(activeView.player, cells, digit);
      break;
  }
  render();
}

/** Set when a click placed a marker, so a double-click can take it back. */
let lastPlacement: { type: MarkerType; at: number } | null = null;

/**
 * Clicking a marker in the palette.
 *
 * With a selection that fits, it places the marker and clears the selection.
 * With a selection that does not fit, it arms the tool instead of just
 * complaining — a selection the marker cannot use is almost always a leftover,
 * and making the player press Escape first was pure friction.
 * With nothing selected, it toggles the tool on and off.
 */
function clickMarker(type: MarkerType): void {
  const def = MARKER_DEFS[type];

  if (activeView.selection.size > 0) {
    const cells = [...activeView.selection];
    const result = session.addMarker(activeView.player, type, cells);
    if (result.ok) {
      lastPlacement = { type, at: Date.now() };
      shareMarker(session.lastMarkerBy(activeView.player));
      activeView.selection.clear();
      say(`${def.label} placed on ${cells.map(formatCell).join(", ")}`);
      render();
      return;
    }
    activeView.selection.clear();
    armedMarker = type;
    say(`${result.reason}. ${def.label} armed — drag to draw it`);
    render();
    return;
  }

  armMarker(type, false);
}

/**
 * Arm a marker tool: the next drag becomes the marker.
 *
 * `force` comes from a double-click, which always arms. Its first click may
 * already have placed something, so that placement is taken back — otherwise
 * double-clicking to draw a line would leave a stray marker behind.
 */
function armMarker(type: MarkerType, force: boolean): void {
  if (force && lastPlacement?.type === type && Date.now() - lastPlacement.at < 700) {
    session.undo();
    lastPlacement = null;
  }

  activeView.selection.clear();
  armedMarker = force || armedMarker !== type ? type : null;
  say(
    armedMarker
      ? `${MARKER_DEFS[type].label} armed — drag across your own side to draw it`
      : "Tool put down",
  );
  render();
}



/**
 * Which digit a key press means, read from the physical key rather than the
 * character it produces.
 *
 * `event.key` is the wrong thing to test. On AZERTY the top row types
 * `& é " ' ( - è _ ç` unshifted, so it is never "1" and the number row does
 * nothing at all. And on every layout Shift+1 produces a symbol — "!" on
 * QWERTY — so Shift for corner marks was broken everywhere too.
 *
 * `event.code` is the key's position, so Digit1 is Digit1 whatever it prints.
 * The numpad is only honoured when NumLock is on, otherwise Numpad8 is an
 * arrow key and should move the selection instead.
 */
function digitFrom(event: KeyboardEvent): Digit | null {
  const top = /^Digit([1-9])$/.exec(event.code ?? "");
  if (top) return Number(top[1]) as Digit;

  const pad = /^Numpad([1-9])$/.exec(event.code ?? "");
  if (pad && /^[1-9]$/.test(event.key)) return Number(pad[1]) as Digit;

  // Layouts and environments that report no code at all.
  if (/^[1-9]$/.test(event.key)) return Number(event.key) as Digit;
  return null;
}

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    runAction(event.shiftKey ? "redo" : "undo");
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    runAction("redo");
    return;
  }

  const digit = digitFrom(event);
  if (digit !== null) {
    event.preventDefault();
    const effective: InputMode = event.shiftKey
      ? "corner"
      : event.ctrlKey || event.metaKey
        ? "centre"
        : event.altKey
          ? "colour"
          : mode;
    applyDigit(digit, effective);
    return;
  }

  const key = event.key.toLowerCase();
  const slot = PALETTE_KEYS.indexOf(key as (typeof PALETTE_KEYS)[number]);
  if (slot >= 0 && session.palette[slot]) {
    event.preventDefault();
    const type = session.palette[slot] as MarkerType;
    // Shift arms the tool outright, the keyboard equivalent of a double-click.
    if (event.shiftKey) armMarker(type, true);
    else clickMarker(type);
    return;
  }

  switch (event.key) {
    case "Backspace":
    case "Delete":
      event.preventDefault();
      runAction("delete");
      break;
    case " ": {
      event.preventDefault();
      const order = MODES.map((m) => m.id);
      mode = order[(order.indexOf(mode) + 1) % order.length] as InputMode;
      render();
      break;
    }
    case "Escape":
      activeView.selection.clear();
      armedMarker = null;
      render();
      break;
    case "ArrowUp":
      event.preventDefault();
      activeView.moveSelection(-1, 0);
      break;
    case "ArrowDown":
      event.preventDefault();
      activeView.moveSelection(1, 0);
      break;
    case "ArrowLeft":
      event.preventDefault();
      activeView.moveSelection(0, -1);
      break;
    case "ArrowRight":
      event.preventDefault();
      activeView.moveSelection(0, 1);
      break;
  }
});

// ---- render --------------------------------------------------------------

let messageTimer: number | undefined;
function say(text: string): void {
  messageEl.textContent = text;
  messageEl.classList.add("show");
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => messageEl.classList.remove("show"), 4000);
}

function render(): void {
  for (const view of Object.values(views)) view.render(session);

  for (const button of modesEl.querySelectorAll<HTMLButtonElement>("button")) {
    button.classList.toggle("active", button.dataset.mode === mode);
  }
  // The pad shows what it is about to write: full size for a digit, small and
  // tucked into a corner for a corner mark, small and centred for a centre
  // mark, and the swatch itself for a colour.
  digitsEl.className = `digits mode-${mode}`;
  for (const button of markersEl.querySelectorAll<HTMLButtonElement>("button")) {
    button.classList.toggle("active", button.dataset.marker === armedMarker);
  }
  panes.classList.toggle("online", localPlayer !== null);
  for (const pane of panes.querySelectorAll<HTMLElement>(".pane")) {
    pane.classList.toggle("active", pane.dataset.player === activeView.player);
    // Online, your partner's board is not yours to look at.
    pane.classList.toggle("mine", pane.dataset.player === localPlayer);
  }
  if (localPlayer && activeView.player !== localPlayer) {
    setActive(views[localPlayer]);
    return;
  }

  const s = session.summary();
  for (const [player, progress] of Object.entries(s.progress)) {
    const el = document.querySelector(`[data-fog="${player}"]`);
    if (el) {
      el.textContent = progress.complete
        ? "grid finished"
        : `${progress.filled}/81 · ${progress.fogRemaining} in fog`;
    }
  }

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  renderDifficulty();

  const mine = localPlayer ? s.progress[localPlayer] : null;
  const scoreboard = mine
    ? `<span>You <strong>${mine.filled}</strong>/81</span>
       <span>Partner <strong>${partner.filled}</strong>/81</span>`
    : `<span>A <strong>${s.progress.A.filled}</strong>/81</span>
       <span>B <strong>${s.progress.B.filled}</strong>/81</span>`;
  const won = mine ? mine.complete && partner.complete : s.won;

  statusEl.innerHTML = `
    ${scoreboard}
    <span><strong>${s.clues}</strong> clues</span>
    <button type="button" class="rating" id="rating">
      Rating <strong>${s.difficulty}</strong>${ratingDetail()}
    </button>
    <span><strong>${s.markers}</strong> markers</span>
    <span><strong>${s.progress.A.wrongGuesses + s.progress.B.wrongGuesses}</strong> wrong</span>
    <span class="clock">${mins}:${secs}</span>
    ${won ? '<span class="done">Both grids finished — you win</span>' : ""}
  `;

  // Clicking the rating opens the breakdown behind it.
  document.querySelector("#rating")?.addEventListener("click", () => {
    const panel = document.querySelector<HTMLDetailsElement>("#difficulty");
    if (!panel) return;
    panel.open = true;
    // Not every environment implements it, and failing to scroll is not worth
    // throwing over.
    panel.scrollIntoView?.({ block: "nearest" });
  });
}

/**
 * What the technique solver needed to crack this grid.
 *
 * Stated plainly as a classical rating, because that is what it is: the puzzle
 * solved with the whole grid in sight. It is not a rating of the game you are
 * playing, and saying so here is cheaper than letting the number mislead.
 */
/** The parenthetical after the rating word: what the solve actually needed. */
function ratingDetail(): string {
  const d = session.difficulty;
  if (!d.solved) return " <span class=\"sub\">(beyond this engine's techniques)</span>";
  return ` <span class="sub">(needs tier ${d.maxTier}: ${TIER_NAME[d.maxTier] ?? "?"})</span>`;
}

function renderDifficulty(): void {
  const body = document.querySelector<HTMLElement>("#difficulty-body");
  if (!body) return;

  const d = session.difficulty;
  if (!d.solved) {
    body.innerHTML = `
      <p><strong>Unrated.</strong> The solver stalled after ${d.steps} steps: this
      grid needs techniques above the tiers built so far (chains, wings and
      almost-locked sets are not implemented). It is still solvable — just not
      provably so by this engine, which reports a stall rather than guessing.</p>`;
    return;
  }

  const rows = [...d.perTechnique.entries()]
    .map(([id, n]) => ({ t: BY_ID.get(id), n }))
    .filter((r) => r.t)
    .sort((a, b) => a.t!.tier - b.t!.tier || b.n - a.n)
    .map(
      (r) =>
        `<tr><td>${r.t!.name}</td><td class="num">tier ${r.t!.tier}</td><td class="num">${r.n}</td></tr>`,
    )
    .join("");

  body.innerHTML = `
    <p>
      <strong>${d.label}</strong> — hardest technique needed:
      <strong>tier ${d.maxTier}, ${TIER_NAME[d.maxTier] ?? "?"}</strong>.
      ${d.steps} deductions, weighted score ${d.score}.
    </p>
    <table class="breakdown">
      <thead><tr><th>Technique</th><th class="num">Tier</th><th class="num">Used</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="hint">
      This rates the puzzle solved <em>classically</em>, with the whole grid in
      sight. It says nothing about the fogged two-player solve: cooperation
      depth and interleaving need the two-player solver, which is not built yet.
    </p>`;
}

function newGame(seed: string, options: { keepLink?: boolean } = {}): void {
  session = new Session(seed);
  partner = { filled: 0, complete: false };
  seedInput.value = seed;
  startedAt = Date.now();
  for (const view of Object.values(views)) view.selection.clear();
  renderPalette();
  const names = session.palette.map((t) => MARKER_DEFS[t].label).join(", ");
  const d = session.difficulty;
  const tier = d.solved ? `, tier ${d.maxTier} (${TIER_NAME[d.maxTier]})` : "";
  say(`New game — seed ${seed}: ${session.difficultyLabel}${tier}. Markers: ${names}`);
  // Tell the partner, unless we are adopting their seed in the first place.
  if (link && localPlayer === "A" && !options.keepLink) {
    for (const message of openingMessages("A", seed, session.markers)) link.send(message);
  }
  render();
}

// ---- networking ----------------------------------------------------------

function shareMarker(marker: Marker | null): void {
  if (marker && link) link.send({ t: "marker-add", marker: toWire(marker) });
}

function shareProgress(): void {
  if (!link || !localPlayer) return;
  const mine = session.progress(localPlayer);
  link.send({ t: "progress", filled: mine.filled, complete: mine.complete });
}

function receive(message: NetMessage): void {
  switch (message.t) {
    case "hello": {
      // The host's seed is the game. A guest on a different one rebuilds.
      if (localPlayer && needsRebuild(localPlayer, session.seed, message.seed)) {
        newGame(message.seed, { keepLink: true });
      }
      for (const reply of replyToHello(session.markers)) link?.send(reply);
      break;
    }
    case "sync":
      for (const wire of message.markers) session.applyRemoteMarker({ ...wire, cells: [...wire.cells] });
      render();
      break;
    case "marker-add":
      if (session.applyRemoteMarker({ ...message.marker, cells: [...message.marker.cells] })) {
        say(`Your partner placed a ${MARKER_DEFS[message.marker.type].label.toLowerCase()}`);
        render();
      }
      break;
    case "marker-remove":
      if (session.removeRemoteMarkers(message.ids) > 0) render();
      break;
    case "progress":
      partner = { filled: message.filled, complete: message.complete };
      render();
      break;
    case "bye":
      say("Your partner left");
      break;
  }
}

createConnectPanel(document.querySelector<HTMLElement>("#connect")!, {
  onLink(newLink) {
    link = newLink;
    localPlayer = newLink.role;
    for (const button of document.querySelectorAll<HTMLElement>("#connect .buttons button")) {
      button.classList.toggle("active", button.id === (newLink.role === "A" ? "host" : "join"));
    }
    render();
  },
  onMessage: receive,
  onState(state) {
    if (state === "open") {
      if (localPlayer) {
        for (const message of openingMessages(localPlayer, session.seed, session.markers)) {
          link?.send(message);
        }
      }
      shareProgress();
      render();
    }
    if (state === "closed" || state === "failed") {
      link = null;
      render();
    }
  },
  onHotSeat() {
    link = null;
    localPlayer = null;
    partner = { filled: 0, complete: false };
    for (const button of document.querySelectorAll<HTMLElement>("#connect .buttons button")) {
      button.classList.toggle("active", button.id === "hotseat");
    }
    render();
  },
});

seedInput.value = session.seed;
renderPalette();
window.setInterval(render, 1000);
render();
