# Foghorn

Two-player co-op sudoku played through fog. You each see half the grid and can signal, but never speak.

## Design

The rules are specified before the code. Read them in this order:

| Document | What it holds |
|---|---|
| [docs/rules.md](docs/rules.md) | **The specification.** Objects, the thirteen rules, generator discipline. Where anything disagrees with another document, this one wins. |
| [docs/marker-eligibility.md](docs/marker-eligibility.md) | Which sudoku variants can serve as player markers, which cannot, and why |
| [docs/metas.md](docs/metas.md) | Solving techniques by variant — the deductions the engine implements |
| [docs/variants.md](docs/variants.md) | Catalogue of variant constraints |

## Engine

Pure TypeScript, no DOM, runnable under Node so validation sweeps run in CI.

```
src/engine/
  digits.ts         9-bit candidate masks
  units.ts          precomputed geometry; the grid is always 9x9
  grid.ts           Uint16Array(81) state
  rng.ts            seeded, so any failure replays from its seed
  generate.ts       random solutions, uniqueness-preserving clue carving
  solver.ts         technique solver — never receives the solution
  certificate.ts    independent re-check of a solve trace
  rate.ts           difficulty from the solve trace
  techniques/       one module per tier
  exact-cover/      QUARANTINED brute force, uniqueness checking only
```

Two rules from the spec are enforced mechanically rather than by convention:

- **G1** — the solver's input type has no field for the solution, so no technique
  can consult it even by accident.
- **G5** — `quarantine.test.ts` fails the build if anything outside the allowlist
  imports the brute-force solver.

```sh
npm test          # unit tests and invariants
npm run typecheck
npm run stats     # sample generated puzzles and report difficulty
```

### Where it is

M0 and M1 are done: grids generate, uniqueness is checked, and puzzles are solved
and rated by technique. Tiers 1-4 are implemented (singles, locked candidates,
subsets, basic fish); tiers 5+ (chains, wings, ALS) are not, so roughly a third of
minimal puzzles come back `unrated` rather than guessed at.

The hot-seat UI runs the fog, the two boards and a marker palette drawn per
puzzle. Eleven marker types are implemented — consecutive, double, sum 5, sum
10, whisper, greater-than, same and opposite parity, and the knight, king and
no-neighbours badges. The rest of the catalogue in
[marker-eligibility.md §5](docs/marker-eligibility.md) (renban, thermo, between,
zipper, entropic groups, shared sets, arrows) needs multi-cell line rendering
and is not built yet.

Next: the two-player spike — hardcoded split, three markers, no generation — to
find out whether a marker-only solve loop reaches a fixed point at useful
cooperation depth.

The game's underlying systems and board generator are original, while the user interface was developed with the assistance of AI-based tools.
