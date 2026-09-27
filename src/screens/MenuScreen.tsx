/**
 * Start screen: resume an unfinished puzzle, or pick a grid size, difficulty
 * and appearance and begin a new one.
 *
 * @format
 */

import {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Chip} from '../components/Chip';
import {DIFFICULTY_CONFIG} from '../game/difficulty';
import {DIFFICULTIES, GRID_SIZES, type Difficulty} from '../game/types';
import {formatDuration} from '../game/validate';
import {bestTimeKey, loadBestTimes, type BestTimes} from '../storage';
import {useTheme} from '../ThemeContext';
import {radius, spacing, THEME_MODES, type Palette, type ThemeMode} from '../theme';

export interface ResumeInfo {
  size: number;
  difficulty: Difficulty;
  filled: number;
  total: number;
  seconds: number;
}

interface MenuScreenProps {
  initialSize: number;
  initialDifficulty: Difficulty;
  resume: ResumeInfo | null;
  onResume: () => void;
  onStart: (size: number, difficulty: Difficulty) => void;
}

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function MenuScreen({
  initialSize,
  initialDifficulty,
  resume,
  onResume,
  onStart,
}: MenuScreenProps) {
  const insets = useSafeAreaInsets();
  const {palette, mode, setMode} = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [size, setSize] = useState(initialSize);
  const [difficulty, setDifficulty] = useState(initialDifficulty);

  // This screen unmounts while a puzzle is in play, so a mount-time read is
  // always current: finishing a game and coming back re-runs it.
  const [bestTimes, setBestTimes] = useState<BestTimes>({});
  useEffect(() => {
    let cancelled = false;
    loadBestTimes()
      .then(times => {
        if (!cancelled) {
          setBestTimes(times);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const best = bestTimes[bestTimeKey(size, difficulty)];

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}>
      <Text
        style={styles.title}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}>
        TeaKenKen
      </Text>

      {resume && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue your unfinished puzzle"
          onPress={onResume}
          style={({pressed}) => [styles.resume, pressed && styles.pressed]}>
          <View style={styles.resumeTextGroup}>
            <Text style={styles.resumeTitle}>Continue puzzle</Text>
            <Text style={styles.resumeMeta}>
              {resume.size}×{resume.size} ·{' '}
              {DIFFICULTY_CONFIG[resume.difficulty].label} · {resume.filled}/
              {resume.total} filled · {formatDuration(resume.seconds)}
            </Text>
          </View>
          <Text style={styles.resumeChevron}>›</Text>
        </Pressable>
      )}

      <Section styles={styles} title="Grid size">
        <View style={styles.chipRow}>
          {GRID_SIZES.map(option => (
            <Chip
              key={option}
              label={`${option}×${option}`}
              selected={option === size}
              onPress={() => setSize(option)}
            />
          ))}
        </View>
      </Section>

      <Section styles={styles} title="Difficulty">
        <View style={styles.chipRow}>
          {DIFFICULTIES.map(option => (
            <Chip
              key={option}
              label={DIFFICULTY_CONFIG[option].label}
              selected={option === difficulty}
              onPress={() => setDifficulty(option)}
            />
          ))}
        </View>
        <Text style={styles.bestLine}>
          <Text style={styles.bestLabel}>Best Time: </Text>
          {best ? formatDuration(best.seconds) : '—'}
        </Text>
      </Section>

      <Section styles={styles} title="Appearance">
        <View style={styles.chipRow}>
          {THEME_MODES.map(option => (
            <Chip
              key={option}
              label={THEME_LABELS[option]}
              selected={option === mode}
              onPress={() => setMode(option)}
            />
          ))}
        </View>
      </Section>

      {/* Absorbs whatever vertical space is left so the CTA sits at the
          bottom on tall screens, and collapses to nothing on short ones. */}
      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Start a new ${size} by ${size} ${DIFFICULTY_CONFIG[difficulty].label} puzzle`}
        onPress={() => onStart(size, difficulty)}
        style={({pressed}) => [styles.cta, pressed && styles.pressed]}>
        <Text style={styles.ctaText}>
          {resume ? 'New puzzle' : 'Play'} · {size}×{size} ·{' '}
          {DIFFICULTY_CONFIG[difficulty].label}
        </Text>
      </Pressable>

      {resume && (
        <Text style={styles.replaceWarning}>
          Starting a new puzzle replaces the one in progress.
        </Text>
      )}
    </View>
  );
}

function Section({
  styles,
  title,
  children,
}: {
  styles: ReturnType<typeof makeStyles>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    spacer: {
      flex: 1,
    },
    title: {
      fontSize: 34,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.5,
    },
    resume: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.accentSoft,
      borderColor: c.accent,
      borderWidth: 1.5,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    resumeTextGroup: {
      flex: 1,
      gap: 2,
    },
    resumeTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: c.accentStrong,
    },
    resumeMeta: {
      fontSize: 13,
      color: c.accentStrong,
      opacity: 0.85,
    },
    resumeChevron: {
      fontSize: 28,
      fontWeight: '700',
      color: c.accentStrong,
      marginLeft: spacing.sm,
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: c.textMuted,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    bestLine: {
      fontSize: 14,
      lineHeight: 20,
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    bestLabel: {
      fontWeight: '700',
    },
    cta: {
      backgroundColor: c.accent,
      borderRadius: radius.lg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ctaText: {
      color: c.onAccent,
      fontSize: 16,
      fontWeight: '700',
    },
    replaceWarning: {
      marginTop: -spacing.sm,
      fontSize: 12,
      textAlign: 'center',
      color: c.textMuted,
    },
    pressed: {
      opacity: 0.75,
    },
  });
