# Which sudoku variants can Foghorn actually use?

An admissibility pass over [variants.md](variants.md) and [metas.md](metas.md),
deciding what survives contact with fog, split views, and the no-digit-reveal rule.
This document is the input to the generator plan — the generator only has to handle
what survives here.

---

## 1. The reframe: two roles, two different tests

A variant constraint can enter Foghorn in one of two ways, and they are not judged by
the same standard.

**Role A — puzzle-level rule.** Part of the generated puzzle, announced to both
players before the first move, true of the whole grid. Anti-knight is a role-A rule:
nobody places it, it simply holds.

**Role B — player marker.** A clue one player draws during play to transmit a
deduction to the other. This is the mechanic the project is built around.

Most of the catalogue fails as a marker but is perfectly fine as a puzzle rule, and
the reverse almost never happens. Sorting each variant into the right role does more
work than eliminating it outright.

## 2. The six tests a marker must pass

1. **Non-revealing.** In isolation it cannot reduce any cell to one candidate. This
   is the project's founding rule, stated mechanically.
2. **No covert stacking.** Test 1 is about a marker's *intrinsic* content, judged
   against a blank cell — it is not a ban on markers resolving cells, which is the
   entire point of them. The separate hazard is a player spelling out a digit with a
   pile of individually-legal markers ("even", "high", "not 6", "not 8" = 4). The
   defence is structural, not a candidate count: ban unary markers, cap markers per
   cell, and require each one to be backed by a deduction the engine can verify.
3. **Sender-verifiable.** The placer must be able to *prove* the assertion from their
   own view. A player cannot truthfully claim a relation among cells they cannot see,
   and cannot claim the absence of one anywhere.
4. **Receiver-useful.** It must combine with knowledge the receiver has and the sender
   lacks — the crossing rows, columns and boxes — to yield progress. A marker
   resolvable entirely within the sender's own region is decoration.
