import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors, PuzzleColors as Colors } from '@/constants/puzzle-theme';
import type { FractionNumberLinePuzzle } from '@/types/puzzle';
import { fractionTickAt } from '@/utils/fraction-models';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = { puzzle: FractionNumberLinePuzzle; value: number | null; onChange: (tick: number) => void; answered: boolean };

export function FractionNumberLineTask({ puzzle, value, onChange, answered }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const { divisions, guided } = puzzle.payload;
  const move = (direction: number) => {
    if (!answered) onChange(Math.max(0, Math.min(divisions, (value ?? 0) + direction)));
  };
  return <View style={styles.wrap}>
    {guided ? <Text style={styles.guide}>{t('fractionModels.lineGuide', { count: divisions })}</Text> : null}
    <Pressable testID="fraction-line-track" style={styles.track} disabled={answered}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onPress={e => { const tick = fractionTickAt(e.nativeEvent.locationX - 16, width - 32, divisions); if (tick !== null) onChange(tick); }}
      accessibilityRole="adjustable" accessibilityLabel={t('fractionModels.lineLabel')}
      accessibilityState={{ disabled: answered }}
      accessibilityValue={{ min: 0, max: divisions, now: value ?? 0, text: value === null ? t('fractionModels.noPoint') : t('fractionModels.point', { count: value, total: divisions }) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => move(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <View pointerEvents="none" style={styles.axis}>
        <View style={styles.rule} />
        {Array.from({ length: divisions + 1 }, (_, tick) => <View key={tick} style={[styles.tickPosition, { left: `${tick / divisions * 100}%` }]}>
          <View style={styles.tick} />
          {value === tick ? <View style={styles.marker} /> : null}
          {tick === 0 || tick === divisions || guided ? <Text style={styles.label}>
            {tick === 0 ? '0' : tick === divisions ? '1' : `${tick}/${divisions}`}
          </Text> : null}
        </View>)}
      </View>
    </Pressable>
    <View style={styles.controls}>
      {([-1, 1] as const).map(direction => {
        const disabled = answered || value !== null && (direction < 0 ? value === 0 : value === divisions);
        return <Pressable key={direction} testID={direction < 0 ? 'fraction-line-left' : 'fraction-line-right'}
          accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => move(direction)}
          style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{t(direction < 0 ? 'fractionModels.left' : 'fractionModels.right')}</Text>
        </Pressable>;
      })}
    </View>
    <Text style={styles.guide}>{t(value === null ? 'fractionModels.tapLine' : 'fractionModels.pointSelected')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  guide: { color: Colors.textMuted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  track: { height: 112, minHeight: 48, borderRadius: 16, backgroundColor: DiagramColors.fractionSurface },
  axis: { position: 'absolute', top: 30, left: 16, right: 16, height: 70 },
  rule: { position: 'absolute', top: 12, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: DiagramColors.fractionEdge },
  tickPosition: { position: 'absolute', top: 0, width: 0, alignItems: 'center' },
  tick: { width: 3, height: 26, borderRadius: 2, backgroundColor: DiagramColors.fractionEdge },
  marker: { position: 'absolute', top: -1, width: 28, height: 28, borderRadius: 14, backgroundColor: DiagramColors.fractionFill, borderWidth: 3, borderColor: DiagramColors.fractionEdge },
  label: { position: 'absolute', top: 34, width: 46, textAlign: 'center', color: Colors.text, fontSize: 16, fontWeight: '700' },
  controls: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, minHeight: 48, padding: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.selectedSurface, borderColor: Colors.primary, borderWidth: 2, borderBottomWidth: 4, borderRadius: 12 },
  buttonText: { color: Colors.primaryDark, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { backgroundColor: Colors.selectedStrong },
});
