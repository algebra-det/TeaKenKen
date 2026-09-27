/**
 * Difficulty tuning.
 *
 * Difficulty in KenKen is driven mostly by cage geometry rather than by the
 * arithmetic itself: bigger cages leave more combinations open, and fewer
 * single-cell "freebie" cages means fewer free starting digits. Operation
 * weights add a second dial — multiplication over a 3-4 cell cage is much
 * harder to unpick than a two-cell subtraction.
 *
 * @format
 */

import type {Difficulty, Operation} from './types';

export type OperationWeights = Record<Operation, number>;

export interface DifficultyConfig {
  label: string;
  blurb: string;
  /** Relative likelihood of cage sizes 1, 2, 3 and 4 respectively. */
  sizeWeights: number[];
  maxCageSize: number;
  /** Ceiling on the share of cages allowed to be single-cell freebies. */
  singleBudgetRatio: number;
  pairOpWeights: OperationWeights;
  groupOpWeights: OperationWeights;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Easy',
    blurb:
      'Lots of small cages and several free digits. The gentlest way to learn the rules.',
    sizeWeights: [18, 55, 27, 0],
    maxCageSize: 3,
    singleBudgetRatio: 0.22,
    pairOpWeights: {'+': 5, '-': 5, '÷': 3, '×': 2, '=': 0},
    groupOpWeights: {'+': 6, '×': 1, '-': 0, '÷': 0, '=': 0},
  },
  medium: {
    label: 'Medium',
    blurb:
      'Mixed cage sizes, all four operations, and only the occasional free digit.',
    sizeWeights: [7, 40, 38, 15],
    maxCageSize: 4,
    singleBudgetRatio: 0.09,
    pairOpWeights: {'+': 3, '-': 3, '÷': 3, '×': 3, '=': 0},
    groupOpWeights: {'+': 3, '×': 2, '-': 0, '÷': 0, '=': 0},
  },
  hard: {
    label: 'Hard',
    blurb:
      'Large cages, almost no free digits, and multiplication-heavy clues. Bring a plan.',
    sizeWeights: [2, 24, 40, 34],
    maxCageSize: 4,
    singleBudgetRatio: 0.03,
    pairOpWeights: {'+': 2, '-': 2, '÷': 3, '×': 4, '=': 0},
    groupOpWeights: {'+': 2, '×': 3, '-': 0, '÷': 0, '=': 0},
  },
};

/** A cage can never be larger than the grid is wide, which matters at 3×3. */
export function effectiveMaxCageSize(
  config: DifficultyConfig,
  size: number,
): number {
  return Math.max(1, Math.min(config.maxCageSize, size));
}
