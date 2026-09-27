/**
 * Core domain types for the KenKen puzzle engine.
 *
 * A KenKen puzzle is a Latin square (each digit 1..n appears exactly once per
 * row and column) partitioned into "cages". Each cage carries an arithmetic
 * clue: a target value and an operation that the cage's digits must produce.
 *
 * @format
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

/** `'='` marks a single-cell cage (a freebie: the digit is given outright). */
export type Operation = '+' | '-' | '×' | '÷' | '=';

export interface Cage {
  id: number;
  /** Flat cell indices (row * size + col), ascending. */
  cells: number[];
  /** Top-left-most cell; where the clue label is drawn. */
  anchor: number;
  target: number;
  operation: Operation;
}

export interface Puzzle {
  size: number;
  difficulty: Difficulty;
  seed: number;
  /** Flat grid of length size*size holding the generator's solution. */
  solution: number[];
  cages: Cage[];
  /** Flat map from cell index to the id of the cage that owns it. */
  cageOfCell: number[];
  /**
   * True when the solver proved exactly one solution exists. Large/hard grids
   * can exceed the search budget, in which case this is false and the puzzle
   * is still playable — the UI validates against the rules, not this solution.
   */
  uniquenessVerified: boolean;
}

export const GRID_SIZES = [3, 4, 5, 6, 7, 8, 9] as const;

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** Renders a cage clue the way KenKen conventionally prints it, e.g. `12×`. */
export function cageLabel(cage: Cage): string {
  return cage.operation === '='
    ? String(cage.target)
    : `${cage.target}${cage.operation}`;
}
