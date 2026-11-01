import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import type { PlaceValuePuzzle } from '@/types/puzzle';
import { changePlaceValue, initialPlaceValue, type PlaceValueAction, type PlaceValueState } from '@/utils/place-value';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  puzzle: PlaceValuePuzzle;
  value: PlaceValueState | null;
  onChange: (value: PlaceValueState | null) => void;
  answered: boolean;
};

export function PlaceValueTask({ puzzle, value, onChange, answered }: Props) {
  const { t } = useTranslation();
  const state = value ?? initialPlaceValue(puzzle);
  const { mode, start, operand, guided } = puzzle.payload;
  const button = (action: PlaceValueAction, label: string) => {
    const next = changePlaceValue(puzzle, state, action);
    const disabled = answered || next === state;
    return <Pressable key={action} accessibilityRole="button" accessibilityState={{ disabled }}
      testID={`place-value-${action}`} disabled={disabled} onPress={() => onChange(next)}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>;
  };
  return <View style={styles.wrap}>
    {guided ? <Text style={styles.instruction}>{t(`placeValue.guide.${mode}`)}</Text> : null}
    <View style={styles.board}>
      {(['tens', 'ones'] as const).map(unit => <View key={unit} style={styles.column}
        accessible accessibilityLabel={t(`placeValue.count.${unit}`, { count: state[unit] })}>
        <Text style={styles.heading}>{t(`placeValue.${unit}`)}</Text>
        <Text style={styles.count}>{state[unit]}</Text>
        <View style={[styles.blocks, unit === 'ones' && styles.ones]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: state[unit] }, (_, i) => unit === 'tens'
            ? <View key={i} style={styles.rod}>{Array.from({ length: 10 }, (_, j) => <View key={j} style={styles.tenCell} />)}</View>
            : <View key={i} style={styles.oneCell} />)}
        </View>
      </View>)}
    </View>
    {mode === 'subtract' ? <Text accessibilityLiveRegion="polite" style={styles.status}>
      {t('placeValue.removed', { count: start - state.tens * 10 - state.ones, target: operand })}
    </Text> : null}
    <View style={styles.controls}>
      {mode === 'build' ? <>
        {button('addTen', t('placeValue.addTen'))}{button('addOne', t('placeValue.addOne'))}
      </> : null}
      {mode === 'build' || mode === 'subtract' ? <>
        {button('removeTen', t('placeValue.removeTen'))}{button('removeOne', t('placeValue.removeOne'))}
      </> : null}
      {mode === 'add' ? button('addOperand', state.added ? t('placeValue.added', { count: operand }) : t('placeValue.add', { count: operand })) : null}
    </View>
    <View style={styles.exchanges}>
      {mode !== 'split' ? button('bundle', t('placeValue.bundle')) : null}
      {mode === 'split' || mode === 'subtract' ? button('split', t('placeValue.split')) : null}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: answered || value === null }}
      disabled={answered || value === null} onPress={() => onChange(null)} testID="place-value-reset"
      style={[styles.reset, (answered || value === null) && styles.disabled]}>
      <Text style={styles.resetText}>{t('placeValue.reset')}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  instruction: { fontSize: 16, lineHeight: 23, color: Colors.textMuted, textAlign: 'center' },
  board: { flexDirection: 'row', borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 16, paddingVertical: 14 },
  column: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  heading: { fontSize: 18, fontWeight: '800', color: Colors.text },
  count: { fontSize: 28, fontWeight: '800', color: Colors.text, marginVertical: 4 },
  blocks: { minHeight: 126, width: 110, alignContent: 'flex-start', gap: 4 },
  ones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rod: { flexDirection: 'row' },
  tenCell: { width: 11, height: 11, borderWidth: 0.5, borderColor: Colors.text, backgroundColor: Colors.headerGlow },
  oneCell: { width: 11, height: 11, borderWidth: 0.5, borderColor: Colors.text, backgroundColor: Colors.coin },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exchanges: { gap: 8 },
  button: { flexGrow: 1, flexBasis: '45%', minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.selectedSurface },
  buttonText: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { backgroundColor: Colors.selectedStrong },
  status: { fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  reset: { minHeight: 44, padding: 8, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontSize: 16, color: Colors.textMuted, textDecorationLine: 'underline' },
});
