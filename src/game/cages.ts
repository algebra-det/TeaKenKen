/**
 * Cage construction: carving the grid into connected regions and giving each
 * one an arithmetic clue consistent with the hidden solution.
 *
 * @format
 */

/* eslint-disable no-bitwise -- `| 0` is integer truncation for index maths. */

import {effectiveMaxCageSize, type DifficultyConfig} from './difficulty';
import {randInt, shuffled, weightedPick, type Rng} from './random';
import type {Cage, Operation} from './types';

export function neighborsOf(index: number, size: number): number[] {
  const row = (index / size) | 0;
  const col = index % size;
  const out: number[] = [];
  if (row > 0) {
    out.push(index - size);
  }
  if (row < size - 1) {
    out.push(index + size);
  }
  if (col > 0) {
    out.push(index - 1);
  }
  if (col < size - 1) {
    out.push(index + 1);
  }
  return out;
}

/**
 * Partitions the grid into orthogonally-connected cages.
 *
 * Cages are grown one at a time from a random unclaimed seed cell, absorbing
 * random unclaimed neighbours until they hit their target size or run out of
 * room. Growth strands the occasional cell as a forced singleton, so a cleanup
 * pass merges surplus singletons back into a small neighbour to keep the
 * freebie count inside the difficulty's budget.
 *
 * @returns Cage membership as an array of cell-index groups.
 */
export function partitionIntoCages(
  size: number,
  rng: Rng,
  config: DifficultyConfig,
): number[][] {
  const cellCount = size * size;
  const maxSize = effectiveMaxCageSize(config, size);
  const owner = new Array<number>(cellCount).fill(-1);
  let nextId = 0;

  for (const seed of shuffled(
    rng,
    Array.from({length: cellCount}, (_, i) => i),
  )) {
    if (owner[seed] !== -1) {
      continue;
    }
    const id = nextId++;
    const targetSize = pickCageSize(rng, config, maxSize);
    owner[seed] = id;
    let claimed = 1;

    const frontier = neighborsOf(seed, size).filter(n => owner[n] === -1);
    while (claimed < targetSize && frontier.length > 0) {
      const pick = randInt(rng, frontier.length);
      const cell = frontier[pick];
      frontier.splice(pick, 1);
      if (owner[cell] !== -1) {
        continue;
      }
      owner[cell] = id;
      claimed++;
      for (const n of neighborsOf(cell, size)) {
        if (owner[n] === -1) {
          frontier.push(n);
        }
      }
    }
  }

  mergeSurplusSingletons(owner, size, rng, config, maxSize);
  return regroup(owner);
}

function pickCageSize(
  rng: Rng,
  config: DifficultyConfig,
  maxSize: number,
): number {
  const weights = config.sizeWeights.slice(0, maxSize);
  return weightedPick(rng, weights) + 1;
}

function mergeSurplusSingletons(
  owner: number[],
  size: number,
  rng: Rng,
  config: DifficultyConfig,
  maxSize: number,
): void {
  const counts = new Map<number, number>();
  for (const id of owner) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const singletons = shuffled(
    rng,
    [...counts.entries()].filter(([, n]) => n === 1).map(([id]) => id),
  );
  const allowed = Math.floor(counts.size * config.singleBudgetRatio);
  let liveSingles = singletons.length;

  for (const id of singletons) {
    if (liveSingles <= allowed) {
      break;
    }
    // `singletons` is a snapshot, and a singleton can itself have absorbed an
    // earlier merge. Re-check the live count: relocating a cell out of a cage
    // that now has several would split it, since the lowest-index cell is not
    // necessarily a leaf. Only ever move a cage that is still a single cell,
    // which keeps every cage orthogonally connected by construction.
    if (counts.get(id) !== 1) {
      continue;
    }
    const cell = owner.indexOf(id);
    if (cell === -1) {
      continue;
    }

    // Prefer the smallest neighbouring cage so cages stay evenly sized.
    let bestId = -1;
    let bestCount = Infinity;
    for (const n of neighborsOf(cell, size)) {
      const nid = owner[n];
      const nCount = counts.get(nid) ?? 0;
      if (nid !== id && nCount + 1 <= maxSize && nCount < bestCount) {
        bestId = nid;
        bestCount = nCount;
      }
    }
    if (bestId === -1) {
      continue;
    }

    owner[cell] = bestId;
    counts.set(bestId, bestCount + 1);
    counts.delete(id);

    liveSingles--;
    if (bestCount === 1) {
      // The absorbing cage was a singleton too, so the pool shrank by two.
      liveSingles--;
    }
  }
}

/** Collapses sparse owner ids into dense, ascending cage groups. */
function regroup(owner: number[]): number[][] {
  const byId = new Map<number, number[]>();
  for (let cell = 0; cell < owner.length; cell++) {
    const id = owner[cell];
    const group = byId.get(id);
    if (group) {
      group.push(cell);
    } else {
      byId.set(id, [cell]);
    }
  }
  return [...byId.values()].sort((a, b) => a[0] - b[0]);
}

/**
 * Attaches a clue to a cage by reading its digits out of the solution and
 * choosing an operation that reproduces them.
 *
 * Subtraction and division only apply to two-cell cages, matching standard
 * KenKen. A zero-target subtraction (equal digits on a diagonal) is skipped
 * because it reads as a degenerate clue.
 */
export function makeCage(
  id: number,
  cells: number[],
  solution: number[],
  rng: Rng,
  config: DifficultyConfig,
): Cage {
  const sorted = [...cells].sort((a, b) => a - b);
  const values = sorted.map(cell => solution[cell]);
  const anchor = sorted[0];

  if (sorted.length === 1) {
    return {id, cells: sorted, anchor, target: values[0], operation: '='};
  }

  const weights =
    sorted.length === 2 ? config.pairOpWeights : config.groupOpWeights;
  const candidates: {operation: Operation; target: number; weight: number}[] = [
    {
      operation: '+',
      target: values.reduce((a, b) => a + b, 0),
      weight: weights['+'],
    },
    {
      operation: '×',
      target: values.reduce((a, b) => a * b, 1),
      weight: weights['×'],
    },
  ];

  if (sorted.length === 2) {
    const hi = Math.max(values[0], values[1]);
    const lo = Math.min(values[0], values[1]);
    if (hi - lo > 0) {
      candidates.push({operation: '-', target: hi - lo, weight: weights['-']});
    }
    if (hi % lo === 0) {
      candidates.push({operation: '÷', target: hi / lo, weight: weights['÷']});
    }
  }

  const preferred = candidates.filter(c => c.weight > 0);
  const pool = preferred.length > 0 ? preferred : candidates;
  const chosen = pool[weightedPick(rng, pool.map(c => c.weight))];

  return {
    id,
    cells: sorted,
    anchor,
    target: chosen.target,
    operation: chosen.operation,
  };
}
