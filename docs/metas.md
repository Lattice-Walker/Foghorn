# Solving techniques ("metas") by variant

Companion to [variants.md](variants.md). For each constraint, the deductions that
actually crack puzzles using it — the ones a setter assumes you know and a solver
reaches for first.

Sourced from the Sudoku Theory wiki's technique index, eev.ee's variant reference
(whose "corollaries" are precisely this), Logic Masters tutorials, HoDoKu, and
variant-specific guides. Items marked **[unverified]** are named techniques whose
existence is attested but whose exact statement I could not confirm — the Sudoku
Theory wiki's database is currently down and those subpages are not archived.

---

## Part 0 — Classic sudoku

Everything below assumes these. Variant constraints do not replace them; they change
which of them fire and when. Ordered roughly by cost, which is also a usable
difficulty ladder for a rating engine.

### Tier 1 — singles
- **Naked single** — a cell with one remaining candidate takes it.
- **Hidden single** — a digit with one remaining position in a row, column or box
  goes there.
- **Full house / last digit** — a unit with one empty cell.

### Tier 2 — locked candidates
- **Pointing** — a digit confined to one row (or column) within a box is eliminated
  from the rest of that row (column).
- **Claiming (box-line reduction)** — a digit confined within a row (column) to the
  cells of one box is eliminated from the rest of that box.

### Tier 3 — subsets
- **Naked pair / triple / quad** — N cells in a unit whose candidates union to N
  digits; those digits are eliminated elsewhere in the unit.
- **Hidden pair / triple / quad** — N digits in a unit confined to N cells; all other
  candidates are eliminated from those cells.
- Naked and hidden subsets of size N and 9−N in the same unit are the same deduction
  seen from two sides.

### Tier 4 — basic fish (single digit, N rows × N columns)
- **X-Wing** — a digit confined to the same two columns in two rows is eliminated
  from those columns elsewhere. Symmetric in rows/columns.
- **Swordfish** — the 3×3 case. **Jellyfish** — the 4×4 case. Larger fish are
  implied by their complements and never needed.
- **Finned / sashimi fish** — a fish with extra candidates ("fins") in one base
  unit; eliminations survive only for cells that also see every fin.
- **Franken fish** (base or cover units include boxes), **mutant fish** (arbitrary
  unit mixing), **Kraken fish** (fish plus chain to resolve the fin).

### Tier 5 — single-digit chains
- **Skyscraper** — two rows where a digit has two positions, sharing one column;
  eliminate the digit from cells seeing both non-shared ends.
- **2-string kite** — a row and a column each with two positions for a digit, linked
  through a box; eliminate from the cell seeing both far ends.
- **Turbot fish** — the general two-link form of the above.
- **Empty rectangle** — a box where a digit's candidates all fit in one row plus one
  column; combine with a strong link elsewhere.
- **X-Chain** — an alternating chain of strong/weak links in one digit.

### Tier 6 — wings and short chains
- **XY-Wing (bent triple)** — pivot `xy` seeing `xz` and `yz`; eliminate `z` from
  cells seeing both wings.
- **XYZ-Wing (bent quad)**, **WXYZ-Wing** — the same idea with the pivot retaining
  the eliminated digit, so the eliminating cell must also see the pivot.
- **W-Wing** — two identical bivalue cells `xy` joined by a strong link on `x`;
  eliminate `y` from cells seeing both.
- **S-Wing, L-Wing, M-Wing** — named short AIC patterns, all special cases of the
  general chain below.
- **XY-Chain** — a chain of bivalue cells linking `x` to `x`.

### Tier 7 — general chaining
- **Alternating Inference Chain (AIC)** — alternating strong and weak inferences;
  eliminate anything seeing both endpoints.
- **Nice loops** — continuous (eliminate on every weak link) and discontinuous
  (eliminate at the contradiction point).
- **Almost Locked Sets** — a set of N cells with N+1 candidates, used as a chain node:
  **ALS-XZ** (including doubly-linked), **ALS-XY-Wing**, **ALS-W-Wing**,
  **Sue de Coq**, **ERI pair**.
- **Forcing chains** — cell forcing (all candidates of a cell lead to the same
  conclusion), region forcing, multiple and dynamic forcing chains.

