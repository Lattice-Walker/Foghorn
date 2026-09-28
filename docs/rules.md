# Foghorn: formal rules

The rules of the game, stated precisely enough that the solver, the generator, and
both clients can be written against them without further interpretation.

Derived from [variants.md](variants.md), [metas.md](metas.md) and
[marker-eligibility.md](marker-eligibility.md). Where this document and those
disagree, this one wins.

---

## 1. Objects

The grid is **always 9×9**. No other size is supported, in the engine, in tests, or
as a tutorial; size is not a parameter and the code may assume it.

| Symbol | Meaning |
|---|---|
| `D` | the digits, `{1..9}` |
| `C` | the 81 cells `(r,c)` |
| `U` | the 27 standard units (9 rows, 9 columns, 9 boxes) |
| `S : C → D` | the solution, fixed at generation, never transmitted whole |
| `P` | the players, `{A, B}` |
| `B_p : C → D ∪ {∅}` | player `p`'s **own board**, the digits they have entered |
| `Π` | the puzzle's **palette**: the marker types legal in this puzzle |

**Each player has their own board.** `B_A` and `B_B` are separate grids over the
same solution. Filling a cell does nothing for your partner; they must reach it
themselves. The players are not taking turns on one grid — they are solving the same
puzzle from different partial views, and the only thing that crosses between them is
a marker.

Two further notions per player `p`, and keeping them apart is the single most
important thing in this document:

- **Visibility** `V_p : C → {HIDDEN, VISIBLE}` — what the interface shows `p`.
- **Knowledge** `K_p : C → 2^D` — the candidate set `p` has derived for a cell.

`K_p` is defined over **all 81 cells, including fogged ones.** A player reasons about
cells they cannot see — that is the entire game. Visibility governs what is *given*
to a player; knowledge is what they *derive*. Conflating the two collapses the design.

## 2. What fog hides

For a cell `x` with `V_p(x) = HIDDEN`, player `p` is shown:

- **not** `S(x)`, and **not** whether `x` is a given;
- **not** anything about `B_q`, the partner's board. Fog is total in that direction:
  no indicator that a partner has filled a cell, because their progress is not this
  player's to read;
- **yes** the cell's position and unit membership (trivially);
- **yes** whatever `p` has written there themselves — their own digit, pencil marks
  and colour all render **on top of** the fog;
- **yes** every **marker and badge** attached to `x`.

Fog hides what a player does not know, not what they wrote. The distinction is what
makes a fogged cell somewhere to work rather than somewhere to wait: a player may
reason about, annotate and guess at a cell long before they can see it.

A digit visible on a fogged cell is always **wrong**, and is shown as such. It cannot
be otherwise: a correct placement lifts the fog beneath it (R11), so a cell that is
still fogged and still holds a digit is holding a mistake.

> **Axiom M (marker transparency).** Markers are visible to both players regardless of
> fog. A marker on a fogged cell is the mechanic, not an edge case: it is how a
> constraint about cells you cannot see reaches you.

## 3. Core rules

**R1 — Sudoku.** `S` assigns each digit exactly once per unit in `U`.

**R2 — Placement.** Player `p` may enter a digit in **any** cell of `B_p`, fogged or
visible. If you have proved what belongs in a cell you cannot see, you may place it.
A player writes only on their own board.

This is the point of the game rather than a concession: deducing a cell inside your
partner's region is otherwise worthless until someone happens to reveal it, and under
R2 it is instead the payoff. Placing into fog is the main way reasoning about hidden
cells cashes out, and it raises cooperation depth rather than gating it.

Edge case: a player may place into a fogged cell that turns out to be a **given**.
That is correct by R3 (it matches `S`), and simply reveals the cell.

**R3 — Verdict.** A placement is checked against `S`. Correct placements trigger
reveals (R11); incorrect ones are rejected and reveal nothing.

> **Consequence — the verdict is an oracle.** "Place and see whether fog lifts" is a
> free `S(x) = d?` query, and 729 of them recover the grid. This is inherent to any
> fog-of-war mechanic, not a flaw introduced by R2; the original CTC fog puzzles
> answered it with three lives and the idea was dropped as unfun. The defensible
> position: put a cost on wrong placements, surface them to the partner (who sees
> every move anyway), and **never let the generator rely on fog for difficulty** —
> the puzzle must be solvable by deduction, and guessing is a player's choice to
> spoil their own game.

