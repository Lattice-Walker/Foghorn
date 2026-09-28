/**
 * Digits as 9-bit masks.
 *
 * A cell's candidate set is a number whose bit `d - 1` is set when digit `d` is
 * still possible. The whole engine runs on these, which is what lets grid state
 * live in a `Uint16Array(81)`.
 */

/** The grid is always 9x9, so digits are always 1-9. See docs/rules.md §1. */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** A set of digits, one bit per digit. */
export type Mask = number;

export const DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Every digit possible. */
export const ALL: Mask = 0b1_1111_1111;
export const NONE: Mask = 0;

export function bit(d: Digit): Mask {
  return 1 << (d - 1);
}

export function has(m: Mask, d: Digit): boolean {
  return (m & bit(d)) !== 0;
}

export function without(m: Mask, d: Digit): Mask {
  return m & ~bit(d);
}

export function union(a: Mask, b: Mask): Mask {
  return a | b;
}

export function intersect(a: Mask, b: Mask): Mask {
  return a & b;
}

/** Is every digit of `sub` also in `sup`? */
export function isSubset(sub: Mask, sup: Mask): boolean {
  return (sub & ~sup) === 0;
}

const POPCOUNT: Uint8Array = (() => {
  const t = new Uint8Array(ALL + 1);
  for (let m = 1; m <= ALL; m++) t[m] = (t[m >> 1] as number) + (m & 1);
  return t;
})();

/** How many digits are still possible. */
export function count(m: Mask): number {
  return POPCOUNT[m] as number;
}

/** The single digit in a mask of size one, else null. */
export function soleDigit(m: Mask): Digit | null {
  if (m === 0 || (m & (m - 1)) !== 0) return null;
  return (31 - Math.clz32(m) + 1) as Digit;
}

/** The lowest digit present, else null. */
export function lowestDigit(m: Mask): Digit | null {
  if (m === 0) return null;
  return (31 - Math.clz32(m & -m) + 1) as Digit;
}

export function digitsOf(m: Mask): Digit[] {
  const out: Digit[] = [];
  for (const d of DIGITS) if (has(m, d)) out.push(d);
  return out;
}

export function maskOf(ds: Iterable<Digit>): Mask {
  let m = NONE;
  for (const d of ds) m |= bit(d);
  return m;
}

export function formatMask(m: Mask): string {
  return digitsOf(m).join("") || "-";
}
