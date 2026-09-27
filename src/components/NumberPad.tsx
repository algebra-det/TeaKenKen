/**
 * Digit entry pad plus the editing tools (notes, erase, undo, hint).
 *
 * @format
 */

import {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../ThemeContext';
import {radius, spacing, type Palette} from '../theme';

interface NumberPadProps {
  size: number;
  /** Digits already placed `size` times; shown dimmed as a completion cue. */
  exhausted: Set<number>;
  noteMode: boolean;
  disabled: boolean;
  canUndo: boolean;
  onDigit: (value: number) => void;
  onErase: () => void;
  onToggleNotes: () => void;
  onUndo: () => void;
  onHint: () => void;
}

export function NumberPad({
  size,
  exhausted,
  noteMode,
  disabled,
  canUndo,
  onDigit,
  onErase,
  onToggleNotes,
  onUndo,
  onHint,
}: NumberPadProps) {
  const {palette} = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.digits}>
        {Array.from({length: size}, (_, i) => i + 1).map(digit => {
          const isDone = exhausted.has(digit);
          return (
            <Pressable
              key={digit}
              accessibilityRole="button"
              accessibilityLabel={`Enter ${digit}`}
              disabled={disabled}
              onPress={() => onDigit(digit)}
              style={({pressed}) => [
                styles.digit,
                noteMode && styles.digitNoteMode,
                isDone && styles.digitDone,
                pressed && styles.pressed,
                disabled && styles.disabled,
              ]}>
              <Text
                style={[
                  styles.digitText,
                  noteMode && styles.digitTextNoteMode,
                  isDone && styles.digitTextDone,
                ]}>
                {digit}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tools}>
        <ToolButton
          styles={styles}
          label="Undo"
          disabled={disabled || !canUndo}
          onPress={onUndo}
        />
        <ToolButton
          styles={styles}
          label={noteMode ? 'Notes: on' : 'Notes: off'}
          active={noteMode}
          disabled={disabled}
          onPress={onToggleNotes}
        />
        <ToolButton
          styles={styles}
          label="Erase"
          disabled={disabled}
          onPress={onErase}
        />
        <ToolButton
          styles={styles}
          label="Hint"
          disabled={disabled}
          onPress={onHint}
        />
      </View>
    </View>
  );
}

function ToolButton({
  styles,
  label,
  onPress,
  active = false,
  disabled = false,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{selected: active, disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.tool,
        active && styles.toolActive,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.toolText, active && styles.toolTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.md,
    },
    digits: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    digit: {
      // 46dp keeps the tap target close to the 48dp accessibility guideline.
      width: 46,
      height: 46,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    digitNoteMode: {
      borderColor: c.accent,
      borderStyle: 'dashed',
    },
    digitDone: {
      backgroundColor: c.surfaceMuted,
      borderColor: c.surfaceMuted,
    },
    digitText: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
    },
    digitTextNoteMode: {
      color: c.accentStrong,
    },
    digitTextDone: {
      color: c.textDisabled,
    },
    tools: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    tool: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    toolActive: {
      backgroundColor: c.accentSoft,
      borderColor: c.accent,
    },
    toolText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
    },
    toolTextActive: {
      color: c.accentStrong,
    },
    pressed: {
      opacity: 0.65,
    },
    disabled: {
      opacity: 0.4,
    },
  });
