import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as D, PuzzleColors as Colors } from '@/constants/puzzle-theme';
import type { GeometryMeasurePuzzle } from '@/types/puzzle';
import { appendGeometryDigit, rectangleEdges } from '@/utils/geometry-models';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = { puzzle: GeometryMeasurePuzzle; value: number | null; onChange: (value: number | null) => void; answered: boolean; readOnly?: boolean };
export function GeometryMeasureTask({ puzzle, value, onChange, answered, readOnly = false }: Props) {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(280);
  const [marked, setMarked] = useState(0);
  const { mode, width, height, other, guided } = puzzle.payload;
  const missing = mode === 'missing_area' || mode === 'missing_perimeter';
  const measure = mode === 'area' || mode === 'missing_area' ? 'area' : 'perimeter';
  const unit = Math.min(32, 144 / Math.max(height, other?.height ?? 0), other ? (available - 76) / (width + other.width) : (available - 32) / width);
  const picture = (w: number, h: number, name: string) => {
    // Unknown dimensions are deliberately schematic: no hidden unit-grid answer.
    const columns = missing ? 5 : w, rows = missing ? 3 : h;
    const size = missing ? Math.min(32, (available - 32) / 5) : unit;
    const edges = rectangleEdges(columns, rows);
    return <View style={styles.figure}>
      {name ? <Text style={styles.label}>{name}</Text> : null}
      <Text style={styles.dimension}>{w === 1 ? t('geometryModels.oneUnit') : t('geometryModels.manyUnits', { value: w })}</Text>
      <View style={styles.diagramRow}>
        <View testID={`geometry-shape-${name || 'main'}`} accessible accessibilityLabel={missing ? t('geometryModels.unknownShape', { width: w }) : t('geometryModels.shape', { name, width: w, height: h })} style={{ width: columns * size, height: rows * size }}>
          {Array.from({ length: columns * rows }, (_, i) => <View key={i} style={[styles.cell, {
            position: 'absolute', left: i % columns * size, top: Math.floor(i / columns) * size, width: size, height: size,
            borderWidth: missing ? 0 : 0.5, borderColor: mode === 'area' && i < marked ? Colors.background : D.geometryGrid, backgroundColor: mode === 'area' && i < marked ? D.geometryFill : D.geometrySurface,
          }]} />)}
          <View pointerEvents="none" style={styles.outline} />
          {!missing && measure === 'perimeter' ? edges.map((edge, i) => <View key={i} style={{
            position: 'absolute', left: edge.x * size - (edge.horizontal ? 0 : 2), top: edge.y * size - (edge.horizontal ? 2 : 0),
            width: edge.horizontal ? size : 4, height: edge.horizontal ? 4 : size,
            backgroundColor: mode === 'perimeter' && i < marked ? Colors.primary : D.geometryEdge,
          }} />) : null}
        </View>
        <Text style={styles.side}>{missing ? '?' : h}</Text>
      </View>
      {missing ? <Text style={styles.note}>{t('geometryModels.notToScale')}</Text> : null}
    </View>;
  };
  const button = (id: string, label: string, action: () => void, disabled = false, selected = false, compact = false) =>
    <Pressable key={id} testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: answered || disabled, selected }}
      disabled={answered || disabled} onPress={action} style={[styles.button, compact && styles.digit, selected && styles.selected, (answered || disabled) && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>;
  const reset = () => { setMarked(0); onChange(null); };
  return <View style={styles.wrap} onLayout={e => setAvailable(e.nativeEvent.layout.width)}>
    {guided && !readOnly ? <Text style={styles.guide}>{t(`geometryModels.guide_${mode}`)}</Text> : null}
    {missing ? <Text style={styles.given}>{t(`geometryModels.given_${measure}`, { value: measure === 'area' ? width * height : 2 * (width + height) })}</Text> : null}
    {mode === 'compare' && other ? <View style={styles.comparison}>{picture(width, height, 'A')}{picture(other.width, other.height, 'B')}</View> : picture(width, height, '')}
    {!missing ? <Text style={styles.note}>{t('geometryModels.unitSquare')}</Text> : null}
    {!readOnly ? <>
    {guided && (mode === 'area' || mode === 'perimeter') ? <View style={styles.support}>
      {button('geometry-mark', t(mode === 'area' ? 'geometryModels.coverSquare' : 'geometryModels.traceEdge'), () => setMarked(marked + 1), marked >= (mode === 'area' ? width * height : 2 * (width + height)))}
      <Text style={[styles.note, styles.markedCount]}>{t(mode === 'area' ? 'geometryModels.squaresMarked' : 'geometryModels.edgesMarked', { count: marked })}</Text>
    </View> : null}
    {mode === 'compare' ? <View style={styles.choices}>{['A', 'B', t('geometryModels.equal')].map((label, i) => button(`geometry-choice-${i}`, label, () => onChange(i), false, value === i))}</View> : <>
      <View style={styles.answerRow}><Text style={styles.label}>{t(missing ? 'geometryModels.sideAnswer' : `geometryModels.${mode}Answer`)}</Text>
      <Text testID="geometry-answer" accessibilityLiveRegion="polite" style={styles.answer}>{value ?? '?'}</Text></View>
      <View style={styles.keypad}>{[1,2,3,4,5,6,7,8,9,0].map(digit => button(`geometry-digit-${digit}`, String(digit), () => onChange(appendGeometryDigit(value, digit)), value !== null && value * 10 + digit > 999, false, true))}</View>

    </>}
    <View style={styles.footer}>
      {mode !== 'compare' ? button('geometry-erase', t('geometryModels.eraseShort'), () => onChange(value !== null && value >= 10 ? Math.floor(value / 10) : null), value === null) : null}
    <Pressable testID="geometry-reset" accessibilityRole="button" disabled={answered || value === null && marked === 0}
      accessibilityState={{ disabled: answered || value === null && marked === 0 }} onPress={reset} style={styles.reset}>
      <Text style={[styles.resetText, (answered || value === null && marked === 0) && styles.disabled]}>{t('geometryModels.reset')}</Text>
    </Pressable>
    </View>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: 6 }, answerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12 }, footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-evenly', gap: 8 }, guide: { fontSize: 16, lineHeight: 23, color: Colors.textMuted, textAlign: 'center' },
  comparison: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  figure: { alignItems: 'center', gap: 4 }, label: { fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  dimension: { fontSize: 17, fontWeight: '800', color: D.geometryEdge }, diagramRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  side: { width: 22, fontSize: 17, fontWeight: '800', color: D.geometryEdge }, cell: { borderColor: Colors.cardBorder },
  outline: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: D.geometryEdge },
  note: { fontSize: 14, lineHeight: 20, color: Colors.textMuted, textAlign: 'center' }, given: { fontSize: 20, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  support: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, markedCount: { flex: 1, minWidth: 76 }, choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }, keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'space-between' },
  button: { maxWidth: '100%', minHeight: 48, padding: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  digit: { width: '18%' }, buttonText: { fontSize: 18, fontWeight: '700', color: Colors.primaryDark, textAlign: 'center' },
  selected: { borderColor: Colors.primary, backgroundColor: Colors.selectedSurface }, answer: { fontSize: 28, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  disabled: { opacity: 0.4 }, reset: { minHeight: 44, justifyContent: 'center', alignItems: 'center' }, resetText: { fontSize: 16, color: Colors.textMuted, textDecorationLine: 'underline' },
});