### Tier 8 — global / "exotic"
- **Set Equivalence Theory (SET)** — pick a multiset of units as "base" and another
  as "cover"; wherever they overlap, the leftovers on each side hold identical
  digit multisets. This is the single most transferable idea into variant solving.
- **Phistomefel ring** — SET's famous instance: the four 2×2 corner blocks hold
  exactly the same sixteen digits as the ring of cells bordering box 5.
- **Multi-sector locked sets / SK loop**, **rank-0 logic** — systematic SET.
- **Exocet, junior exocet, senior exocet** — base/target digit-transport patterns.
- **Firework** — digit confined to an L-shape across a box's row and column.
- **Impossible patterns** — broken wing (guardians of an odd loop), bivalue and
  trivalue oddagon.

### Tier 9 — uniqueness (valid only if the puzzle is known unique)
- **Unique rectangle** — four cells in two rows, two columns, two boxes cannot all
  reduce to the same two candidates; the types differ in how the extras are used.
- **Unique loop**, **extended rectangle** — the same argument over longer cycles.
- **Bivalue universal grave (BUG)** — if every unsolved cell would have exactly two
  candidates, the one cell with three must take its third.
- **Gurth's symmetrical placement** — a puzzle with a symmetric clue layout has a
  solution respecting that symmetry, fixing the digits on the symmetry axis.
- **Distinction theory** — generalised uniqueness reasoning.

Note for Foghorn: uniqueness techniques are **unsound under fog**. They assume the
solver sees the whole clue set; a player who sees half a grid cannot conclude that
*their* view has a unique completion. Keep them out of the two-player solver.

---

## Part 1 — Global placement rules

### Anti-knight
- **Domino elimination** — if a digit is confined to a two-cell domino in one box, it
  is eliminated from the parallel domino two cells away, since every cell of that
  domino is a knight's move from both candidates.
- **Box-to-box propagation** — a placed digit removes up to eight cells in the
  neighbouring boxes; the shape of the elimination depends on the digit's position
  within its box, which is what makes coloring effective.
- **Pointing quintuples**, **anti-knight cross**, **PotatoHead's theorem** —
  named anti-knight patterns; PotatoHead's is an extension of the Phistomefel ring
  under anti-knight, reportedly sensitive to the exact rows/columns used.
  **[unverified — exact statements not recoverable]**
- Combined with anti-king and non-consecutive this yields the "miracle sudoku",
  solvable from two givens.

### Anti-king
- No effect on box centres or grid corners: those cells only touch cells already in
  their own box. Knowing this stops you wasting scans.
- Strongest on the middle cell of a box edge, where a placement kills five cells in
  the neighbouring box.
- Weak alone; it is a combining rule.

### Non-consecutive
- Equivalent to a full white-kropki grid with no dots drawn.
- Prone to **roping** (a box's rows repeating as a cyclic permutation across the
  band), which collapses a puzzle fast once spotted.

### Disjoint groups
- Restate as nine extra regions: all top-left-of-box cells form a region, and so on.
- Weaker than it looks — each digit already sees four of its eight positional
  partners through normal sudoku. The value is in spotting the long-range effect.

### Windoku / hyper
- The four extra regions induce **nine** regions in total: the leftovers between each
  adjacent pair of hyper regions form regions too, by a counting argument (three rows
  = three digit sets, minus two hyper regions = one set left over), plus a ninth from
  the remaining cells.
- **Hidden sets of 1 to 9** across the induced regions is the standard technique.

### Sudoku X / diagonal
- **Corner/step sets** — with both diagonals live, the four corner cells mutually
  see one another and hold four distinct digits; the same applies to the four cells
  one step in and two steps in.
- **Cross-box forcing** — if a digit sits off-diagonal in box 1 and off-diagonal in
  box 9, it must be *on* the diagonal in box 5.
- **Dyer's theorem** — a named result for *anti*-diagonal sudoku (diagonals hold only
  three distinct digits each). **[unverified — statement not recoverable]**
- In anti-diagonal puzzles, the break-in is identifying the three repeated digits;
  the centre cell's digit is the one repeated on both diagonals.

### Jigsaw / irregular
- **Innies and outies** — the region-vs-row version of the killer technique: cells of
  a region poking out of a row and cells of other regions poking in must hold
  identical digit sets. Extends across several rows at once.
- Otherwise: re-derive your usual scans, because region geometry breaks the
  assumptions behind box-based habits.

