import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import type { DecimalPlaceValuePuzzle } from '@/types/puzzle';
import { changeDecimalPlace, decimalLabel, decimalTotal, initialDecimalPlace, type DecimalAction, type DecimalPlaceState } from '@/utils/decimal-models';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = { puzzle: DecimalPlaceValuePuzzle; value: DecimalPlaceState | null; onChange: (value: DecimalPlaceState | null) => void; answered: boolean };
export function DecimalPlaceValueTask({ puzzle, value, onChange, answered }: Props) {
  const { t, i18n } = useTranslation();
  const state = value ?? initialDecimalPlace(puzzle);
  const { mode, units, exchangeUnit, digits, guided } = puzzle.payload;
  const actionButton = (action: DecimalAction, label: string, id: string, compact = false) => {
    const next = changeDecimalPlace(puzzle, state, action), disabled = answered || next === state;
    return <Pressable key={id} testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      accessibilityState={{ disabled }} onPress={() => onChange(next)} style={[styles.button, compact && styles.compact, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{compact ? action.kind === 'add' ? '+' : '−' : label}</Text>
    </Pressable>;
  };
  return <View style={styles.wrap}>
    {guided ? <Text style={styles.guide}>{t(`decimalModels.${mode === 'build' ? 'placeGuide' : 'exchangeGuide'}`)}</Text> : null}
    <View style={styles.columns}>{units.map(unit => <View key={unit} style={styles.column}>
      <Text style={styles.unit}>{t(`decimalModels.${unit}`)}</Text>
      <Text style={styles.unitValue}>{unit === 'ones' ? '1' : decimalLabel(unit === 'tenths' ? 10 : 1, unit === 'tenths' ? 1 : 2, i18n.language)}</Text>
      <Text style={styles.count} testID={`decimal-count-${unit}`}>{state[unit]}</Text>
      <View style={styles.blocks} accessible accessibilityLabel={t('decimalModels.unitCount', { count: state[unit], unit: t(`decimalModels.${unit}`) })}>
        {Array.from({ length: state[unit] }, (_, i) => <View key={i} style={[styles.block, unit === 'ones' ? styles.whole : unit === 'tenths' ? styles.tenth : styles.hundredth]} />)}
      </View>
      {mode === 'build' ? <View style={styles.controls}>
        {actionButton({ kind: 'remove', unit }, t('decimalModels.removeUnit', { unit: t(`decimalModels.${unit}`) }), `decimal-remove-${unit}`, true)}
        {actionButton({ kind: 'add', unit }, t('decimalModels.addUnit', { unit: t(`decimalModels.${unit}`) }), `decimal-add-${unit}`, true)}
      </View> : null}
    </View>)}</View>
    <Text style={styles.guide}>{t(digits === 1 ? 'decimalModels.blockScaleTenths' : 'decimalModels.blockScale')}</Text>
    <Text testID="decimal-place-value" style={styles.total}>{t('decimalModels.total', { value: decimalLabel(decimalTotal(state), digits, i18n.language) })}</Text>
    {mode !== 'build' ? actionButton({ kind: mode, unit: exchangeUnit }, t(`decimalModels.${mode}_${exchangeUnit}`), 'decimal-exchange') : null}
    <Pressable testID="decimal-place-reset" accessibilityRole="button" accessibilityState={{ disabled: answered || value === null }}
      disabled={answered || value === null} onPress={() => onChange(null)} style={styles.reset}>
      <Text style={[styles.resetText, (answered || value === null) && styles.disabled]}>{t('decimalModels.reset')}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: 16 }, guide: { color: Colors.textMuted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  columns: { flexDirection: 'row', gap: 8 }, column: { flex: 1, alignItems: 'center', gap: 10 },
  unit: { color: Colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' }, unitValue: { color: Colors.textMuted, fontSize: 16 },
  count: { color: Colors.text, fontSize: 28, fontWeight: '800' },
  blocks: { minHeight: 92, flexDirection: 'row', flexWrap: 'wrap', gap: 3, alignContent: 'flex-start', width: '100%', justifyContent: 'center' },
  block: { backgroundColor: Colors.primary }, whole: { width: 40, height: 40 }, tenth: { width: 4, height: 40 }, hundredth: { width: 4, height: 4 },
  controls: { flexDirection: 'column', gap: 6, width: '100%' },
  button: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.selectedSurface, justifyContent: 'center', alignItems: 'center' },
  compact: { flex: 1, paddingHorizontal: 0 }, buttonText: { color: Colors.primaryDark, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  total: { color: Colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' }, disabled: { opacity: 0.4 },
  reset: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, resetText: { color: Colors.textMuted, fontSize: 16, textDecorationLine: 'underline' },
});