> **Consequence — client-side verification cannot be made cheat-proof.** The split
> answer key scheme gave each client the key for the *other* player's region, sound
> only because you never placed there. Under R2 both players place everywhere, so any
> client holding any part of `S` holds answers to cells it will place into. No split
> between two clients survives this.
>
> **Position taken: soft security.** Foghorn is a co-operative, trust-based game.
> Raise the cost of cheating where it is cheap to do so, and otherwise accept that a
> player who digs the answers out of their own browser has spent effort to destroy
> the only thing the game offers them. No part of the design may be contorted to
> prevent it. Moving the key to a relay referee remains available if it ever matters.
>
> This tolerance extends to players only. It does **not** extend to the generator —
> see §10.

**R4 — Completion.** The game is won when **both** boards are complete and correct.
Neither player wins alone, and finishing first is not finishing.

## 4. Communication rules

Players exchange **no** free-form channel. The only transmission is placing a marker.

A marker is `m = (τ, x̄, p, t)` — a type from the palette, an ordered tuple of cells,
the placer, and a time. Its meaning is a relation `π_τ ⊆ D^n` over the digits of `x̄`.

**R5 — Palette restriction.** `τ ∈ Π`, and `|Π| ≤ 3`. A player may not choose freely
from the whole catalogue; the puzzle fixes a small vocabulary at generation time.

**R6 — Provability.** `p` may place `m` only if `p`'s knowledge **entails** it:

```
for every assignment σ consistent with K_p and all active constraints,
    π_τ( σ(x̄) )  holds
```

R6 subsumes truthfulness: since `S` is consistent with `K_p`, entailment implies
`π_τ(S(x̄))` holds. So there is no separate "don't lie" rule — a player who cannot
prove a relation simply cannot place it.

**R6a — Own side only.** Every cell of `x̄` must be visible to `p` at the time of
placement.

This follows from R6 rather than adding to it — you cannot prove a relation among
cells inside your own fog — but it is worth stating separately because it is cheap to
check and it is also *why a marker is worth sending*. A marker lands where the sender
can see and the receiver cannot, and the receiver has to work out what it implies.

*Implementation note.* Full entailment is expensive. The engine approximates it by
the technique solver: `m` is placeable iff it falls out of `p`'s current propagated
state under the permitted technique tiers. This is sound (anything derived is
entailed) and incomplete (some entailed markers are refused), which is the safe
direction to err.

**R7 — Non-revelation.** For every type `τ` in the palette, of arity `n`, and every
position `i < n`:

```
| { d ∈ D : ∃ v̄ ∈ π_τ with v_i = d } |  ≥  2
```

Every cell the marker touches retains at least two possible digits *when the relation
is considered alone*.

Three things follow, and they matter:

- This is a property of the **type**, not of the board. It is verified once, when the
  palette is defined, and never again at runtime.
- It is **not** a ban on markers resolving cells. A marker landing on a cell already
  reduced to `{3,7}` may well finish it — that is the game working. R7 forbids markers
  that carry a digit *intrinsically*, which is what "never reveal a number" means.
- It makes the earlier "check the conjunction" idea unnecessary and wrong. Conjunctions
  are handled by R8 instead.

**R8 — No covert stacking.** Every `τ ∈ Π` has arity `n ≥ 2`, and the markers touching
any one cell must leave it at least two digits:

```
for each cell x of a proposed marker:
    ⋂ { projection of m at x : m touches x, including the new marker }  ≥ 2 digits
```

where a type's **projection** at a position is the digits R7 leaves possible for that
cell under that relation alone — all nine for a badge or a parity marker, `{1,2,3,4}`
for a `SUM5`, everything but 5 for a `WHISPER`, and so on.

The concern is real. Several relations can hold of the same pair — `CONSECUTIVE` and
`DOUBLE` are both true of 1 and 2 — and each passes R7 on its own. What must never
happen is a pile of individually-harmless markers naming a digit between them.

*(This replaces an earlier flat cap of `k = 2` markers per cell. A count is the wrong
instrument: once markers could be unbounded **paths**, a five-cell whisper line spent
cap on five cells at once, and a perfectly legal badge elsewhere on that line was
refused for a reason no player could see. The intersection rule forbids exactly what
R8 is for and nothing else.)*

Arity ≥ 2 bans unary markers ("this cell is even"), which pass R7 individually but
compose toward a spelled-out digit. Badges survive the cut: a knight badge is drawn on
one cell but its relation ranges over that cell *and its knight-targets*, so its arity
is up to 9.

**R9 — Retraction.** A marker may be retracted only by its placer. Retraction never
restores fog (see R12).

> **Residual channel.** R5–R8 bound the alphabet; they do not eliminate covert
> signalling, since marker choice, placement order and timing all carry bits between
> two people who want to cheat. Caps and a fixed palette limit the bandwidth. Chasing
> more than that is not worth the complexity in a co-op game.

