/**
 * Latin square generation — the hidden solution beneath every KenKen board.
 *
 * @format
 */

/* eslint-disable no-bitwise -- row/column candidate sets are bitmasks. */

import {randInt, shuffleInPlace, type Rng} from './random';

/**
 * Builds a random n×n Latin square via randomised backtracking.
 *
 * Trying candidate digits in shuffled order gives far more structural variety
 * than permuting a cyclic base square, which leaves visible diagonal banding
 * that can make the puzzle easier to crack than intended. For n <= 9 the
 * search backtracks rarely and completes in well under a millisecond.
 */
export function generateLatinSquare(size: number, rng: Rng): number[] {
  const cellCount = size * size;
  const grid = new Array<number>(cellCount).fill(0);
  const rowMask = new Array<number>(size).fill(0);
  const colMask = new Array<number>(size).fill(0);

  const fill = (index: number): boolean => {
    if (index === cellCount) {
      return true;
    }
    const row = (index / size) | 0;
    const col = index % size;
    const used = rowMask[row] | colMask[col];

    const candidates: number[] = [];
    for (let value = 1; value <= size; value++) {
      if ((used & (1 << value)) === 0) {
        candidates.push(value);
      }
    }
    shuffleInPlace(rng, candidates);

    for (const value of candidates) {
      const bit = 1 << value;
      grid[index] = value;
      rowMask[row] |= bit;
      colMask[col] |= bit;

      if (fill(index + 1)) {
        return true;
      }

      grid[index] = 0;
      rowMask[row] &= ~bit;
      colMask[col] &= ~bit;
    }
    return false;
  };

  // Randomised backtracking on a Latin square always succeeds, but guard the
  // pathological case rather than returning a half-filled grid.
  for (let attempt = 0; attempt < 8; attempt++) {
    if (fill(0)) {
      return grid;
    }
  }
  return cyclicFallback(size, rng);
}

/** Deterministic safety net: a shuffled cyclic square is always valid. */
function cyclicFallback(size: number, rng: Rng): number[] {
  const rows = shuffleInPlace(
    rng,
    Array.from({length: size}, (_, i) => i),
  );
  const cols = shuffleInPlace(
    rng,
    Array.from({length: size}, (_, i) => i),
  );
  const symbols = shuffleInPlace(
    rng,
    Array.from({length: size}, (_, i) => i),
  );
  const grid = new Array<number>(size * size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      grid[r * size + c] = symbols[(rows[r] + cols[c]) % size] + 1;
    }
  }
  // Touch randInt so the fallback still consumes the stream predictably.
  randInt(rng, 1);
  return grid;
}
