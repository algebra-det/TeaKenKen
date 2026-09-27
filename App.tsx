/**
 * KenKen — a Latin-square puzzle with arithmetic cages.
 *
 * Owns the "shell" state (which screen, which settings) and rehydrates the
 * previous session on launch so closing the app never loses a board.
 *
 * @format
 */

import {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import type {Difficulty} from './src/game/types';
import {GameScreen} from './src/screens/GameScreen';
import {MenuScreen, type ResumeInfo} from './src/screens/MenuScreen';
import {
  flushPendingGame,
  loadGame,
  loadShell,
  loadThemeMode,
  saveShell,
  saveThemeMode,
  type SavedGame,
} from './src/storage';
import {ThemeProvider, useTheme} from './src/ThemeContext';
import {palettes, type ThemeMode} from './src/theme';

type Screen = 'menu' | 'game';

interface BootState {
  themeMode: ThemeMode;
  screen: Screen;
  size: number;
  difficulty: Difficulty;
  game: SavedGame | null;
}

function App() {
  const [boot, setBoot] = useState<BootState | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [shell, game, themeMode] = await Promise.all([
        loadShell(),
        loadGame(),
        loadThemeMode(),
      ]);
      if (cancelled) {
        return;
      }

      // Only reopen on the board if the stored settings actually match the
      // stored game; a mismatch means one of the two records is stale.
      const canResume =
        !!game &&
        !!shell &&
        shell.screen === 'game' &&
        game.puzzle.size === shell.size &&
        game.puzzle.difficulty === shell.difficulty;

      setBoot({
        themeMode: themeMode ?? 'system',
        screen: canResume ? 'game' : 'menu',
        size: shell?.size ?? 4,
        difficulty: shell?.difficulty ?? 'easy',
        game,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!boot) {
    // Pre-theme: the stored preference is not known yet, so use the neutral
    // light background rather than flashing a colour we may immediately undo.
    return (
      <View style={[styles.root, {backgroundColor: palettes.light.background}]}>
        <ActivityIndicator size="large" color={palettes.light.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider initialMode={boot.themeMode} onModeChange={saveThemeMode}>
      <SafeAreaProvider>
        <Shell boot={boot} />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function Shell({boot}: {boot: BootState}) {
  const {palette, scheme} = useTheme();

  const [screen, setScreen] = useState<Screen>(boot.screen);
  const [size, setSize] = useState(boot.size);
  const [difficulty, setDifficulty] = useState<Difficulty>(boot.difficulty);
  const [savedGame, setSavedGame] = useState<SavedGame | null>(boot.game);

  // The board handed to GameScreen on mount: the stored game when resuming,
  // null when starting fresh. Bumping `nonce` remounts for a new puzzle.
  const [restore, setRestore] = useState<SavedGame | null>(
    boot.screen === 'game' ? boot.game : null,
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    saveShell({screen, size, difficulty});
  }, [screen, size, difficulty]);

  const handleStart = useCallback(
    (nextSize: number, nextDifficulty: Difficulty) => {
      setSize(nextSize);
      setDifficulty(nextDifficulty);
      setRestore(null);
      setNonce(n => n + 1);
      setScreen('game');
    },
    [],
  );

  const handleResume = useCallback(() => {
    if (!savedGame) {
      return;
    }
    setSize(savedGame.puzzle.size);
    setDifficulty(savedGame.puzzle.difficulty);
    setRestore(savedGame);
    setNonce(n => n + 1);
    setScreen('game');
  }, [savedGame]);

  const handleExit = useCallback(async () => {
    // Land the debounced write before reading, so the menu's progress
    // summary reflects the very last move rather than a stale snapshot.
    await flushPendingGame();
    setSavedGame(await loadGame());
    setScreen('menu');
  }, []);

  const resumeInfo = useMemo<ResumeInfo | null>(() => {
    if (!savedGame || savedGame.solved) {
      return null;
    }
    return {
      size: savedGame.puzzle.size,
      difficulty: savedGame.puzzle.difficulty,
      filled: savedGame.values.filter(v => v > 0).length,
      total: savedGame.values.length,
      seconds: savedGame.seconds,
    };
  }, [savedGame]);

  return (
    <View style={[styles.root, {backgroundColor: palette.background}]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      {screen === 'game' ? (
        <GameScreen
          key={`${size}-${difficulty}-${nonce}`}
          size={size}
          difficulty={difficulty}
          initialGame={restore}
          onExit={handleExit}
        />
      ) : (
        <MenuScreen
          initialSize={size}
          initialDifficulty={difficulty}
          resume={resumeInfo}
          onResume={handleResume}
          onStart={handleStart}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});

export default App;
