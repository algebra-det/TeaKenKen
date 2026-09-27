/**
 * Play screen: generates (or restores) a puzzle and hosts the board, digit pad
 * and editing tools.
 *
 * @format
 */

/* eslint-disable no-bitwise -- pencil marks are stored as a digit bitmask. */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Board} from '../components/Board';
import {NumberPad} from '../components/NumberPad';
import {DIFFICULTY_CONFIG} from '../game/difficulty';
import {generatePuzzle} from '../game/puzzle';
import type {Difficulty, Puzzle} from '../game/types';
import {
  computeConflicts,
  evaluateCage,
  formatDuration,
  isSolved,
  type CageState,
} from '../game/validate';
import {
  bestTimeKey,
  flushPendingGame,
  loadBestTimes,
  recordBestTime,
  scheduleSaveGame,
  type SavedGame,
} from '../storage';
import {useTheme} from '../ThemeContext';
import {borderWidths, radius, spacing, type Palette} from '../theme';

interface GameScreenProps {
  size: number;
  difficulty: Difficulty;
  /** Board to rehydrate instead of generating. Consumed once, on mount. */
  initialGame: SavedGame | null;
  onExit: () => void;
}

interface Snapshot {
  values: number[];
  notes: number[];
}

const MAX_UNDO = 60;
const MAX_BOARD_WIDTH = 440;
/** How often the running clock is checkpointed, in ms. */
const CLOCK_SAVE_INTERVAL = 10_000;
/**
 * Height held for the status banner even when it has nothing to say, so the
 * board does not jump as conflicts appear and clear. Must equal
 * `bannerText.lineHeight` plus the banner's vertical padding.
 */
const BANNER_LINE_HEIGHT = 18;
const BANNER_HEIGHT = BANNER_LINE_HEIGHT + spacing.sm * 2;

