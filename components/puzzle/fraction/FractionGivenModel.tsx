import { FractionPieChart } from '@/components/puzzle/FractionPieChart';
import { FractionStrip } from '@/components/puzzle/fraction/FractionStrip';
import { FractionNotation } from '@/components/puzzle/fraction/FractionNotation';
import { Caption } from '../kit/Focus';
import { FractionGroupTape } from './FractionGroupTape';
import { TappableFractionPie, usePieSize } from './TappableFractionPie';
import type { Puzzle } from '@/types/puzzle';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

type FractionExample = NonNullable<Puzzle['fractionExample']>;

export function FractionGivenModel({ example, attempt = false, miss }: { example: FractionExample; contextObjects?: Puzzle['contextObjects']; attempt?: boolean; miss?: string }) {
  const { t } = useTranslation();
  const { numerator, denominator, whole, compareTo } = example;
  if (compareTo) return <View style={styles.wrap}>
    <FractionNotation numerator={numerator} denominator={denominator} given />
    <FractionStrip parts={denominator} shaded={numerator} />
    <FractionNotation numerator={compareTo[0]} denominator={compareTo[1]} given />
    <FractionStrip parts={compareTo[1]} shaded={compareTo[0]} />
  </View>;
  if (whole) return <View nativeID="play-entry-model" testID="play-entry-model" style={styles.wrap}
    accessible accessibilityRole="image" accessibilityLabel={`${whole} · ${t('fractionModels.shaded', { count: numerator, total: denominator })}`}>
    <View style={styles.tape}>{/* A miss keeps this same tray and labels every group, exactly as the correct settle does. */}
      <FractionGroupTape total={whole} parts={denominator} shaded={numerator} enter={!attempt}
      groupSize={attempt ? whole / denominator : undefined} distributed={attempt ? denominator : 0}
        caption={attempt && miss ? <Caption strong>{miss}</Caption> : undefined} /></View>
  </View>;
  if (numerator === 2 && denominator === 2) return <HalvesModel />;
  return <FractionPieChart denominator={denominator} shaded={numerator} size={148} />;
}

function HalvesModel() {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const size = usePieSize();
  return <View nativeID="play-entry-model" testID="play-entry-model" style={styles.wrap}
    accessible accessibilityRole="image" accessibilityLabel={t('decimalModels.oneWhole')}>
    <TappableFractionPie size={size} denominator={2} shaded={0} enter />
    <FractionNotation numerator="?" denominator={2} compact={fontScale >= 1.5} />
  </View>;
}

const styles = StyleSheet.create({
  tape: { alignSelf: 'stretch' },
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 6 },
});
