/**
 * Session persistence.
 *
 * Three independent keys so a problem with one never takes out the others: the
 * shell (which screen, which settings), the in-progress game, and the theme
 * preference.
 *
 * Everything read back off disk is treated as untrusted. A schema change or a
 * half-written record must degrade to "start fresh", never to a crash, so each
 * loader validates shape and returns `null` on anything unexpected.
 *
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Difficulty, Puzzle} from './game/types';
import {GRID_SIZES} from './game/types';
import type {ThemeMode} from './theme';

const SHELL_KEY = 'kenken:shell:v1';
const GAME_KEY = 'kenken:game:v1';
const THEME_KEY = 'kenken:theme:v1';
const BESTS_KEY = 'kenken:bests:v1';

const SCHEMA_VERSION = 1;

/** Coalesces bursts of edits into one write. */
const SAVE_DEBOUNCE_MS = 400;

export interface SavedShell {
  screen: 'menu' | 'game';
  size: number;
  difficulty: Difficulty;
}

export interface SavedGame {
  puzzle: Puzzle;
  values: number[];
  notes: number[];
  seconds: number;
  hintsUsed: number;
  solved: boolean;
  noteMode: boolean;
  selected: number | null;
}

export interface BestTime {
  seconds: number;
  achievedAt: number;
}

/** Keyed by {@link bestTimeKey}, e.g. `"4:easy"`. */
export type BestTimes = Record<string, BestTime>;

const DIFFICULTIES = new Set<string>(['easy', 'medium', 'hard']);
const OPERATIONS = new Set<string>(['+', '-', '×', '÷', '=']);

// --- Reads -----------------------------------------------------------------

export async function loadShell(): Promise<SavedShell | null> {
  const raw = await readJson(SHELL_KEY);
  if (!raw || raw.version !== SCHEMA_VERSION) {
    return null;
  }
  const {screen, size, difficulty} = raw;
  const sizeOk = (GRID_SIZES as readonly number[]).includes(size);
  if (
    (screen !== 'menu' && screen !== 'game') ||
    !sizeOk ||
    !DIFFICULTIES.has(difficulty)
  ) {
    return null;
  }
  return {screen, size, difficulty};
}

export async function loadGame(): Promise<SavedGame | null> {
  const raw = await readJson(GAME_KEY);
  if (!raw || raw.version !== SCHEMA_VERSION || !isValidGame(raw.game)) {
    return null;
  }
  return raw.game;
}

export async function loadThemeMode(): Promise<ThemeMode | null> {
  const raw = await readJson(THEME_KEY);
  const mode = raw?.mode;
  return mode === 'system' || mode === 'light' || mode === 'dark' ? mode : null;
}

// --- Writes ----------------------------------------------------------------

export function saveShell(shell: SavedShell): void {
  fireAndForget(writeJson(SHELL_KEY, {version: SCHEMA_VERSION, ...shell}));
}

export function saveThemeMode(mode: ThemeMode): void {
  fireAndForget(writeJson(THEME_KEY, {mode}));
}

let pendingGame: SavedGame | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queues a game save. Typing a digit changes state several times a second, and
 * each write crosses the native bridge, so writes are debounced rather than
 * issued per keystroke.
 */
export function scheduleSaveGame(game: SavedGame): void {
  pendingGame = game;
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    fireAndForget(flushPendingGame());
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Writes any queued game immediately. Call this when the app is heading to the
 * background — the debounce window is long enough that the process could be
 * frozen before it elapses, silently losing the last few moves.
 *
 * Awaiting the result guarantees a subsequent `loadGame()` sees these edits.
 */
export function flushPendingGame(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!pendingGame) {
    return Promise.resolve();
  }
  const game = pendingGame;
  pendingGame = null;
  return writeJson(GAME_KEY, {version: SCHEMA_VERSION, game});
}

// --- Best times ------------------------------------------------------------

