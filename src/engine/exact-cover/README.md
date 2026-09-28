# Quarantine

This directory holds the brute-force exact-cover solver. It is subject to **G5**
in [docs/rules.md](../../../docs/rules.md#10-generator-discipline-the-s-blindness-rule):

> The exact-cover solver is required for the uniqueness check — "does this clue set
> have exactly one completion?" is a mathematical property of the clue set, not a
> claim about human solving — but it must be unreachable from the rating path.
> Enforce at the module boundary, not by convention.

**Nothing under `src/engine/techniques/`, and neither `solver.ts` nor `rate.ts`, may
import from here.** `quarantine.test.ts` fails the build if they do.

Legitimate callers are the generator (authoring) and tests. If you find yourself
wanting brute force while proving a puzzle solvable, the answer is that the puzzle is
not solvable by techniques and should be rejected.
