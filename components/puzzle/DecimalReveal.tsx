import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { decimalEquation, decimalFillAt, decimalRevealModel, type DecimalPuzzle } from '@/utils/decimal-reveal';
import { BaseTenGrid } from '@/components/puzzle/BaseTenGrid';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function DecimalReveal({ puzzle, onSolutionShown }: { puzzle: DecimalPuzzle; onSolutionShown: () => void }) {
  const model = useMemo(() => decimalRevealModel(puzzle), [puzzle]);
  const { active, reduceMotion } = useAnimationActivity();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const { plates, steps, exchange, total, grid, scale } = model;
  const size = Math.min(220, ((measuredWidth || width - 56) - 8 * (plates - 1)) / plates);
  const beats = exchange ? 1 : Math.max(1, steps.length - 1);
  const beat = useSharedValue(0);
  const amount = useDerivedValue(() => exchange ? total : decimalFillAt(steps, beat.get()));
  const [reading, setReading] = useState(exchange ? total : 0);
  const finished = reading === -1;
  useEffect(() => {
    if (!active || reduceMotion) beat.set(beats);
    else if (beat.get() < beats) beat.set(withDelay(exchange ? 650 : 220, withTiming(beats, {
      duration: Math.min(5000, Math.max(1500, beats * 470)), easing: Easing.linear,
    })));
    return () => cancelAnimation(beat);
  }, [active, reduceMotion, exchange, beat, beats]);
  useAnimatedReaction(() => {
    if (beat.get() >= beats) return -1;
    const filled = amount.get();
    if (!grid && !exchange) {
      // Count a whole or a tenth only once its entire piece has landed.
      const step = Math.max(0, Math.min(steps.length - 1, Math.floor(beat.get())));
      return filled >= steps[step + 1] ? steps[step + 1] : steps[step];
    }
    return scale === 10 ? Math.floor(filled / 10) * 10 : Math.floor(filled);
  }, (value, previous) => {
    if (value !== previous) scheduleOnRN(setReading, value);
  });
  useEffect(() => { if (finished) onSolutionShown(); }, [finished, onSolutionShown]);
  const shown = finished ? total : reading;
  const tenths = Math.floor(shown / 10), hundredths = shown % 10;
  const units = [];
  if (grid) {
    if (scale === 10 || tenths > 0) units.push(t('decimalModels.countTenths', { count: tenths }));
    if (scale === 100 && (hundredths > 0 || shown === 0)) units.push(t('decimalModels.countHundredths', { count: hundredths }));
  }
  return <View style={[styles.wrap, plates > 1 && styles.severalWholes]} onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
    <Text style={styles.caption}>{t(plates > 1 ? 'decimalModels.eachWhole' : 'decimalModels.oneWhole')}</Text>
    <View style={styles.plates} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: plates }, (_, index) =>
        <BaseTenGrid key={index} model={model} index={index} size={size} amount={amount} beat={beat} />)}
    </View>
    <Text testID="decimal-solution-equation" accessibilityLiveRegion={finished ? 'polite' : 'none'} style={styles.equation}>
      {decimalEquation(model, shown, finished, i18n.language)}
    </Text>
    {grid && <Text style={styles.caption}>{units.join(' + ')}</Text>}
    {exchange && <Text style={styles.caption}>{t(`decimalModels.${exchange.mode}_${exchange.unit}`)}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 10, paddingVertical: 8 },
  plates: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  severalWholes: { paddingTop: 52 },
  caption: { fontSize: 16, fontWeight: '700', textAlign: 'center', color: PuzzleColors.coinText },
  equation: { fontSize: 24, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'], color: PuzzleColors.primaryDark },
});
