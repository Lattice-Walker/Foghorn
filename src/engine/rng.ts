/**
 * Seeded PRNG, so every generated puzzle is reproducible from its seed.
 *
 * Reproducibility is not a nicety here: the validation sweeps replay puzzles
 * thousands of times, and a failure that cannot be replayed cannot be debugged.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): void;
  pick<T>(items: readonly T[]): T;
}

function hashSeed(seed: number | string): number {
  if (typeof seed === "number") return seed >>> 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for puzzle generation. */
export function makeRng(seed: number | string): Rng {
  let a = hashSeed(seed);
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => Math.floor(next() * n);
  return {
    next,
    int,
    shuffle<T>(items: T[]): void {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const tmp = items[i] as T;
        items[i] = items[j] as T;
        items[j] = tmp;
      }
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("pick from empty list");
      return items[int(items.length)] as T;
    },
  };
}
