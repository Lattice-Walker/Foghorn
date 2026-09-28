/**
 * Independent verification of a solve trace — docs/rules.md G3.
 *
 * This module replays a trace against the clue set and re-establishes every
 * deduction's pattern using only each technique's `verify`, never its `find`.
 * A trace that passes here is a proof that the puzzle is solvable by techniques,
 * checked by something other than the component that produced it — which is the
 * whole point, since the generator has every incentive to be optimistic.
 *
 * Like the solver, it never sees the solution.
 */

import type { Values } from "./grid.js";
import { BY_ID } from "./techniques/index.js";
import type { Deduction } from "./techniques/types.js";
import { applyDeduction, createState, isComplete } from "./solver.js";

export interface CertificateFailure {
  readonly step: number;
  readonly technique: string;
  readonly reason:
    | "unknown-technique"
    | "pattern-not-present"
    | "tier-mismatch"
    | "contradiction"
    | "no-effect";
}

export interface CertificateResult {
  readonly valid: boolean;
  /** True when the trace also finishes the grid. */
  readonly complete: boolean;
  readonly steps: number;
  readonly failure: CertificateFailure | null;
}

export function checkCertificate(
  values: Values,
  trace: readonly Deduction[],
): CertificateResult {
  const state = createState(values);
  if (!state) {
    return {
      valid: false,
      complete: false,
      steps: 0,
      failure: { step: -1, technique: "", reason: "pattern-not-present" },
    };
  }

  const fail = (step: number, d: Deduction, reason: CertificateFailure["reason"]) => ({
    valid: false as const,
    complete: false,
    steps: step,
    failure: { step, technique: d.technique, reason },
  });

  for (let step = 0; step < trace.length; step++) {
    const d = trace[step] as Deduction;
    const technique = BY_ID.get(d.technique);
    if (!technique) return fail(step, d, "unknown-technique");
    if (technique.tier !== d.tier) return fail(step, d, "tier-mismatch");

    // Re-establish the pattern from the state alone.
    if (!technique.verify(state, d)) return fail(step, d, "pattern-not-present");

    // A deduction that changes nothing is not wrong, but it pads a trace and
    // would inflate the difficulty score, so the certificate rejects it.
    const before = state.grid.cand.join(",");
    if (!applyDeduction(state, d)) return fail(step, d, "contradiction");
    if (state.grid.cand.join(",") === before && d.placements.length === 0) {
      return fail(step, d, "no-effect");
    }
  }

  return {
    valid: true,
    complete: isComplete(state),
    steps: trace.length,
    failure: null,
  };
}
