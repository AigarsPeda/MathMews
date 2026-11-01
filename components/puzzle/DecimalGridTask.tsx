import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import type { DecimalGridPuzzle } from '@/types/puzzle';
import { decimalGridCell, decimalLabel } from '@/utils/decimal-models';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = { puzzle: DecimalGridPuzzle; value: number | null; onChange: (value: number | null) => void; answered: boolean };
export function DecimalGridTask({ puzzle, value, onChange, answered }: Props) {
  const { t, i18n } = useTranslation();
  const [width, setWidth] = useState(0);
  const { scale, digits, guided } = puzzle.payload;
  const change = (amount: number) => { if (!answered) onChange(Math.max(0, Math.min(scale, (value ?? 0) + amount))); };
  return <View style={styles.wrap}>
    {guided ? <Text style={styles.guide}>{t(scale === 10 ? 'decimalModels.tenthsGuide' : 'decimalModels.hundredthsGuide')}</Text> : null}
    <Text style={styles.label}>{t('decimalModels.oneWhole')}</Text>
    {/* Use measured width: Yoga can resolve aspectRatio before applying maxWidth. */}
    <Pressable testID="decimal-grid" style={[styles.grid, { height: width || 220 }]} disabled={answered}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onPress={e => { const cell = decimalGridCell(e.nativeEvent.locationX, e.nativeEvent.locationY, width, scale); if (cell !== null) onChange(cell); }}
      accessibilityRole="adjustable" accessibilityLabel={t('decimalModels.gridLabel')}
      accessibilityState={{ disabled: answered }} accessibilityValue={{ min: 0, max: scale, now: value ?? 0, text: t('decimalModels.shaded', { count: value ?? 0, total: scale }) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => change(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <View pointerEvents="none" style={styles.cells}>{Array.from({ length: scale }, (_, i) => <View key={i}
        style={[styles.cell, { height: scale === 10 ? '100%' : '10%' }, i < (value ?? 0) && styles.filled]} />)}</View>
    </Pressable>
    <Text testID="decimal-grid-value" style={styles.value}>{value === null ? t('decimalModels.tapGrid') : `${value}/${scale} = ${decimalLabel(value * 100 / scale, scale === 100 ? 2 : digits, i18n.language)}`}</Text>
    <View style={styles.controls}>{(scale === 100 ? [-10, -1, 1, 10] : [-1, 1]).map(amount => {
      const disabled = answered || (amount < 0 ? (value ?? 0) < -amount : (value ?? 0) + amount > scale);
      return <Pressable key={amount} testID={`decimal-grid-${amount}`} accessibilityRole="button" disabled={disabled}
        accessibilityState={{ disabled }} accessibilityLabel={t(amount < 0 ? 'decimalModels.unshade' : 'decimalModels.shade', { count: Math.abs(amount) })}
        onPress={() => change(amount)} style={[styles.button, disabled && styles.disabled]}>
        <Text style={styles.buttonText}>{amount > 0 ? '+' : '−'}{Math.abs(amount)}</Text>
      </Pressable>;
    })}</View>
    <Text style={styles.guide}>{t('decimalModels.gridControls')}</Text>
    <Pressable testID="decimal-grid-reset" accessibilityRole="button" disabled={answered || value === null}
      accessibilityState={{ disabled: answered || value === null }} onPress={() => onChange(null)} style={styles.reset}>
      <Text style={[styles.resetText, (answered || value === null) && styles.disabled]}>{t('decimalModels.reset')}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: 14 }, guide: { color: Colors.textMuted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  label: { color: Colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  grid: { width: '100%', maxWidth: 220, alignSelf: 'center', borderLeftWidth: 1, borderTopWidth: 1, borderColor: Colors.text },
  cells: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '10%', borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.text, backgroundColor: Colors.background },
  filled: { backgroundColor: Colors.primary, borderColor: Colors.background },
  value: { color: Colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  controls: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, minHeight: 48, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.selectedSurface, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: Colors.primaryDark, fontSize: 18, fontWeight: '700' }, disabled: { opacity: 0.4 },
  reset: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, resetText: { color: Colors.textMuted, fontSize: 16, textDecorationLine: 'underline' },
});
