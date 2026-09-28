# Sudoku variants (the Cracking the Cryptic repertoire)

> Solving techniques for each variant listed here are in [metas.md](metas.md).

A catalogue of the variant constraints that recur on Cracking the Cryptic, grouped by
family. Each entry states the rule as a setter would phrase it. This is reference
material for choosing Foghorn's marker vocabulary — see the notes at the end.

Written from knowledge of the channel's regular repertoire, not scraped from the
channel itself; treat individual rule phrasings as needing a check against a real
puzzle before they go into the engine.

---

## 1. Global digit-placement rules

- **Classic sudoku** — each row, column and 3×3 box contains 1–9 once.
- **Irregular / jigsaw sudoku** — the nine boxes are replaced by nine irregular
  connected regions of nine cells.
- **Chaos construction** — the nine regions are *not* given; solving the puzzle
  includes deducing the region boundaries.
- **Anti-knight** — cells a chess knight's move apart cannot contain the same digit.
- **Anti-king** — cells a king's move apart cannot contain the same digit.
- **Non-consecutive** — orthogonally adjacent cells cannot contain consecutive digits.
- **Disjoint groups** — cells occupying the same relative position within their box
  form an extra set of nine that must contain 1–9 once.
- **Windoku / hypersudoku** — four extra shaded 3×3 regions each contain 1–9 once.
- **Sudoku X / diagonal** — one or both main diagonals contain 1–9 once.
- **Magic square** — a designated 3×3 box whose rows, columns and diagonals all sum
  to 15.
- **Offset / clone regions** — two marked regions of identical shape contain the same
  digits in the same relative positions.

## 2. Line constraints

- **German whispers** — adjacent digits along the line differ by at least 5.
- **Dutch whispers** — adjacent digits differ by at least 4.
- **Renban** — the line's digits are a set of consecutive digits in any order,
  non-repeating.
- **Nabner** — no two digits on the line are equal or consecutive.
- **Palindrome** — the line reads the same from either end.
- **Thermometer** — digits strictly increase from the bulb.
- **Slow thermometer** — digits increase or stay equal from the bulb.
- **Arrow** — the digits along the arrow sum to the digit in the circled bulb (a
  multi-cell bulb reads as a multi-digit number).
- **Between line** — every digit strictly between the two circled endpoints in value.
- **Lockout line** — every digit lies strictly outside the range of the two diamond
  endpoints, which themselves differ by at least 4.
- **Region sum line** — the line's segments within each box all sum to the same total.
- **Entropic line** — any three consecutive cells contain one low (1–3), one
  middle (4–6) and one high (7–9) digit.
- **Modular line** — any three consecutive cells contain one digit of each residue
  mod 3.
- **Parity line** — adjacent digits alternate odd and even.
- **Zipper line** — digits equidistant from the line's centre sum to the same total.
- **Whisper/renban hybrids and "doubling" lines** — occasional one-off line rules,
  always spelled out in the puzzle's ruleset.

## 3. Cell and border markers (local relations)

- **Kropki dots** — white dot: consecutive; black dot: one digit is double the other.
  Usually "all dots are given" (negative constraint).
- **XV** — X marks an adjacent pair summing to 10, V a pair summing to 5.
- **Inequality / greater-than sudoku** — arrowheads on borders order adjacent cells.
- **Quadruple circles** — a circle at a four-cell intersection lists digits that must
  appear among those four cells.
- **Even/odd shading** — a square marks an even digit, a circle an odd one.
- **Minimum / maximum cells** — a celled marked min is lower than all orthogonal
  neighbours; max is higher than all of them.
- **Difference / ratio clues** — a number on a border gives the exact difference or
  ratio between the two cells.

## 4. Sum and arithmetic constraints

- **Killer sudoku** — dotted cages sum to a given total, digits within a cage do not
  repeat.
- **Little killer** — a diagonal arrow outside the grid gives the sum of the diagonal
  it points along; digits may repeat.
- **Sandwich sudoku** — a clue gives the sum of digits strictly between the 1 and the
  9 in that row or column.
- **Mystery sandwich** — the two crust digits are not specified, or are given as a
  pair to be deduced.
- **Thermo-killer, killer-arrow and similar hybrids** — cage rules stacked on line
  rules.
- **Doubler / negator cells** — one cell per row, column and box has its value doubled
  (or negated) for the purposes of all sums.
- **Fortress** — digits on shaded fortress cells are strictly greater than their
  orthogonal neighbours.
- **Product / multiplication cages** — cage digits multiply to the given total.

## 5. Outside-the-grid clues

- **Skyscrapers** — the clue counts how many digits are visible along the row or
  column, reading digits as building heights.
- **X-sums** — the first digit N in the row determines that the first N digits sum to
  the clue.
- **Numbered rooms** — the clue digit appears in the position given by the first
  digit of that row or column.
- **Battlefield, rossini, first-seen-parity and similar** — rarer outside clues,
  always fully stated in the ruleset.

## 6. Loop, path and object constraints

- **Cave / yin-yang** — cells are partitioned into shaded and unshaded sets with
  connectivity rules that interact with the digits.
- **Nurikabe** — shaded cells form a connected sea, unshaded cells form islands of
  given size, no 2×2 fully shaded.
- **Star battle** — a fixed number of stars per row, column and region, stars never
  touching, overlaid on the digits.
- **Snake / loop constructions** — a path is drawn through the grid and its cells
  obey a digit rule.
- **Sudoku with a hidden or deduced shape** — the object's shape is itself part of the
  solve.

## 7. Meta and structural variants

- **Schrödinger cells** — one cell per region holds two digits at once, both counting
  for every constraint.
- **Fog of war** — cells are hidden until a correct digit is entered next to them;
  the grid reveals as you solve. This is the CTC mechanic Foghorn extends.
- **Sudoku variants with hidden rules** — the ruleset itself must be deduced, most
  common in chaos construction and "mystery" puzzles.
- **Multi-grid / overlapping sudoku (samurai)** — several grids sharing boxes.
- **Non-standard grid sizes** — 6×6 with 2×3 boxes is the usual teaching size.

---

## Relevance to Foghorn

The variants that matter most for the marker vocabulary are the **local relation**
families — §3 in particular, plus the low-arity members of §2 and §4. A Kropki black
dot is exactly the `DOUBLE` marker the project started from; white dots, V/X, and
inequality arrows are `CONSECUTIVE`, `SUM`, and `GREATER`. Entropic and modular lines
generalise to the `HALF` and parity markers.

The test each candidate must pass is the legality invariant: a marker is admissible
only if, in isolation, it cannot reduce a cell to a single candidate. That rules out
some otherwise attractive imports — a V clue on a pair where one cell is already
known, a killer cage of size 1, a quadruple circle listing four digits for four
cells. Global rules (§1) and outside clues (§5) are mostly unusable as markers: they
are properties of the whole puzzle rather than messages one player can choose to
send, though some could be interesting as *puzzle-wide* variant modes layered under
the fog.
