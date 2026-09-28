/** Tier 1 — the two ways a digit becomes forced without any pattern. */

import { DIGITS, type Digit, type Mask, count, soleDigit } from "../digits.js";
import { UNITS, formatCell } from "../units.js";
import type { Deduction, SolveState, Technique } from "./types.js";
import { placesFor } from "./util.js";

/** A cell with one candidate left. */
export const nakedSingle: Technique = {
  id: "naked-single",
  name: "Naked single",
  tier: 1,

  find(state) {
    const out: Deduction[] = [];
    for (let cell = 0; cell < state.grid.cand.length; cell++) {
      if (state.placed[cell] === 1) continue;
      const digit = soleDigit(state.grid.cand[cell] as Mask);
      if (digit === null) continue;
      out.push({
        technique: this.id,
        tier: this.tier,
        pattern: [cell],
        digits: [digit],
        units: [],
        placements: [{ cell, digit }],
        eliminations: [],
        description: `${formatCell(cell)} has only ${digit} left`,
      });
    }
    return out;
  },

  verify(state, d) {
    const cell = d.pattern[0];
    const placement = d.placements[0];
    if (cell === undefined || placement === undefined) return false;
    if (d.pattern.length !== 1 || d.placements.length !== 1) return false;
    if (placement.cell !== cell) return false;
    if (state.placed[cell] === 1) return false;
    return soleDigit(state.grid.cand[cell] as Mask) === placement.digit;
  },
};

/** A digit with one place left in some unit. */
export const hiddenSingle: Technique = {
  id: "hidden-single",
  name: "Hidden single",
  tier: 1,

  find(state) {
    const out: Deduction[] = [];
    for (const unit of UNITS) {
      for (const digit of DIGITS) {
        const places = placesFor(state, unit, digit);
        if (places.length !== 1) continue;
        const cell = places[0] as number;
        if (state.placed[cell] === 1) continue;
        if (count(state.grid.cand[cell] as Mask) === 1) continue; // naked single's job
        out.push({
          technique: this.id,
          tier: this.tier,
          pattern: [cell],
          digits: [digit],
          units: [unit.index],
          placements: [{ cell, digit }],
          eliminations: [],
          description: `${digit} fits only ${formatCell(cell)} in ${unit.kind} ${unit.ordinal + 1}`,
        });
      }
    }
    return out;
  },

  verify(state, d) {
    const unitIndex = d.units[0];
    const placement = d.placements[0];
    if (unitIndex === undefined || placement === undefined) return false;
    if (d.units.length !== 1 || d.placements.length !== 1) return false;
    const unit = UNITS[unitIndex];
    if (!unit) return false;
    if (state.placed[placement.cell] === 1) return false;
    const places = placesFor(state, unit, placement.digit);
    return places.length === 1 && places[0] === placement.cell;
  },
};

export const singles: readonly Technique[] = [nakedSingle, hiddenSingle];