### Chaos construction / deconstruction
- Requires a second strong rule to pin boundaries; solve the *shape* and the digits
  together.
- Connectivity and counting arguments (a region has nine cells; a row crossed by
  region X in k cells leaves 9−k) do most of the work.

### Clone / offset regions
- A clone cell inherits every elimination from every copy's position — union the
  constraints of all copies onto one candidate set.
- Identify the clone's digit *set* first by eliminating digits that see every cell
  of the clone.

### Gattai / samurai
- Where two same-size regions overlap, the non-overlapping remainders hold identical
  digit sets. That is SET again, across grids.

---

## Part 2 — Line constraints

### German whispers (difference ≥ 5)
- **No 5 anywhere on the line** — nothing is 5 away from it.
- **Low/high alternation** — every step crosses 5, so cells alternate between
  {1,2,3,4} and {6,7,8,9}. Color the long lines first; this is the standard break-in.
- **4 and 6 are endpoint-only** — 4's only partner is 9 and 6's only partner is 1, so
  neither can sit mid-line when its two neighbours see each other.
- **Counting** — no region can hold more than four cells of either color.

### Dutch whispers (difference ≥ 4)
- No digit is excluded outright, and no digit has a unique partner, so it is strictly
  weaker than German whispers.
- Alternation holds *except* through the 1–5–9 "hiccup". Pin down or exclude 5 and
  the segments alternate again.

### Renban (consecutive set, no repeats)
- **Sliding window** — a line of length ≥5 must contain 5; length ≥6 must contain
  {4,5,6}; length ≥7 must contain {3,4,5,6,7}; and so on. Every window of that length
  covers those digits.
- **Spread limit** — on a length-N line, two digits more than N−1 apart cannot
  coexist (no 1 and 6 on a 4-cell line).
- **Set-within-box** — segments sharing a box behave like a naked subset once the
  digit range is pinned.
- Max length 9; treat the line as a unit for overlap techniques.

### Nabner (no repeats, no consecutives)
- **Max length 5**, achieved only by {1,3,5,7,9}.
- A length-4 nabner line takes one digit from each of {1,2,3}, {3,4,5}, {5,6,7},
  {7,8,9}.
- Placing a digit kills it and both its neighbours from the rest of the line.

### Palindrome
- Eliminations transfer between mirrored cells in both directions — every elimination
  is worth double.
- Whole mirrored *segments* transfer when a segment falls inside one region.
- Color the pairs, but beware colouring two pairs separately that are in fact one
  digit.

### Thermometer
- **1 only at the bulb, 9 only at the tip.**
- **Length bound** — an N-cell thermo restricts each cell to a window of 10−N
  candidates: on a 7-cell thermo the cells are {1,2,3}, {2,3,4}, … {7,8,9}.
- **Squeeze from both ends** — bound bulbs from above and tips from below first; the
  middle resolves last.
- **Thermo cell placement / low-high placement** — a thermo inside one box forces the
  box's low digits toward the bulb end and high digits toward the tip.
- Slow thermo (≥) weakens the window; fast thermo (step ≥ N) strengthens it sharply.
- Ambiguous thermo: direction is itself a binary to resolve, often by the 1/9 rule.

### Between line
- **No 1 or 9 on the line** — one circle is below everything on it and the other above.
- Circle digits never appear on their own line, and vice versa.
- The two circles are neither equal nor consecutive, or nothing fits between.
- **Length forces the ends** — a 6-cell line forces circles {1,2} and {8,9}; a 7-cell
  line forces exactly 1 and 9.

### Lockout line
- Endpoints (diamonds) differ by at least 4; line digits lie strictly *outside* the
  closed range between them and differ from both.
- The inverse of a between line: endpoints 3 and 7 restrict the line to {1,2,8,9}.
- Each segment split by the endpoints is an independent lockout line.
- Line digits may repeat unless a region forbids it.

### Region sum line
- **Single-cell segments are gold** — a segment of one cell equals the line's sum N,
  and two such segments on one line are the same digit.
- Bound N by the min and max achievable on the *shortest* segment; that bound then
  constrains every other segment.
- Digits within a segment are distinct (same box), so killer combinations apply.

### Entropic line (L/M/H in every three)
- **Period-3 lanes** — positions 1,4,7,… share a group, 2,5,8,… share a group,
  3,6,9,… share a group. One confirmed digit classifies distant cells without
  fixing them.