## 5. Marker semantics

Every marker type is a small-arity constraint, so propagation is **generalised arc
consistency**: for each cell in `x̄`, keep the candidates that appear in at least one
satisfying tuple consistent with the others' current candidates.

That single definition covers the whole palette, which is why the palette was
restricted to parameter-free, small, local relations. No marker needs bespoke
propagation code.

The palette is catalogued in [marker-eligibility.md §5](marker-eligibility.md), with
the disequality badges in §4.1.

**Arity is not fixed per type.** A marker may take one cell (a badge), exactly two (a
border relation such as a kropki dot), or an unbounded **path** of cells whose
relation holds of every consecutive pair — a whisper line being the standard case. A
path's steps follow king's moves, so it may run diagonally, and a path is the same
marker read in either direction.

Three classes deserve their formal statement here:

**Badges.** A knight badge on `x` is the relation

```
π_knight(x, k̄) ≡ ⋀_{k ∈ knights(x)} ( digit(k) ≠ digit(x) )
```

over `x` and its up-to-8 knight targets. Anti-king, non-consecutive and
disjoint-group badges follow the same shape over their own neighbourhoods. They are
pure disequalities: their projection onto every cell is all of `D`, so R7 is satisfied
with maximum margin — a badge cannot express a value under any circumstances.

Badge provability under R6 is **geometric**: `p` can prove a knight badge only when
every knight-target of `x` is covered by `K_p` strongly enough to exclude `x`'s digit.
True in the interior of a player's region, false near the fog boundary. The engine
decides this mechanically; a player never has to judge it.

**Generator-placed badges.** The generator may also place badges as *puzzle clues*,
shipped with the grid and visible to both players from the start. These bypass R6
entirely — the generator knows `S`. This is the preferred form, because the generator
can site a badge exactly where its own solve stalled.

## 6. Fog rules

**R10 — Initial fog.** `V_A` and `V_B` are set at generation. This is only the initial
value of a per-cell structure; the engine never assumes a geometry, and no part of it
may depend on the split being any particular shape.

**R10b — Disjoint vision, shared darkness.** No cell is visible to **both** players at
the start. A cell may be visible to `A`, visible to `B`, or fogged for both — never
open to both at once.

Mutual fog is therefore legal and expected. It creates a **no-man's-land**: cells
neither player can see, including any givens hidden there, which both must deduce
from the units crossing it. Far from a degenerate case, this is the sharpest
cooperation pressure the geometry can apply.

**R10c — Grown, not cut.** The starting regions are grown from random seeds, not
sliced along grid lines. A straight split reads as a diagram rather than a fog bank,
and it hands every game the same board.

Generation seeds two cells far apart and grows `V_A` and `V_B` outward one cell at a
time, alternating between players and rejecting any step that would break the growing
player's *fogged* region into pieces. Their visible region stays connected for free,
since it only ever grows by adjacency. Whatever neither player claims becomes the
no-man's-land.

The result satisfies R10a and R10b by construction, varies with every seed, and
produces a ragged coastline instead of a straight edge. A sample:

```
A········      BBB······      AAAAAAAAA
AA··ABBBB      BBBBAA··A      AAAAABBAA
AAA·ABBBB      BBBBBAAAA      ·AAAAABBA
AA··AAABB      BBBBAAAAA      ·AAAABBBA
AAAAAABBB      BBBAAAAAA      ·AAAABBBB
AAAAABBBB      B·AAAAAAA      ·AABABBBB
AAABABBBB      BBBBAAA·A      ·BBBBBBBB
AABBBBBBB      BBBBAAA·A      ·BBBBBBBB
AAAABBBBB      BBBBBB··A      ·······BB
```

The split is not even left/right — seed placement alone gives horizontal, vertical
and diagonal divisions across different puzzles.

Two consequences of R10b worth carrying forward: there is no common ground on which
to ground shared reasoning, so every cross-boundary deduction must be earned; and the
transport design's "designated verifier for overlap cells" is moot, because there are
no overlap cells.

**R10a — Initial connectivity.** At generation, each player's fogged set `F_p` must be
a **single orthogonally connected region**. Scattered fog is rejected.

The reason is legibility: one fog bank reads as "the rest of the board", where
speckled fog reads as noise and gives neither player a contiguous workspace.

This is a *starting* condition only. Once play begins, reveals may punch holes in a
fog bank and connectivity is expected to break — that is a breakthrough, and the
engine must not attempt to preserve R10a during play.

