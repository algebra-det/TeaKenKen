/**
 * Rule checking for a board in progress.
 *
 * The player is judged against the KenKen rules rather than against the
 * generator's stored solution, so any legitimately valid fill is accepted.
 *
 * @format
 */

import type {Cage, Puzzle} from './types';

export type CageState = 'empty' | 'partial' | 'satisfied' | 'violated';

/**
 * Flags every cell whose digit is duplicated within its row or column.
 *
 * @param values Flat board, `0` meaning empty.
 */
export function computeConflicts(values: number[], size: number): boolean[] {
  const conflicts = new Array<boolean>(values.length).fill(false);

  const markLine = (cells: number[]) => {
    const seen = new Map<number, number[]>();
    for (const cell of cells) {
      const value = values[cell];
      if (value === 0) {
        continue;
      }
      const bucket = seen.get(value);
      if (bucket) {
        bucket.push(cell);
      } else {
        seen.set(value, [cell]);
      }
    }
    for (const bucket of seen.values()) {
      if (bucket.length > 1) {
        for (const cell of bucket) {
          conflicts[cell] = true;
        }
      }
    }
  };

  for (let i = 0; i < size; i++) {
    markLine(Array.from({length: size}, (_, j) => i * size + j));
    markLine(Array.from({length: size}, (_, j) => j * size + i));
  }
  return conflicts;
}

/**
 * Reports how a cage is doing. A cage only turns `violated` once it is fully
 * filled, so partial work is never prematurely flagged as wrong.
 */
export function evaluateCage(cage: Cage, values: number[]): CageState {
  const digits = cage.cells.map(cell => values[cell]);
  const filled = digits.filter(v => v > 0);

  if (filled.length === 0) {
    return 'empty';
  }
  if (filled.length < digits.length) {
    return 'partial';
  }

  const hi = Math.max(...filled);
  const lo = Math.min(...filled);

  switch (cage.operation) {
    case '=':
      return filled[0] === cage.target ? 'satisfied' : 'violated';
    case '+':
      return filled.reduce((a, b) => a + b, 0) === cage.target
        ? 'satisfied'
        : 'violated';
    case '×':
      return filled.reduce((a, b) => a * b, 1) === cage.target
        ? 'satisfied'
        : 'violated';
    case '-':
      return hi - lo === cage.target ? 'satisfied' : 'violated';
    case '÷':
      return lo > 0 && hi % lo === 0 && hi / lo === cage.target
        ? 'satisfied'
        : 'violated';
    default:
      return 'violated';
  }
}

export function isSolved(puzzle: Puzzle, values: number[]): boolean {
  if (values.some(v => v === 0)) {
    return false;
  }
  if (computeConflicts(values, puzzle.size).some(Boolean)) {
    return false;
  }
  return puzzle.cages.every(cage => evaluateCage(cage, values) === 'satisfied');
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
