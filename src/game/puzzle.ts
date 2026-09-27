/**
 * Puzzle generation: ties the Latin square, cage carving, clue assignment and
 * uniqueness check into a single entry point.
 *
 * @format
 */

import {makeCage, partitionIntoCages} from './cages';
import {DIFFICULTY_CONFIG} from './difficulty';
import {generateLatinSquare} from './latinSquare';
import {createRng, randomSeed} from './random';
import {countSolutions} from './solver';
import type {Cage, Difficulty, Puzzle} from './types';

const MAX_ATTEMPTS = 80;
const TIME_BUDGET_MS = 2_500;

/**
 * Generates a playable puzzle for the given grid size and difficulty.
 *
 * Cage layouts are re-rolled against a fixed solution until one yields a
 * uniquely-solvable board. Both the attempt count and the wall-clock budget
 * are bounded: on large hard grids a provably-unique layout may not turn up in
 * time, so the first valid attempt is returned instead. Such a board is still
 * fully playable because the UI judges the player against the KenKen rules
 * rather than against this stored solution.
 */
export function generatePuzzle(
  size: number,
  difficulty: Difficulty,
  seed: number = randomSeed(),
): Puzzle {
  const rng = createRng(seed);
  const config = DIFFICULTY_CONFIG[difficulty];
  const solution = generateLatinSquare(size, rng);
  const deadline = Date.now() + TIME_BUDGET_MS;

  let fallback: Puzzle | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const groups = partitionIntoCages(size, rng, config);
    const cages = groups.map((cells, id) =>
      makeCage(id, cells, solution, rng, config),
    );
    const candidate: Puzzle = {
      size,
      difficulty,
      seed,
      solution,
      cages,
      cageOfCell: buildCageOfCell(size, cages),
      uniquenessVerified: false,
    };

    const {count, exhausted} = countSolutions(candidate, 2);
    if (!exhausted && count === 1) {
      return {...candidate, uniquenessVerified: true};
    }

    fallback ??= candidate;
    if (Date.now() > deadline) {
      break;
    }
  }

  return fallback ?? emptyPuzzle(size, difficulty, seed, solution);
}

function buildCageOfCell(size: number, cages: Cage[]): number[] {
  const map = new Array<number>(size * size).fill(0);
  for (const cage of cages) {
    for (const cell of cage.cells) {
      map[cell] = cage.id;
    }
  }
  return map;
}

/** Unreachable in practice; keeps the return type honest without a cast. */
function emptyPuzzle(
  size: number,
  difficulty: Difficulty,
  seed: number,
  solution: number[],
): Puzzle {
  const cages: Cage[] = solution.map((value, cell) => ({
    id: cell,
    cells: [cell],
    anchor: cell,
    target: value,
    operation: '=' as const,
  }));
  return {
    size,
    difficulty,
    seed,
    solution,
    cages,
    cageOfCell: buildCageOfCell(size, cages),
    uniquenessVerified: true,
  };
}