**Vision is connected too.** `V_p` must likewise be a single orthogonally connected
region at generation. The two conditions are not equivalent — revealing a cell deep
inside a fog bank leaves `F_p` connected, since a ring is connected, while `V_p`
gains an isolated island — so the stronger form is asserted explicitly and the
generator's fog search carries it as `requireConnectedVision`, on by default.

**R11 — Reveal graph.** Generation emits `R : C × P → 2^C`, read as: *when `p`
correctly fills `x` on their own board, reveal these cells **to `p`**.*

Fog never lifts for a player because their partner solved something. Each player
unfogs their own board by their own correct placements, so the asymmetry survives the
whole game instead of converging on both players seeing everything — which is what
keeps markers necessary in the endgame rather than only at the start.

Still keyed **per cell, not per solve step**, because players will not solve in the
generator's order. The generator must now prove solvability **once per player**
rather than once for a shared board; two fog states evolving independently is two
obligations, not one.

*(This supersedes an earlier cell-keyed form that revealed to both players. Keying on
the cell alone was simpler and more order-robust, but only under the assumption of a
shared board, which R2 and R4 no longer describe.)*

**R12 — Monotonicity.** Visibility only ever increases. No action restores fog.

Monotonicity buys confluence: since knowledge is monotone and reveals are keyed to
cells rather than to a sequence, the set of cells eventually revealed is a closure and
does not depend on the order placements happen in. This is what makes R11 safe, and it
is the property the randomised replay harness exists to check empirically.

**R12a — Minimal reveals.** The generator reveals the **least** that unblocks the
solve: at each stall it selects the smallest cell set that lets the two-player loop
resume, and does not pad it.

Minimality is a difficulty control and a pacing control at once. Generous reveals
degrade the late game into two people solving alone, which the interleaving metric
(§8) is there to detect; keeping reveals minimal holds both players inside each
other's deductions for longer.

**R13 — Reveal never gives an answer.** Revealing `x` to `p` sets `V_p(x) = VISIBLE`,
which exposes the given digit at `x` **if `x` is a given**, and otherwise merely makes
an empty cell interactive. A reveal never discloses `S(x)` for an unsolved non-given.

## 7. Solvability

The two-player closure. One round:

```
repeat until fixed point:
    for p in [A, B]:
        propagate K_p  from: givens visible to p,
                             all markers and badges on the board,
                             all occupied-and-revealed cells
        apply technique tiers in order, cheapest first
        emit any confirmed placements, in any cell (R2), fogged or not
    apply verdicts and the reveal graph
    for p in [A, B]:
        emit every marker derivable under R6 and expressible in Π
```

A puzzle is **solvable** iff this loop terminates with every cell assigned, using
only techniques from the permitted tier set.

**Epistemic depth: first order only.** `K_p` models what `p` has derived about the
grid. It does **not** model what `p` can infer about `K_q` — "my partner placed that
marker, so they must already know X". Human players will reason that way; the v1
solver does not.

This makes the solver strictly **weaker** than a competent pair, so it will reject
some puzzles that two people could in fact solve. That is the safe direction to be
wrong in, and it matches R6's deliberate incompleteness: everything the solver
certifies is genuinely solvable, and the cost is only some rejected candidates.

**Excluded techniques.** Uniqueness arguments — unique rectangle, unique loop, BUG,
Gurth's symmetrical placement — are **invalid** here and must not appear in the
solver or be credited by the rater. They assume the solver sees the entire clue set;
neither player's view has a unique completion, so the reasoning is unsound rather
than merely hard.

## 8. Difficulty

Three axes, not one:

| Axis | Definition |
|---|---|
| **Technique tier** | the highest tier required, plus the count of steps per tier |
| **Cooperation depth** | the number of loop iterations in which a *marker* was necessary for progress |
| **Interleaving** | the balance and alternation of the two players' contributed steps |

A puzzle where both halves solve independently has cooperation depth 0 and is a bad
puzzle whatever its technique tier. Reject candidates with depth below 3, or where
either player contributes under 30% of the solve steps.

## 9. Checkable invariants

The list the test suite asserts:

1. `S` satisfies R1.
2. The clue set has exactly one solution (DLX, generation-time only — never in the
   rating path).
3. Every `τ ∈ Π` satisfies R7 and has arity ≥ 2 (checked when the palette is defined).
4. Every marker in the generator's par trace satisfies R6 against the placer's state
   at that moment.
5. No reveal violates R13.
5b. Initial fog satisfies R10a: `F_A`, `F_B`, `V_A` and `V_B` are each a single
   orthogonally connected region (flood fill, generation-time only — never asserted
   during play).
5c. Initial fog satisfies R10b: `V_A ∩ V_B = ∅`.
6. Replaying the puzzle under N randomised legal solve orders completes every time
   (order-robustness; `N = 1000`).
