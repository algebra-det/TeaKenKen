/**
 * The KenKen board.
 *
 * Cage outlines are drawn by giving each cell a heavy top/left border wherever
 * it starts a new cage and a hairline otherwise. Only top and left edges are
 * drawn per cell — the shared edge between two neighbours belongs to exactly
 * one of them — and the board container supplies the outer frame, so no line
 * is ever painted twice at double thickness.
 *
 * @format
 */

/* eslint-disable no-bitwise -- pencil marks are stored as a digit bitmask. */
/* eslint-disable react-native/no-inline-styles -- each cell's borders encode
   its cage's outline and its background encodes selection/conflict state, so
   these genuinely vary per cell and cannot be hoisted into a StyleSheet. */

import {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {cageLabel, type Puzzle} from '../game/types';
import type {CageState} from '../game/validate';
import {useTheme} from '../ThemeContext';
import {borderWidths, radius, type Palette} from '../theme';

interface BoardProps {
  puzzle: Puzzle;
  values: number[];
  /** Pencil marks per cell as a bitmask: bit `v - 1` set means note `v`. */
  notes: number[];
  selected: number | null;
  conflicts: boolean[];
  cageStates: Map<number, CageState>;
  cellSize: number;
  onSelect: (cell: number) => void;
}

export function Board({
  puzzle,
  values,
  notes,
  selected,
  conflicts,
  cageStates,
  cellSize,
  onSelect,
}: BoardProps) {
  const {palette} = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const {size, cageOfCell, cages} = puzzle;

  const clueByAnchor = useMemo(() => {
    const map = new Map<number, string>();
    for (const cage of cages) {
      map.set(cage.anchor, cageLabel(cage));
    }
    return map;
  }, [cages]);

  const fonts = useMemo(
    () => ({
      value: Math.min(34, Math.max(13, Math.round(cellSize * 0.46))),
      clue: Math.min(16, Math.max(9, Math.round(cellSize * 0.24))),
      note: Math.min(12, Math.max(7, Math.round(cellSize * 0.2))),
    }),
    [cellSize],
  );

  const selectedRow = selected === null ? -1 : (selected / size) | 0;
  const selectedCol = selected === null ? -1 : selected % size;

  /**
   * Long clues like `1280×` overflow a small cell at the base font size and
   * get clipped — and a truncated target is unusable, since the whole point is
   * knowing the number. Step the size down with length so they always fit.
   */
  const clueFontFor = (label: string): number => {
    if (label.length >= 5) {
      return Math.max(7, fonts.clue - 2);
    }
    if (label.length === 4) {
      return Math.max(8, fonts.clue - 1);
    }
    return fonts.clue;
  };

  return (
    <View
      style={[styles.board, {width: cellSize * size + borderWidths.thick * 2}]}>
      {Array.from({length: size}, (_row, row) => (
        <View key={row} style={styles.row}>
          {Array.from({length: size}, (_col, col) => {
            const cell = row * size + col;
            const cageId = cageOfCell[cell];
            const value = values[cell];
            const isSelected = selected === cell;
            const isPeer =
              !isSelected && (row === selectedRow || col === selectedCol);
            const hasConflict = conflicts[cell];
            const clue = clueByAnchor.get(cell);
            const cageState = cageStates.get(cageId) ?? 'empty';

            const newCageAbove = row === 0 || cageOfCell[cell - size] !== cageId;
            const newCageLeft = col === 0 || cageOfCell[cell - 1] !== cageId;

            return (
              <Pressable
                key={cell}
                accessibilityRole="button"
                accessibilityLabel={`Row ${row + 1} column ${col + 1}${
                  value ? `, value ${value}` : ', empty'
                }`}
                onPress={() => onSelect(cell)}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    borderTopWidth:
                      row === 0
                        ? 0
                        : newCageAbove
                        ? borderWidths.thick
                        : borderWidths.thin,
                    borderLeftWidth:
                      col === 0
                        ? 0
                        : newCageLeft
                        ? borderWidths.thick
                        : borderWidths.thin,
                    borderTopColor: newCageAbove
                      ? palette.cageBorder
                      : palette.gridLine,
                    borderLeftColor: newCageLeft
                      ? palette.cageBorder
                      : palette.gridLine,
                    backgroundColor: cellBackground(
                      palette,
                      isSelected,
                      hasConflict,
                      isPeer,
                    ),
                  },
                ]}>
                {clue !== undefined && (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.clue,
                      {
                        fontSize: clueFontFor(clue),
                        color: clueColor(palette, cageState),
                      },
                    ]}>
                    {clue}
                  </Text>
                )}

                {value > 0 ? (
                  <Text
                    style={[
                      styles.value,
                      {
                        fontSize: fonts.value,
                        color: hasConflict ? palette.danger : palette.text,
                      },
                    ]}>
                    {value}
                  </Text>
                ) : (
                  notes[cell] > 0 && (
                    <NoteGrid
                      styles={styles}
                      mask={notes[cell]}
                      size={size}
                      cellSize={cellSize}
                      fontSize={fonts.note}
                    />
                  )
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Pencil marks on a fixed 3-column grid so a digit always sits in the same
 * spot regardless of which others are present.
 *
 * Every slot is an explicitly-sized View — rendering absent digits as
 * whitespace does not reserve width reliably, which silently shifted later
 * marks out of position (and pushed the last row out of the clipped cell).
 */
function NoteGrid({
  styles,
  mask,
  size,
  cellSize,
  fontSize,
}: {
  styles: ReturnType<typeof makeStyles>;
  mask: number;
  size: number;
  cellSize: number;
  fontSize: number;
}) {
  const columns = 3;
  const rows = Math.ceil(size / columns);
  const slotHeight = fontSize * 1.12;

  return (
    <View
      style={[
        styles.notes,
        {top: cellSize - slotHeight * rows - 2, height: slotHeight * rows},
      ]}>
      {Array.from({length: rows * columns}, (_, i) => {
        const digit = i + 1;
        const present = digit <= size && (mask & (1 << (digit - 1))) !== 0;
        return (
          // A percentage splits whatever width the container actually has.
          // Deriving it from cellSize instead over-estimates, because the
          // cell's left border eats into the content box and the row then
          // wraps to two columns, pushing the last digits out of view.
          <View key={i} style={[styles.noteSlot, {height: slotHeight}]}>
            {present && (
              <Text style={[styles.note, {fontSize, lineHeight: slotHeight}]}>
                {digit}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function cellBackground(
  c: Palette,
  isSelected: boolean,
  hasConflict: boolean,
  isPeer: boolean,
): string {
  if (isSelected) {
    return c.selected;
  }
  if (hasConflict) {
    return c.dangerSoft;
  }
  if (isPeer) {
    return c.peer;
  }
  return c.surface;
}

function clueColor(c: Palette, state: CageState): string {
  switch (state) {
    case 'satisfied':
      return c.success;
    case 'violated':
      return c.danger;
    default:
      return c.textMuted;
  }
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    board: {
      borderWidth: borderWidths.thick,
      borderColor: c.cageBorder,
      borderRadius: radius.sm,
      overflow: 'hidden',
      backgroundColor: c.surface,
      alignSelf: 'center',
    },
    row: {
      flexDirection: 'row',
    },
    cell: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    clue: {
      position: 'absolute',
      top: 1,
      left: 3,
      fontWeight: '700',
    },
    value: {
      fontWeight: '600',
      includeFontPadding: false,
    },
    notes: {
      position: 'absolute',
      left: 2,
      right: 2,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    noteSlot: {
      width: '33.333%',
    },
    note: {
      color: c.textMuted,
      textAlign: 'center',
      fontWeight: '600',
      includeFontPadding: false,
    },
  });