/**
 * Records are kept per grid size *and* difficulty — a 9×9 hard time is not
 * comparable to a 3×3 easy one — giving at most 21 slots.
 */
export function bestTimeKey(size: number, difficulty: Difficulty): string {
  return `${size}:${difficulty}`;
}

export async function loadBestTimes(): Promise<BestTimes> {
  const raw = await readJson(BESTS_KEY);
  const stored = raw?.bests;
  if (
    !raw ||
    raw.version !== SCHEMA_VERSION ||
    typeof stored !== 'object' ||
    stored === null
  ) {
    return {};
  }

  // Unlike the other loaders, a bad entry is dropped on its own rather than
  // discarding the whole record: losing one combo's time beats losing all 21.
  const valid: BestTimes = {};
  for (const [key, entry] of Object.entries(stored as Record<string, any>)) {
    if (
      entry &&
      typeof entry.seconds === 'number' &&
      entry.seconds > 0 &&
      typeof entry.achievedAt === 'number'
    ) {
      valid[key] = {seconds: entry.seconds, achievedAt: entry.achievedAt};
    }
  }
  return valid;
}

/**
 * Stores a finishing time if it beats the existing record.
 *
 * @returns The new record, or `null` when the time did not improve — letting
 * the caller decide whether to celebrate.
 */
export async function recordBestTime(
  size: number,
  difficulty: Difficulty,
  seconds: number,
): Promise<BestTime | null> {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const bests = await loadBestTimes();
  const key = bestTimeKey(size, difficulty);
  const existing = bests[key];
  if (existing && existing.seconds <= seconds) {
    return null;
  }

  const record: BestTime = {seconds, achievedAt: Date.now()};
  bests[key] = record;
  await writeJson(BESTS_KEY, {version: SCHEMA_VERSION, bests});
  return record;
}

// --- Plumbing --------------------------------------------------------------

/** Explicitly discards a promise we deliberately do not await. */
function fireAndForget(promise: Promise<unknown>): void {
  promise.catch(() => {});
}

async function readJson(key: string): Promise<any | null> {
  try {
    const text = await AsyncStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    // Unreadable or malformed: behave as if nothing was stored.
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is a convenience; a failed write must not break play.
  }
}

function isValidGame(game: any): game is SavedGame {
  if (!game || typeof game !== 'object') {
    return false;
  }
  if (!isValidPuzzle(game.puzzle)) {
    return false;
  }

  const cells = game.puzzle.size * game.puzzle.size;
  return (
    isNumberArray(game.values, cells) &&
    isNumberArray(game.notes, cells) &&
    typeof game.seconds === 'number' &&
    typeof game.hintsUsed === 'number' &&
    typeof game.solved === 'boolean' &&
    typeof game.noteMode === 'boolean' &&
    (game.selected === null || typeof game.selected === 'number')
  );
}

function isValidPuzzle(puzzle: any): puzzle is Puzzle {
  if (!puzzle || typeof puzzle !== 'object') {
    return false;
  }
  const {size, solution, cages, cageOfCell} = puzzle;
  if (!(GRID_SIZES as readonly number[]).includes(size)) {
    return false;
  }
  const cells = size * size;
  if (!isNumberArray(solution, cells) || !isNumberArray(cageOfCell, cells)) {
    return false;
  }
  if (!Array.isArray(cages) || cages.length === 0) {
    return false;
  }
  return cages.every(
    (cage: any) =>
      cage &&
      Array.isArray(cage.cells) &&
      cage.cells.length > 0 &&
      cage.cells.every((c: any) => typeof c === 'number' && c >= 0 && c < cells) &&
      typeof cage.id === 'number' &&
      typeof cage.anchor === 'number' &&
      typeof cage.target === 'number' &&
      OPERATIONS.has(cage.operation),
  );
}

function isNumberArray(value: any, length: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((n: any) => typeof n === 'number')
  );
}