7. Difficulty scores are stable across engine changes (golden-file regression).
8. The solver's input type has no field for `S` (§10).
9. Every solve trace validates against the independent, S-blind certificate checker
   (§10).
10. No deduction in any trace carries technique `assumption`, `trial` or `guess`.

## 10. Generator discipline: the S-blindness rule

The tolerance for player cheating in R3 stops at the generator. A puzzle is only
worth shipping if its solvability was **proved by techniques**, and a generator that
consults the solution while proving solvability produces puzzles that are unsolvable
in practice and difficulty ratings that are noise. The failure is silent: one
`if candidate == S[x]` inside a pruning heuristic invalidates an entire bank and
nothing errors.

So the rule is structural, not a matter of care:

**G1 — The solver never receives `S`.** Not "does not read it" — the type it accepts
has no field for it. If the solution is not in scope it cannot be consulted, and the
compiler rechecks this on every future change for free. This is the whole rule; the
rest is corroboration.

**G2 — Deductions carry their justification.** Every `Deduction` records the technique
that produced it and the premises it consumed. A trace is therefore a **proof
certificate**.

**G3 — An independent checker validates every trace.** A separate module, also with no
access to `S`, re-derives each step from its stated premises and the clue set alone
and confirms the conclusion follows. A puzzle ships only if the checker accepts. This
is what makes solvability a verified property rather than a claim by the component
that has every incentive to be optimistic.

**G4 — No bifurcation.** No step may be justified by assumption, trial placement or
contradiction-by-search. Asserted mechanically over the trace, per invariant 10.

**G5 — DLX is quarantined.** The exact-cover solver is required for the uniqueness
check — "does this clue set have exactly one completion?" is a mathematical property
of the clue set, not a claim about human solving — but it must be unreachable from
the rating path. Enforce at the module boundary, not by convention.

**What the generator may still use `S` for.** Everything constructive: choosing
givens, siting badges, authoring the reveal graph, deciding which markers are true
and therefore offerable. The line is between **authoring** and **proving**.
Construction may know the answer. The solvability proof may not.

## 11. Settled elsewhere, and what remains

**Implementation language: TypeScript.** Chosen for one reason beyond the obvious: G1
— "the solver's input type has no field for `S`" — is only an enforceable rule in a
language with a compiler to enforce it. In an untyped engine, S-blindness degrades
into a code-review convention that a single careless heuristic can void silently.
The engine stays DOM-free and Node-runnable so the 1000-puzzle validation sweeps of
invariant 6 can run in CI; Vitest for tests.

**Unary markers: banned**, per R8. The ban is what keeps R7 sufficient on its own.

**Reveal policy: minimal**, per R12a.

**Epistemic depth: first order**, per §7.

### Remaining

**Who referees.** R3 leaves the verdict's location open: soft client-side checking, or
the relay as referee. Settle it with the transport, not the engine — the engine only
needs `S` to exist somewhere trustworthy.

**Does a marker-only two-player loop reach a fixed point on real grids, at useful
cooperation depth?** Not answerable on paper, and the reason the two-player spike
comes before the generator.

---

## Appendix — what changed from standard variant sudoku

The adaptations, in one table, since this is the substance of the project.

| Standard sudoku | Foghorn |
|---|---|
| The solver sees every clue | Each player sees part of the grid; knowledge extends past visibility by deduction |
| You fill cells you can see | You may fill **any** cell you can prove, fogged or not (R2) |
| One grid, one solver | **Two boards** over one solution; both must be finished to win (R4) |
| A clue is placed anywhere by the setter | A marker may only be placed on cells its sender can see (R6a) |
| Clues are fixed at generation | Clues are partly **placed by players during play**, as messages |
| A clue is a statement about the solution | A clue is a statement the placer must be able to **prove** (R6) |
| Any constraint type may appear | Only parameter-free relations of arity ≥ 2 whose per-cell projection is ≥ 2 digits (R7, R8) |
| A puzzle may mix many variant types | At most three marker types per puzzle (R5) |
| Global rules (anti-knight, etc.) hold everywhere | Localised to **per-cell badges**, so the generator can site them where the solve needs them |
| Negative constraints ("all dots are given") are common | Unusable — no player can assert absence about fogged cells |
| Free numeric parameters (cage totals) are common | Banned — a chooseable number is a covert channel and a reveal at the extremes |
| Uniqueness techniques are valid | **Invalid** — no player's view has a unique completion |
| Difficulty is one axis | Three axes: technique tier, cooperation depth, interleaving |
| Solving order is the solver's business | Order-robustness is a **generator obligation**, proven by randomised replay |
