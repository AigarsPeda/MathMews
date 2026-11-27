import { PuzzleText as Text } from './PuzzleText';
import { PuzzleColors } from '@/constants/puzzle-theme';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type ExtraKey = { text: string; label: string; testID: string; onPress: () => void };
type Props = {
  onDigit: (digit: number) => void;
  onErase: () => void;
  canErase: boolean;
  digitID: (digit: number) => string;
  eraseID: string;
  disabled?: boolean;
  isDigitDisabled?: (digit: number) => boolean;
  extraKey?: ExtraKey;
  readout?: ReactNode;
  wideRows?: boolean;
};

export function CompactKeypad({ onDigit, onErase, canErase, digitID, eraseID, disabled = false, isDigitDisabled, extraKey, readout, wideRows = false }: Props) {
  const { t } = useTranslation();
  const key = ({ text, label, testID, onPress }: ExtraKey, unavailable = false) => <Pressable key={testID}
    testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || unavailable }}
    disabled={disabled || unavailable} onPress={onPress} style={({ pressed }) => [styles.key, pressed && styles.pressed]}>
    <Text style={[styles.label, (disabled || unavailable) && styles.disabled]}>{text}</Text>
  </Pressable>;
  const digit = (n: number) => key({ text: String(n), label: String(n), testID: digitID(n), onPress: () => onDigit(n) }, isDigitDisabled?.(n));
  const erase = key({ text: '⌫', label: t('activityMix.erase'), testID: eraseID, onPress: onErase }, !canErase);
  const last = extraKey ? key(extraKey) : <View style={styles.spacer}>{readout}</View>;
  return <View style={styles.pad} testID="compact-keypad">
    {wideRows ? <>
      <View style={styles.row}>{[1, 2, 3, 4, 5].map(digit)}{erase}</View>
      <View style={styles.row}>{[6, 7, 8, 9, 0].map(digit)}{last}</View>
    </> : <>
      {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map(row => <View key={row[0]} style={styles.row}>{row.map(digit)}</View>)}
      <View style={styles.row}>{erase}{digit(0)}{last}</View>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  pad: { width: '100%', alignSelf: 'center', maxWidth: 400, gap: 6 },
  row: { flexDirection: 'row', gap: 7 },
  spacer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  key: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 2, borderBottomWidth: 3,
    borderRadius: 12, borderColor: PuzzleColors.cardBorder, backgroundColor: PuzzleColors.progressTrack },
  label: { fontSize: 20, fontWeight: '800', color: PuzzleColors.text, fontVariant: ['tabular-nums'] },
  disabled: { color: PuzzleColors.textMuted },
  pressed: { borderColor: PuzzleColors.primary, backgroundColor: PuzzleColors.selectedSurface },
});
