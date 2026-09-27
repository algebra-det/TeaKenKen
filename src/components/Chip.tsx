/**
 * Selectable pill used for grid-size, difficulty and theme choices.
 *
 * @format
 */

import {useMemo} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useTheme} from '../ThemeContext';
import {radius, type Palette} from '../theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Chip({
  label,
  selected,
  onPress,
  style,
  accessibilityLabel,
}: ChipProps) {
  const {palette} = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{selected}}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({pressed}) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
        style,
      ]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      borderColor: c.accent,
      backgroundColor: c.accentSoft,
    },
    chipPressed: {
      opacity: 0.7,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textMuted,
    },
    labelSelected: {
      color: c.accentStrong,
    },
  });