5. **Parameter-free.** A marker carrying a free number (a cage total, an N-line's N, a
   ratio dot's ratio) is an arbitrary-bandwidth channel between two people who are not
   supposed to have one, and collapses to a digit reveal at the extremes.
6. **Locally propagable.** The engine must be able to turn it into candidate
   eliminations without search, so it can participate in the solvability proof.

Test 3 has a consequence worth stating plainly, because it shapes the whole game:
**markers are drawn on cells the sender can see and read by a partner who cannot.**
The sender proves a relation inside their own region but cannot resolve it; the
receiver, who knows what the crossing rows and columns are missing, can. That is the
cooperation loop, and it means marker geometry should be **small and local** — two to
four cells inside one region — rather than long lines spanning the grid.

---

## 3. Eliminated

### 3.1 Clues that name digits — fail test 1 outright

| Variant | Why |
|---|---|
| **Quadruple circles** | The circle lists the digits. Four digits for four cells is a complete set reveal; even one digit is a direct statement about contents. |
| **Pencilmark clues** | Definitionally a candidate list. |
| **Given digits as a player action** | The thing the rules forbid. |
| **Counting circles** | Self-referential over the whole grid ("N circles contain N"), unverifiable from half a view, and resolves to explicit digits. |
| **Indexing / 159** | Makes position and value interchangeable, so "the 5 is in column 3" *is* a placement. The rule cannot coexist with a no-reveal rule. |

### 3.2 Clues needing whole-line or whole-grid knowledge — fail test 3

| Variant | Why |
|---|---|
| **Sandwich** | Sums digits between the 1 and 9 across a full row. A player seeing five columns cannot compute it, and a clue of 0 or 35 pins both digits' positions. |
| **X-sums** | Same: needs the whole row, and the first digit is both index and addend. |
| **Skyscrapers** | Visibility count over nine cells; a clue of 9 orders the entire row. |
| **Numbered rooms** | Indexes into the far side of the row the sender cannot see. |
| **Little killer** | Sums a diagonal crossing both regions, plus a free total (test 5). |

All five are also drawn *outside* the grid, so they have no fog semantics — there is
nowhere to hide them and no cell for a reveal to attach to.

### 3.3 Shading and topology hybrids — fail tests 3 and 6

**Yin–yang, cave/corral, nurikabe, loop, snake, star battle, kurodoko clues.**

Every meta these variants offer is a connectivity argument — escape analysis, the
2×2 checkerboard rule, the border-changes-colour-twice rule. All of them reason about
paths across the *whole* grid. Under fog, neither player can run them, and a partial
shading is not a partial deduction, it is a wrong one. They also constitute a second
complete puzzle layered on the first, roughly doubling engine scope for a mechanic
that fog actively breaks.

### 3.4 Structurally under-determined under fog

| Variant | Why |
|---|---|
| **Chaos construction** | Region boundaries are unknown *and* half the grid is unknown. The intersection is under-determined, and region shape is global knowledge no single player can establish. |
| **Deconstruction / BYOB** | Same, worse: box positions unknown on a larger grid. |
| **Gattai / samurai** | Multiple overlapping grids is an orthogonal axis of complexity that adds nothing to the two-player idea. |

### 3.5 Meta-variants that break the trust model

| Variant | Why |
|---|---|
| **Liar / wrogn** | A deliberately false clue is indistinguishable from a partner's error or cheating. In a co-op game with no communication channel, "one of these clues is lying" destroys the only thing the players can rely on. This is the sharpest incompatibility in the list. |
| **Knapp daneben** | Same objection, weaker form. |
| **Ambiguous clues** | The rule of each clue is unknown. Fog already supplies the ambiguity budget; stacking a second source makes difficulty rating meaningless. |
| **Multitask** | Not harmful, but it multiplies the palette combinatorially against the "few clue types per grid" rule. |

### 3.6 Parallel hidden-placement puzzles — fail test 3

**Doublers, negators, halvers, ±1 modifiers, Schrödinger cells.**

Each hides a second placement problem (one special cell per row, column and box)
whose solution is global. A player cannot verify where the modifiers are from half a
grid, and a marker asserting something about a modified value is unprovable. Schrödinger
cells additionally double the state of every cell in the engine. Defer all of these.

### 3.7 Negative constraints — fail test 3

**Full-kropki, full-XV, and any "all such clues are given" rule.**

"There is no dot here" is an assertion about every adjacent pair in the grid,
including pairs inside the other player's fog. No player can make it truthfully.
Powerful in single-player variant sudoku; unusable here.

### 3.8 Free-parameter sum clues — fail test 5

**Killer cages with totals, N-lines, numeric kropki/difference dots, product cages.**

A chooseable number is a covert channel: the palette says `SUM`, the player says
"17", and two cooperating cheaters have an alphabet. At the extremes it is also a
direct reveal — a two-cell cage of 3 is the digits 1 and 2.

Salvage: the *parameter-free* relatives survive. "These two cages have equal sums"
and "the circle holds the sum of these cells" (arrow) state a relation without naming
a number. Those are in the keep list.

### 3.9 Not a variant, but excluded: uniqueness techniques

Unique rectangles, unique loops, BUG, Gurth's symmetrical placement. They assume the
solver sees the whole clue set. Neither Foghorn player's view has a unique
completion, so these arguments are not merely difficult, they are **invalid**. The
two-player solver must not contain them, and the difficulty rater must not credit
them.

---

## 4. Reclassified, not eliminated: role-A puzzle rules

These cannot be markers — nobody places them, they are properties of the grid — but
they are excellent puzzle-level modes, and for a reason specific to this project:
**they propagate across the fog boundary.** Anti-knight tells a player something
about cells they cannot see, from a digit they just placed. That is free cooperation
depth, and it costs the marker palette nothing.

| Rule | Value under fog |
|---|---|
| **Anti-knight** | Strongest candidate. A placement eliminates up to eight cells, several of them across the boundary. Domino elimination still works from one side. |
| **Anti-king** | Weak alone, cheap to add, pairs well with the above. |
| **Non-consecutive** | Global, symmetric, propagates across the boundary everywhere. |
| **Disjoint groups** | Creates nine extra regions that each span both players' views — structurally ideal for forcing cooperation. |
| **Windoku / hyper** | Extra regions straddling the split; the induced-nine-regions corollary gives real deductive depth. |
| **Sudoku X / diagonal** | Both diagonals cross the boundary by construction. |
| **Jigsaw / irregular** | Compatible, and innies/outies across the split is a genuinely two-player deduction. Adds UI work. |
| **Magic square** | Harmless but boxed into one region; low value. |

The cost is that both players must be told the rule at start, which is fine — it is
symmetric information, present before any fog exists, and leaks nothing.

### 4.1 Localised rules: the badge form

A global rule does not have to be global. Asserted of **one named cell**, it becomes
placeable, and that changes its classification entirely:

> **Knight badge on r2c2** — whatever digit r2c2 holds, it does not repeat at any
> knight's move from r2c2.

This is the strongest marker class available, for three reasons. It is a **pure
disequality**, so it cannot state a value under any circumstances — the safest
possible content. It **reaches outward** to up to eight cells rather than one
neighbour, several of them across the fog boundary. And it is **targetable**: the
generator can place one at the exact cell where the two-player solver stalled, which
is precisely what the construct-from-the-trace generator needs.

The same localisation works for anti-king (no repeat in the surrounding eight),
non-consecutive (no orthogonal neighbour is consecutive), and disjoint groups (no
cell in the same relative box position repeats). Each is a fixed-geometry batch of
disequalities over a named cell.

**Provability is geometric.** A player can prove a knight badge only when every
knight-target of that cell is covered by their own knowledge — true for cells in the
interior of their region, false near the fog boundary where targets sit in the
partner's view. The engine knows each player's view and can decide this mechanically
at placement time. Three deployments follow, and they are not equally sound:

| Deployment | Verification | Verdict |
|---|---|---|
| **Generator-placed badge**, shipped with the puzzle and visible through fog to both | none needed — the generator knows the solution | **Preferred.** Sited where the solve needs it. |
| **Player-placed, provability-gated** — the engine confirms the placer's view entails it | mechanical, at placement | **Sound.** A real transmitted deduction. |
| **Player-placed on trust** | none | **Rejected.** Unverifiable assertion about fogged cells. |

Because badges are granular, the earlier open question of whether to adopt global
rules in v1 dissolves: there is no all-or-nothing choice to defer. Badges dominate
global rules for this project — a global rule applies everywhere, including the
nine-tenths of the grid where it does nothing, while a badge is placed where it pays.

---

## 5. Survivors: the marker palette

All parameter-free, all 2–4 cells, all provable from one region, all propagable
without search. Candidate sets are stated for a cell with no other information, to
show test 1 passing.

| Marker | Statement | Worst-case cell candidates | Imported meta |
|---|---|---|---|
| `EQUAL(a,b)` | same digit | 9 | palindrome / clone: every elimination counts twice |
| `DOUBLE(a,b)` | one is twice the other | 6 — {1,2,3,4,6,8} | kropki black: pairs only 1/2, 2/4, 4/8, 3/6; excludes 5,7,9; sum is a multiple of 3 |
| `CONSECUTIVE(a,b)` | differ by 1 | 9 | kropki white: opposite parity, runs, no 1/9 in a chain interior |
| `GREATER(a,b)` | a > b | 8 | inequality chains, thermo bounds |
| `SUM10(a,b)` / `SUM5(a,b)` | fixed totals | 8 / 4 | XV: 5 never on an X; X spans one low and one high |
| `WHISPER(a,b)` | differ by ≥5 | 8 — excludes 5 | German whispers: low/high alternation, 4↔9 and 6↔1 forced |
| `SAME_PARITY` / `OPP_PARITY` | parity relation | 9 | region counting: ≤4 even, ≤5 odd |
| `ENTROPIC_GROUP(a,b)` | same or different L/M/H band | 9 | entropic lanes — see §6 |
| `RENBAN3(a,b,c)` | three consecutive digits | 7 | sliding window, spread limit |
| `NABNER3(a,b,c)` | no repeats, no consecutives | 9 | one digit from each of the overlapping bands |
| `THERMO3(a,b,c)` | strictly increasing | 7 | 1 only at bulb, 9 only at tip, 10−N window |
| `BETWEEN(a;m;b)` | m strictly between a and b | 7 — excludes 1,9 from m | circles never on the line, length forces the ends |
| `ZIPPER3(a,b,c)` | a + c = b | 8 | 9 only at centre; pairs are two-cell cages |
| `EQUAL_SUM(pair, pair)` | two pairs share a sum | 9 | region-sum lines, cancel-and-compare |
| `SHARED_SET(triple, triple)` | same three digits | 9 | jigsaw innies/outies, hidden-triple transfer |
| `ARROW(circle, cells)` | circle = sum of cells | 8 | circle never 1, cells never 9, the 1+2+3 bound |

Two notes on this table. `ENTROPIC_GROUP` is the standout for this project and the one
I would prioritise: the period-3 lane structure classifies a cell's *band* without
touching its value, which is the purest possible "I know something about that cell
and it is not a digit". `SHARED_SET` is the other high-value entry — it transmits the
shape of a hidden-triple deduction, exactly what a human would want to say.

Unary markers — "this cell is even", "this cell is high" — pass test 1 but are the
main hazard for test 2, since they stack on a single cell toward a singleton. They
are also the least interesting messages in the game. See §6.

---

## 6. Open calls before writing the plan

**(a) Resolved — superseded by §4.1.** Localised badges replace the global-rule
question. Build the badge as a first-class marker with a provability gate, and let the
generator place them; no global mode is needed in v1.

**(b) Unary markers: allowed, budgeted, or banned?** Banning them removes the covert
stacking hazard almost entirely, since relational markers over distinct cell pairs
are hard to conspire into a spelled-out digit, and it keeps every message genuinely
relational — closer to the spirit of the rule. My recommendation is to ban them in v1.