export function GameScreen({
  size,
  difficulty,
  initialGame,
  onExit,
}: GameScreenProps) {
  const insets = useSafeAreaInsets();
  const {palette} = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [round, setRound] = useState(0);
  const [values, setValues] = useState<number[]>([]);
  const [notes, setNotes] = useState<number[]>([]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [solved, setSolved] = useState(false);
  /** Existing record for this size/difficulty, or null if none is set. */
  const [bestSeconds, setBestSeconds] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadBestTimes()
      .then(bests => {
        if (!cancelled) {
          setBestSeconds(bests[bestTimeKey(size, difficulty)]?.seconds ?? null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [size, difficulty]);

  // Only ever rehydrate once. Pressing "New puzzle" must generate.
  const pendingRestore = useRef(initialGame);

  useEffect(() => {
    const restored = pendingRestore.current;
    pendingRestore.current = null;
    // A restored win was already celebrated (and recorded) in its own session.
    setIsNewBest(false);

    if (restored) {
      setPuzzle(restored.puzzle);
      setValues(restored.values);
      setNotes(restored.notes);
      setSeconds(restored.seconds);
      setHintsUsed(restored.hintsUsed);
      setSolved(restored.solved);
      setNoteMode(restored.noteMode);
      setSelected(restored.selected);
      setHistory([]);
      return;
    }

    let cancelled = false;
    setPuzzle(null);

    // Generate off the first paint so the loading state is actually visible;
    // a hard 9×9 can occupy the JS thread for a noticeable moment.
    const timer = setTimeout(() => {
      const generated = generatePuzzle(size, difficulty);
      if (cancelled) {
        return;
      }
      setPuzzle(generated);
      setValues(new Array(size * size).fill(0));
      setNotes(new Array(size * size).fill(0));
      setHistory([]);
      setSelected(null);
      setNoteMode(false);
      setHintsUsed(0);
      setSeconds(0);
      setSolved(false);
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [size, difficulty, round]);

  useEffect(() => {
    if (!puzzle || solved) {
      return;
    }
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [puzzle, solved]);

  // --- Persistence ---------------------------------------------------------

  // Declared before the savers so the ref is refreshed first each commit.
  const latest = useRef<SavedGame | null>(null);
  useEffect(() => {
    latest.current = puzzle
      ? {puzzle, values, notes, seconds, hintsUsed, solved, noteMode, selected}
      : null;
  });

  // Save on every board change. Writes are debounced inside the storage layer.
  useEffect(() => {
    if (latest.current) {
      scheduleSaveGame(latest.current);
    }
  }, [puzzle, values, notes, solved, noteMode, selected, hintsUsed]);

  // The clock is deliberately excluded above: it ticks every second and would
  // otherwise force a write per second. Checkpoint it on a slow interval so a
  // hard kill loses at most a few seconds of elapsed time.
  useEffect(() => {
    if (!puzzle || solved) {
      return;
    }
    const id = setInterval(() => {
      if (latest.current) {
        scheduleSaveGame(latest.current);
      }
    }, CLOCK_SAVE_INTERVAL);
    return () => clearInterval(id);
  }, [puzzle, solved]);

  // Leaving the foreground can be followed by the process being frozen or
  // killed, so bypass the debounce and write straight away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && latest.current) {
        scheduleSaveGame(latest.current);
        flushPendingGame();
      }
    });
    return () => sub.remove();
  }, []);

  // --- Derived state -------------------------------------------------------

  const conflicts = useMemo(
    () => (puzzle ? computeConflicts(values, size) : []),
    [puzzle, values, size],
  );

  const cageStates = useMemo(() => {
    const map = new Map<number, CageState>();
    if (puzzle) {
      for (const cage of puzzle.cages) {
        map.set(cage.id, evaluateCage(cage, values));
      }
    }
    return map;
  }, [puzzle, values]);

  useEffect(() => {
    if (!puzzle || solved || !isSolved(puzzle, values)) {
      return;
    }
    setSolved(true);
    setSelected(null);

    // A hint copies a digit straight out of the solution, so an assisted run
    // is not an honest time and never sets a record.
    if (hintsUsed > 0) {
      return;
    }

    // Judge the record from the value already in hand and persist in the
    // background: awaiting the write would render the banner once without the
    // "new best" and then visibly swap it in.
    if (bestSeconds === null || seconds < bestSeconds) {
      setIsNewBest(true);
      setBestSeconds(seconds);
    }
    recordBestTime(size, difficulty, seconds).catch(() => {});
  }, [
    puzzle,
    values,
    solved,
    hintsUsed,
    seconds,
    bestSeconds,
    size,
    difficulty,
  ]);

  // --- Actions -------------------------------------------------------------

  const commit = useCallback(
    (nextValues: number[], nextNotes: number[]) => {
      setHistory(prev => [...prev, {values, notes}].slice(-MAX_UNDO));
      setValues(nextValues);
      setNotes(nextNotes);
    },
    [values, notes],
  );

  const handleDigit = useCallback(
    (digit: number) => {
      if (!puzzle || selected === null || solved) {
        return;
      }
      const nextValues = [...values];
      const nextNotes = [...notes];

      if (noteMode) {
        if (nextValues[selected] !== 0) {
          return;
        }
        nextNotes[selected] ^= 1 << (digit - 1);
      } else {
        const clearing = nextValues[selected] === digit;
        nextValues[selected] = clearing ? 0 : digit;
        nextNotes[selected] = 0;
        if (!clearing) {
          clearPeerNotes(nextNotes, selected, digit, size);
        }
      }
      commit(nextValues, nextNotes);
    },
    [puzzle, selected, solved, values, notes, noteMode, size, commit],
  );

  const handleErase = useCallback(() => {
    if (!puzzle || selected === null || solved) {
      return;
    }
    if (values[selected] === 0 && notes[selected] === 0) {
      return;
    }
    const nextValues = [...values];
    const nextNotes = [...notes];
    nextValues[selected] = 0;
    nextNotes[selected] = 0;
    commit(nextValues, nextNotes);
  }, [puzzle, selected, solved, values, notes, commit]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) {
      return;
    }
    const previous = history[history.length - 1];
    setValues(previous.values);
    setNotes(previous.notes);
    setHistory(history.slice(0, -1));
  }, [history]);

  const handleHint = useCallback(() => {
    if (!puzzle || solved) {
      return;
    }
    const isWrong = (cell: number) => values[cell] !== puzzle.solution[cell];
    const target =
      selected !== null && isWrong(selected)
        ? selected
        : values.findIndex((_, cell) => isWrong(cell));
    if (target < 0) {
      return;
    }

    const nextValues = [...values];
    const nextNotes = [...notes];
    nextValues[target] = puzzle.solution[target];
    nextNotes[target] = 0;
    clearPeerNotes(nextNotes, target, puzzle.solution[target], size);

    commit(nextValues, nextNotes);
    setSelected(target);
    setHintsUsed(n => n + 1);
  }, [puzzle, solved, selected, values, notes, size, commit]);

  const handleReset = useCallback(() => {
    if (!puzzle) {
      return;
    }
    commit(new Array(size * size).fill(0), new Array(size * size).fill(0));
    setSelected(null);
    setSolved(false);
  }, [puzzle, size, commit]);

  const exhausted = useMemo(() => {
    const counts = new Map<number, number>();
    for (const value of values) {
      if (value > 0) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    const done = new Set<number>();
    for (const [digit, count] of counts) {
      if (count >= size) {
        done.add(digit);
      }
    }
    return done;
  }, [values, size]);

  // The board is sized from the space actually left over after the header,
  // banner, pad and footer have taken theirs — measured rather than assumed,
  // so the screen never needs to scroll on any device. Constraining by height
  // as well as width is the part that matters: width alone overflows on short
  // screens, which is what forced a ScrollView before.
  const [boardArea, setBoardArea] = useState({width: 0, height: 0});

  const cellSize = useMemo(() => {
    const available =
      Math.min(boardArea.width, boardArea.height, MAX_BOARD_WIDTH) -
      borderWidths.thick * 2;
    return available > 0 ? Math.floor(available / size) : 0;
  }, [boardArea, size]);

  const difficultyLabel = DIFFICULTY_CONFIG[difficulty].label;

  return (
    <View style={[styles.screen, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to menu"
          onPress={onExit}
          style={({pressed}) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Menu</Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          {size}×{size} · {difficultyLabel}
        </Text>

        <Text style={styles.timer}>{formatDuration(seconds)}</Text>
      </View>

      {!puzzle ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>
            Building a {size}×{size} {difficultyLabel.toLowerCase()} puzzle…
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.content,
            {paddingBottom: insets.bottom + spacing.md},
          ]}>
          <StatusBanner
            styles={styles}
            solved={solved}
            seconds={seconds}
            hintsUsed={hintsUsed}
            conflictCount={conflicts.filter(Boolean).length}
            bestSeconds={bestSeconds}
            isNewBest={isNewBest}
          />

          <View
            style={styles.boardArea}
            onLayout={event => {
              const {width: w, height: h} = event.nativeEvent.layout;
              setBoardArea(prev =>
                prev.width === w && prev.height === h ? prev : {width: w, height: h},
              );
            }}>
            {cellSize > 0 && (
              <Board
                puzzle={puzzle}
                values={values}
                notes={notes}
                selected={selected}
                conflicts={conflicts}
                cageStates={cageStates}
                cellSize={cellSize}
                onSelect={cell => setSelected(cell === selected ? null : cell)}
              />
            )}
          </View>

          <NumberPad
            size={size}
            exhausted={exhausted}
            noteMode={noteMode}
            disabled={solved}
            canUndo={history.length > 0}
            onDigit={handleDigit}
            onErase={handleErase}
            onToggleNotes={() => setNoteMode(m => !m)}
            onUndo={handleUndo}
            onHint={handleHint}
          />

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={handleReset}
              style={({pressed}) => [
                styles.footerButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.footerButtonText}>Reset board</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRound(n => n + 1)}
              style={({pressed}) => [
                styles.footerButton,
                styles.footerButtonPrimary,
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.footerButtonText,
                  styles.footerButtonTextPrimary,
                ]}>
                New puzzle
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function StatusBanner({
  styles,
  solved,
  seconds,
  hintsUsed,
  conflictCount,
  bestSeconds,
  isNewBest,
}: {
  styles: ReturnType<typeof makeStyles>;
  solved: boolean;
  seconds: number;
  hintsUsed: number;
  conflictCount: number;
  bestSeconds: number | null;
  isNewBest: boolean;
}) {
  if (solved) {
    return (
      <View style={[styles.banner, styles.bannerSuccess]}>
        <Text style={[styles.bannerText, styles.bannerTextSuccess]}>
          {solvedSummary(seconds, hintsUsed, bestSeconds, isNewBest)}
        </Text>
      </View>
    );
  }

  if (conflictCount > 0) {
    return (
      <View style={[styles.banner, styles.bannerDanger]}>
        <Text style={[styles.bannerText, styles.bannerTextDanger]}>
          {conflictCount} cell{conflictCount === 1 ? '' : 's'} repeat a digit in
          a row or column
        </Text>
      </View>
    );
  }

  // Nothing to report, but the slot keeps its height so the board stays put
  // when a conflict appears or clears.
  return <View style={styles.bannerPlaceholder} />;
}

function solvedSummary(
  seconds: number,
  hintsUsed: number,
  bestSeconds: number | null,
  isNewBest: boolean,
): string {
  const time = formatDuration(seconds);

  if (hintsUsed > 0) {
    return `Solved in ${time} · ${hintsUsed} hint${
      hintsUsed === 1 ? '' : 's'
    } used`;
  }
  if (isNewBest) {
    return `Solved in ${time} — new best!`;
  }
  if (bestSeconds !== null) {
    return `Solved in ${time} · best ${formatDuration(bestSeconds)}`;
  }
  return `Solved in ${time} · no hints`;
}

/**
 * Placing a digit rules it out for the rest of its row and column, so drop it
 * from those cells' pencil marks automatically.
 */
function clearPeerNotes(
  notes: number[],
  cell: number,
  digit: number,
  size: number,
): void {
  const row = (cell / size) | 0;
  const col = cell % size;
  const mask = ~(1 << (digit - 1));
  for (let i = 0; i < size; i++) {
    notes[row * size + i] &= mask;
    notes[i * size + col] &= mask;
  }
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    backButton: {
      minWidth: 76,
    },
    backText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.accent,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
    },
    timer: {
      minWidth: 76,
      textAlign: 'right',
      fontSize: 16,
      fontWeight: '600',
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    loadingText: {
      fontSize: 15,
      color: c.textMuted,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    boardArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    banner: {
      alignSelf: 'center',
      minHeight: BANNER_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: c.surface,
    },
    bannerPlaceholder: {
      height: BANNER_HEIGHT,
    },
    bannerSuccess: {
      backgroundColor: c.successSoft,
    },
    bannerDanger: {
      backgroundColor: c.dangerSoft,
    },
    bannerText: {
      fontSize: 14,
      lineHeight: BANNER_LINE_HEIGHT,
      fontWeight: '600',
      color: c.textMuted,
      textAlign: 'center',
    },
    bannerTextSuccess: {
      color: c.success,
    },
    bannerTextDanger: {
      color: c.danger,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    footerButton: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: radius.md,
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    footerButtonPrimary: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    footerButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.textMuted,
    },
    footerButtonTextPrimary: {
      color: c.onAccent,
    },
    pressed: {
      opacity: 0.65,
    },
  });