- Proof of the cycle: any three adjacent cells are ABC; the fourth sits in a triple
  already holding B and C, so it must be A.
- A digit cannot repeat within two steps along the line.
- The whole solve is deciding which lane is low, which middle, which high — colour it.

### Modular line (distinct mod 3 in every three)
- Identical structure to entropic, with groups {1,4,7}, {2,5,8}, {3,6,9}. Absent
  other clues it is the same puzzle with digits relabelled.

### Parity line / alternating parity
- Same-parity lines: at most four even or five odd digits exist per region, so
  counting caps line length within a region.
- Alternating lines: colour first, resolve which phase is odd later.

### Zipper line
- **No 9 except on the centre cell** (the centre equals each pair's sum).
- Each equidistant pair is a two-cell killer cage of unknown but shared total; pairs
  that see each other take killer combinations.

### 10-lines / N-lines
- The line partitions into segments each summing to N; the partition is unknown,
  which is the difficulty.
- **Segment arithmetic** — a single cell cannot make 10, so a 4-cell line is either
  one segment or 2+2, never 1+3; a 5-cell line must be 2+3.

---

## Part 3 — Cell and border markers

### Kropki dots
- **Black dot pairs are only 1/2, 2/4, 4/8, 3/6** — a black dot never touches 5, 7
  or 9.
- **Black-dot triple** — three mutually-seeing cells chained by black dots are 1/2/4
  or 2/4/8, so the centre is 2 or 4 and both 2 and 4 appear.
- **Black dot sums are multiples of three** (x + 2x = 3x).
- **White-dot run** — a chain of white dots on mutually-seeing cells is a consecutive
  run; interior cells cannot be 1 or 9.
- **Mixed dots** — a cell with both a black and a white dot, whose two neighbours see
  each other, cannot be 1.
- **Parity counting** — every white dot spans one odd and one even digit; four
  disjoint white dots in a region force the ninth cell odd.
- **Negative constraint** — in a "full kropki" puzzle, absence of a dot forbids both
  consecutiveness and the 1:2 ratio. Hunt the gaps, not just the dots.

### XV pairs
- V pairs are {1,4} or {2,3}; X pairs span one low {1,2,3,4} and one high {6,7,8,9}
  digit, so **5 is never on an X**.
- Treat both as two-cell killer cages.
- Full-XV negative constraint: no unmarked adjacent pair sums to 5 or 10.

### Greater/less (inequality)
- 1 is never the greater, 9 never the lesser.
- **Chains** — A > B > C forces all three distinct even if A and C do not see each
  other, and bounds A ≥ 3, C ≤ 7.
- Equivalent to an orthogonal-only thermo; thermo bounds apply directly.

### Fortress / min-max cells
- A white cell adjacent to grey cannot be 9; a grey cell adjacent to white cannot be 1.
- **Neighbour counting** — a grey cell with k mutually-seeing white neighbours is at
  least k+1. Symmetrically for minimum cells.

### Even / odd shading
- A region holds at most four even and at most five odd digits — count and colour.

### Quadruples
- A digit appears at most twice in a circle (four cells span two rows), and a repeat
  must be placed **diagonally**.
- Four distinct digits in a circle fix the four cells exactly.
- A circle inside one box eliminates its digits from the box's other five cells.
- Two aligned circles sharing digit N confine both N's to the two shared rows or
  columns, clearing N from the rest of them.

---

## Part 4 — Sums

### The shared arithmetic core
- **The secret** — every region sums to 45; triangular numbers 1, 3, 6, 10, 15 are
  the minima for 1–5 distinct digits.
- **Extreme combinations** are the working vocabulary. Unique two-cell sums: 3={1,2},
  4={1,3}, 16={7,9}, 17={8,9}. Unique three-cell: 6={1,2,3}, 7={1,2,4}, 23={6,8,9},
  24={7,8,9}. Unique four-cell: 10, 11, 29, 30. Unique five-cell: 15, 16, 34, 35.
  Sums near the midpoint (20 for four cells) are nearly free and carry no information.
- **Forced digits without a forced set** — a three-cell 8 is {1,2,5} or {1,3,4}: the
  combination is ambiguous but the 1 is not.
- **Multi-region arithmetic** — sum groups of cages across k regions and compare with
  45k. This is SET with numbers attached.

### Killer
- **Rule of 45 / innies and outies** — a region's cages summing to 45+d leave an outie
  of d; summing to 45−d leave an innie of d. The **multiple-45 rule** applies the
  same across several regions taken together.
- Cages create subsets early, because you usually know a cage's digit set before its
  arrangement.
- Cages are extra units for overlap techniques (no repeats within a cage).
- **Same-digit colouring** across cages with shared forced digits.

### Little killer
- Digits along the diagonal **may repeat** — killer combinations apply only where the
  diagonal stays inside one box.
- **Degrees of freedom** — measure the clue against the extreme: two digits summing
  to 16 sit 2 below the maximum 18, so neither digit is below 7. The same counting
  from the minimum bounds them above.

### Arrow
- A digit on a multi-cell arrow is never 9; a circle attached to a multi-cell arrow is
  never 1.
- **Three-in-a-region arrow** — three arrow cells in one region sum to at least
  1+2+3=6, so the circle is 6, 7, 8 or 9. (The "123 trick".)
- **Sum shifting** — where an arrow and a region (or another arrow) overlap, cancel
  the shared cells and equate the remainders; this is how pills and long arrows are
  attacked. **[named on the Sudoku Theory wiki; statement reconstructed]**
- Digits may repeat on an arrow unless a region forbids it — check before assuming.
- Pills read as multi-digit numbers, which is how totals above 9 appear.

### Zipper, double arrow, split pea
- All reduce to "two sets with equal sums": cancel common cells, compare remainders.

### Sandwich
- A clue of 0 means 1 and 9 are adjacent; a clue of 35 means they are at the two ends;
  **no clue is ever 1**.
- **Cell-count bounds** — each total needs a minimum and maximum number of cells
  (2, 3, 4 need one cell; 31, 32, 33 need six). Large clues push 1 and 9 apart.
- **Complement trick** — the digits *outside* the 1 and 9 sum to 45 − 10 − clue. A
  clue of 31 leaves 4 outside, which must be a lone 4, so the outer cells are {1,4,9}.
- A clue above 21 forbids 1 and 9 from the central cell.

### Doublers and other modifier cells
- One modifier cell per row, column and box, and the nine modified digits are a
  complete set 1–9. That is itself a placement puzzle running in parallel.
- A region's *value* total is 45 + (its doubled digit), so a known cage or region
  total tells you which digit is doubled there.
- Negators give 45 − 2d; halvers and ±1 modifiers follow the same accounting.

### Counting circles
- The distinct circled digits sum to the total number of circles, and they do not
  repeat — a killer combination of unknown length.
- A region containing N circles needs at least N distinct circled digits.
- A region containing no circles means 9 is not circled.

---

## Part 5 — Outside clues

### Skyscrapers
- A clue of 9 forces the row to read 1..9 in order; a clue of 1 forces 9 first.
- A clue of 2 cannot have 8 second: the first cell would be under 9, and the 9 later
  would make three visible.
- General bound: a clue of k needs the 9 at position ≥ k, and the first cell is at
  most 10 − k.
- Beyond the extremes, skyscrapers resist tidy rules and reward case analysis on
  where the 9 sits.

### X-sums
- The first digit is both the count and part of the sum — it cannot be rearranged
  with the rest.
- **Count-consistency** — a clue of 11 can never span four cells, because the only
  four-digit set summing to 11 is {1,2,3,5}, which contains no 4.
- Clue 1 forces a 1 first; clue 45 forces a 9 first.

### Numbered rooms
- The first cell's digit N indexes into the row; the clue is the digit in the Nth
  cell.
- Self-reference: if the clue equals the first digit, that digit is at its own index.
- Each clue is a disjunction over nine cases, so it pairs well with anything that
  bounds the first cell.

### Little killer — see Part 4.

---

## Part 6 — Shading and pencil-puzzle hybrids

### Yin–yang
- **Escape analysis** — no colour may be sealed off from the rest of its colour;
  cells on the only escape route are forced.
- **No 2×2 checkerboard** — the diagonal pair could never connect without severing
  the other colour. This is the workhorse deduction.
- **Border rule** — the grid border changes colour at most twice, so each colour
  occupies at most one contiguous span of it. Usually the break-in.
- Every 2×2 contains both colours, so each colour always has somewhere to escape to.

### Cave / corral
- Escape analysis for cave cells (they must all connect); wall chunks must reach the
  grid edge, so interior wall also needs an escape.
- Behaves like yin-yang with an implied ring of wall outside the grid, so the
  checkerboard rule carries over.
- **Kurodoko clues** count cells of one colour visible in all four directions,
  including the clue cell.

### Nurikabe
- Escape analysis applies to the ocean only; islands are allowed to be many.
- Distinct islands must stay separated, which forces ocean between them.
- The checkerboard rule does *not* apply in general — only when both same-coloured
  cells are known to be one island.
- No 2×2 all ocean.

### Loop / snake
- Degree counting: every loop cell has exactly two loop neighbours.
- Parity and connectivity arguments; dead-end elimination.
- The digits couple in via a secondary rule (bend/straight parity is common).

### Star battle overlays
- Standard star-battle logic (rows, columns and regions each take a fixed count, stars
  never touch) runs alongside the digits and usually gates them.

---

## Part 7 — Meta-variants

- **Indexing** — the digit is a coordinate. The classic 159 form: the digit in column
  1 of row r says which column holds the 1 in row r. Key property: indexing is an
  **involution** — if r1c1=5 then r1c5=1 — which is where the deductions come from.
- **Liar / wrogn** — exactly one stated property of a clue is violated. Solve by
  enumerating which property broke; often the *count* of liars is the real constraint.
- **Multitask** — one clue obeys several rules at once; intersect the candidate sets.
- **Ambiguous clues** — the rule for each clue is unknown; the deduction is usually
  "under every possible rule, this cell cannot be X".
- **Knapp daneben** — every clue is ±1 from truth; work with intervals.
- **Schrödinger cells** — a cell holds two digits, both counting everywhere. Region
  counting changes: a region now holds ten digit-slots for nine digits.
- **Fog of war** — placing a correct digit clears fog on that cell and its touching
  neighbours. Structurally: a wrong placement announces itself, which is information;
  and a *correct placement for the wrong reason* can reveal clues out of order.
  A pure-fog puzzle with no other constraint is believed impossible to construct.

---

## Relevance to Foghorn

Three things from this document should shape the engine.

**The technique tier list in Part 0 is the difficulty axis**, and it is already ranked
by cost. Implement each tier as a pure function `(GridState) → Deduction[]`, rate a
puzzle by the highest tier it requires and the count per tier, and you have a
defensible single-player difficulty score before fog enters the picture.

**Uniqueness techniques (Tier 9) must be excluded.** They rest on the solver seeing
the whole puzzle. Under fog, neither player's view has a unique completion, so a
unique-rectangle argument is not merely hard, it is invalid. The same caution applies
to Gurth's symmetrical placement and BUG.

**The variant metas are the marker vocabulary, pre-tested by thousands of puzzles.**
Every technique in Parts 2–4 is a deduction a human can carry out from a relational
clue that names no digit — which is exactly the message type Foghorn allows. The
strongest candidates, judged by how much work they do per clue and whether they can
ever force a singleton:

| Marker | Meta it imports | Singleton risk |
|---|---|---|
| `DOUBLE` | kropki black: pairs only 1/2, 2/4, 4/8, 3/6; excludes 5/7/9 | safe alone |
| `CONSECUTIVE` | kropki white: parity split, runs, no 1/9 interior | safe alone |
| `SAME_PARITY` / `OPPOSITE_PARITY` | region counting (≤4 even, ≤5 odd) | safe |
| `GREATER` | inequality chains, thermo bounds | safe |
| `HALF(LOW/HIGH)` | whisper colouring, X-pair split | safe |
| `SUM(cells, S)` | full killer machinery | **unsafe at extremes** — S=3 forces {1,2} |
| `SHARED_TRIPLE` | renban/region-sum set transfer, jigsaw innies-outies | safe |
| `DIFF_AT_LEAST(5)` | German whispers: excludes 5, forces alternation | safe |

Two design notes fall out. First, the **entropic/modular period-3 lane structure** is
the best fit for fog of anything here: it classifies cells far along a line without
fixing any of them, which is precisely a clue one player can send about cells the
other cannot see. Worth adding an `ENTROPIC_GROUP` marker. Second, **negative
constraints** (full-kropki style) are powerful but leak badly under fog — "there is no
dot here" is a claim about cells the sender may not be able to see, so the invariant
checker would have to run against the sender's knowledge, not the solution. Start
without them.
