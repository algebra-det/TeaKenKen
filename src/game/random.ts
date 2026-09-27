/**
 * Seeded pseudo-random number generation.
 *
 * Puzzles are generated from an explicit seed so a given (size, difficulty,
 * seed) triple always reproduces the same board.
 *
 * @format
 */

/* eslint-disable no-bitwise -- mulberry32 is defined in terms of 32-bit integer ops. */

export type Rng = () => number;

/** mulberry32 — small, fast, good enough statistical quality for puzzles. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function range(n: number): number[] {
  return Array.from({length: n}, (_, i) => i);
}

export function shuffleInPlace<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function shuffled<T>(rng: Rng, arr: readonly T[]): T[] {
  return shuffleInPlace(rng, [...arr]);
}

/**
 * Picks an index proportional to its weight. Falls back to a uniform pick when
 * every weight is zero so callers never have to special-case empty pools.
 */
export function weightedPick(rng: Rng, weights: number[]): number {
  let total = 0;
  for (const w of weights) {
    total += Math.max(0, w);
  }
  if (total <= 0) {
    return randInt(rng, weights.length);
  }
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= Math.max(0, weights[i]);
    if (roll < 0) {
      return i;
    }
  }
  return weights.length - 1;
}
