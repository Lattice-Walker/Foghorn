/**
 * Sample generated puzzles and report what the technique registry makes of them.
 *
 * Run: node --experimental-strip-types src/tools/stats.ts [count]
 */

import { carve, clueCount, randomSolution } from "../engine/generate.js";
import { makeRng } from "../engine/rng.js";
import { rate } from "../engine/rate.js";
import { checkCertificate } from "../engine/certificate.js";
import { solve } from "../engine/solver.js";

const count = Number(process.argv[2] ?? 200);

const labels = new Map<string, number>();
const tiers = new Map<number, number>();
const techniques = new Map<string, number>();
const outcomes = new Map<string, number>();
let clues = 0;
let steps = 0;
let certified = 0;

const started = Date.now();

for (let i = 0; i < count; i++) {
  const rng = makeRng(`stats-${i}`);
  const puzzle = carve(randomSolution(rng), rng);
  const difficulty = rate(puzzle);
  const { trace } = solve(puzzle);

  clues += clueCount(puzzle);
  steps += difficulty.steps;
  labels.set(difficulty.label, (labels.get(difficulty.label) ?? 0) + 1);
  outcomes.set(difficulty.outcome, (outcomes.get(difficulty.outcome) ?? 0) + 1);
  if (difficulty.solved) {
    tiers.set(difficulty.maxTier, (tiers.get(difficulty.maxTier) ?? 0) + 1);
  }
  for (const [id, n] of difficulty.perTechnique) {
    techniques.set(id, (techniques.get(id) ?? 0) + n);
  }
  if (checkCertificate(puzzle, trace).valid) certified++;
}

const pct = (n: number) => `${((100 * n) / count).toFixed(1)}%`;
const sorted = <K>(m: Map<K, number>) => [...m].sort((a, b) => b[1] - a[1]);

console.log(`${count} puzzles in ${Date.now() - started}ms`);
console.log(`average clues: ${(clues / count).toFixed(1)}`);
console.log(`average steps: ${(steps / count).toFixed(1)}`);
console.log(`certificates valid: ${certified}/${count}`);
console.log("\noutcome:");
for (const [k, n] of sorted(outcomes)) console.log(`  ${k.padEnd(14)} ${pct(n)}`);
console.log("\nlabel:");
for (const [k, n] of sorted(labels)) console.log(`  ${k.padEnd(14)} ${pct(n)}`);
console.log("\nhighest tier needed (solved only):");
for (const [k, n] of [...tiers].sort((a, b) => a[0] - b[0])) {
  console.log(`  tier ${k}        ${pct(n)}`);
}
console.log("\ntechnique usage (total steps):");
for (const [k, n] of sorted(techniques)) console.log(`  ${k.padEnd(16)} ${n}`);
