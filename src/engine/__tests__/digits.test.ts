import { describe, expect, it } from "vitest";
import {
  ALL,
  DIGITS,
  type Digit,
  bit,
  count,
  digitsOf,
  formatMask,
  has,
  isSubset,
  lowestDigit,
  maskOf,
  soleDigit,
  without,
} from "../digits.js";

describe("digit masks", () => {
  it("round-trips every digit", () => {
    for (const d of DIGITS) {
      expect(has(bit(d), d)).toBe(true);
      expect(soleDigit(bit(d))).toBe(d);
      expect(count(bit(d))).toBe(1);
    }
  });

  it("ALL holds exactly the nine digits", () => {
    expect(count(ALL)).toBe(9);
    expect(digitsOf(ALL)).toEqual([...DIGITS]);
  });

  it("counts every possible mask correctly", () => {
    for (let m = 0; m <= ALL; m++) {
      expect(count(m)).toBe(digitsOf(m).length);
    }
  });

  it("reports a sole digit only for singletons", () => {
    expect(soleDigit(0)).toBeNull();
    expect(soleDigit(maskOf([3, 7]))).toBeNull();
    expect(soleDigit(maskOf([4]))).toBe(4);
  });

  it("finds the lowest digit", () => {
    expect(lowestDigit(maskOf([9, 4, 6]))).toBe(4);
    expect(lowestDigit(0)).toBeNull();
  });

  it("removes digits", () => {
    const m = maskOf([1, 5, 9]);
    expect(digitsOf(without(m, 5))).toEqual([1, 9]);
    expect(without(m, 3)).toBe(m);
  });

  it("recognises subsets", () => {
    expect(isSubset(maskOf([2, 3]), maskOf([1, 2, 3]))).toBe(true);
    expect(isSubset(maskOf([2, 4]), maskOf([1, 2, 3]))).toBe(false);
    expect(isSubset(0, maskOf([1]))).toBe(true);
  });

  it("formats readably", () => {
    expect(formatMask(maskOf([1, 4, 9] as Digit[]))).toBe("149");
    expect(formatMask(0)).toBe("-");
  });
});
