import { insetRadius } from '@/utils/border-radius';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors, DiagramFrameMetrics as Frame, PuzzleColors as Colors } from '@/constants/puzzle-theme';
import type { FractionStripPuzzle } from '@/types/puzzle';
import { fractionTickAt, partitionFractionStrip, type FractionStripState } from '@/utils/fraction-models';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

const INNER_RADIUS = insetRadius(Frame.outerRadius, Frame.inset);

type Props = { puzzle: FractionStripPuzzle; value: FractionStripState | null; onChange: (state: FractionStripState | null) => void; answered: boolean };

/** Every strip uses the same full width. Borders divide the whole without gaps. */
function Pieces({ parts, shaded }: { parts: number; shaded: number }) {
  return <View style={styles.pieces} pointerEvents="none">
    <View style={styles.segments}>
      {Array.from({ length: parts }, (_, i) => <View key={i} style={[styles.piece, i < shaded && styles.filled, i === parts - 1 && styles.lastPiece]} />)}
    </View>
    <View style={styles.boundary} />
  </View>;
}

export function FractionStripTask({ puzzle, value, onChange, answered }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const { numerator, denominator, partitions, mode, guided } = puzzle.payload;
  const parts = value?.parts ?? (mode === 'build' ? partitions[0] : null);
  const shaded = value?.shaded ?? null;
  const setShaded = (count: number) => {
    if (!answered && parts !== null) onChange({ parts, shaded: Math.max(0, Math.min(parts, count)) });
  };
  return <View style={styles.wrap}>
    {guided ? <Text style={styles.guide}>{t(mode === 'build' ? 'fractionModels.stripGuide' : 'fractionModels.equalGuide')}</Text> : null}
    {mode === 'equivalent' ? <View style={styles.reference} accessible accessibilityLabel={t('fractionModels.referenceLabel', { numerator, denominator })}>
      <Text style={styles.label}>{t('fractionModels.reference')} · {numerator}/{denominator}</Text>
      <Pieces parts={denominator} shaded={numerator} />
    </View> : null}
    {partitions.length > 1 ? <View style={styles.partitionGroup}>
      <Text style={styles.label}>{t('fractionModels.chooseParts')}</Text>
      <View style={styles.choices}>{partitions.map(count => <Pressable key={count} testID={`fraction-strip-parts-${count}`}
        accessibilityRole="button" accessibilityState={{ disabled: answered, selected: parts === count }} disabled={answered}
        onPress={() => { if (parts !== count) onChange(partitionFractionStrip(puzzle, count)); }}
        style={[styles.choice, parts === count && styles.chosen, answered && styles.disabled]}>
        <Text style={[styles.choiceText, parts === count && styles.chosenText]}>{t('fractionModels.parts', { count })}</Text>
      </Pressable>)}</View>
      <Text style={styles.note}>{t('fractionModels.partitionResets')}</Text>
    </View> : null}
    <Text style={styles.label}>{t('fractionModels.yourStrip')}{parts !== null ? ` · ${shaded ?? 0}/${parts}` : ''}</Text>
    <Pressable testID="fraction-strip-board" style={styles.touchStrip} disabled={answered || parts === null}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onPress={e => { if (parts !== null) { const count = fractionTickAt(e.nativeEvent.locationX - Frame.inset, width - Frame.inset * 2, parts); if (count !== null) setShaded(count); } }}
      accessibilityRole="adjustable" accessibilityLabel={t('fractionModels.yourStrip')}
      accessibilityState={{ disabled: answered || parts === null }}
      accessibilityValue={{ min: 0, max: parts ?? 1, now: shaded ?? 0, text: parts === null ? t('fractionModels.chooseParts') : t('fractionModels.shaded', { count: shaded ?? 0, total: parts }) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => setShaded((shaded ?? 0) + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}>
      <Pieces parts={parts ?? 1} shaded={shaded ?? 0} />
    </Pressable>
    <View style={styles.controls}>
      {([-1, 1] as const).map(direction => {
        const disabled = answered || parts === null || (direction < 0 ? (shaded ?? 0) === 0 : shaded === parts);
        return <Pressable key={direction} testID={direction < 0 ? 'fraction-strip-remove' : 'fraction-strip-add'}
          accessibilityRole="button" accessibilityLabel={t(direction < 0 ? 'fractionModels.remove' : 'fractionModels.add')} accessibilityState={{ disabled }} disabled={disabled} onPress={() => setShaded((shaded ?? 0) + direction)}
          style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{direction < 0 ? '− 1' : '+ 1'}</Text>
        </Pressable>;
      })}
    <Pressable testID="fraction-strip-reset" accessibilityRole="button" accessibilityLabel={t('fractionModels.reset')} accessibilityState={{ disabled: answered || value === null }}
      disabled={answered || value === null} onPress={() => onChange(null)} style={styles.reset}>
      <Text style={[styles.resetText, (answered || value === null) && styles.disabled]}>{t('geometryModels.reset')}</Text>
    </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  guide: { color: Colors.textMuted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  label: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  reference: { gap: 8 },
  pieces: { width: '100%', height: 52 + Frame.inset * 2, padding: Frame.inset, flexDirection: 'row', borderRadius: Frame.outerRadius, backgroundColor: DiagramColors.fractionSurface },
  // Clip only the whole’s outside corners; internal partitions keep their spacing.

  boundary: { position: 'absolute', top: Frame.inset, bottom: Frame.inset, left: Frame.inset, right: Frame.inset, borderWidth: 1, borderRadius: INNER_RADIUS, borderColor: DiagramColors.fractionGrid },
  segments: { flex: 1, flexDirection: 'row', borderRadius: INNER_RADIUS, overflow: 'hidden' },
  piece: { flex: 1, backgroundColor: Colors.card, borderRightWidth: 1, borderRightColor: DiagramColors.fractionGrid },
  lastPiece: { borderRightWidth: 0 },
  filled: { backgroundColor: DiagramColors.fractionFill, borderRightColor: DiagramColors.highlight },
  touchStrip: { minHeight: 52 + Frame.inset * 2, justifyContent: 'center' },
  partitionGroup: { gap: 6 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 72, minHeight: 48, padding: 10, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: Colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  chosen: { borderColor: Colors.primary, backgroundColor: Colors.selectedSurface },
  choiceText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  chosenText: { color: Colors.primaryDark },
  note: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  controls: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, minHeight: 48, padding: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.selectedSurface, borderColor: Colors.primary, borderWidth: 2, borderBottomWidth: 4, borderRadius: 12 },
  buttonText: { color: Colors.primaryDark, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { backgroundColor: Colors.selectedStrong },
  reset: { flex: 1, minHeight: 48, padding: 8, justifyContent: 'center', alignItems: 'center' },
  resetText: { textAlign: 'center', color: Colors.textMuted, fontSize: 16, textDecorationLine: 'underline' },
});
