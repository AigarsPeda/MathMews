import { TappableFractionPie, usePieSize } from '@/components/puzzle/fraction/TappableFractionPie';
import { FractionNotation } from '@/components/puzzle/fraction/FractionNotation';
import { useFirstQuantityEncounter } from '@/components/puzzle/counting/QuantityPractice';
import { IdleHint } from '@/components/puzzle/kit/PracticeAffordances';
import type { FractionBuildPuzzle } from '@/types/puzzle';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

type Props = {
  puzzle: FractionBuildPuzzle;
  shadedPieces: number;
  selectedSlices: readonly number[];
  answered: boolean;
  isCorrect: boolean;
  onChangeShaded: (count: number) => void;
  onToggleSlice: (index: number) => void;
};

export function FractionBuildTask({ puzzle, shadedPieces, selectedSlices, answered, isCorrect, onChangeShaded, onToggleSlice }: Props) {
  const { t } = useTranslation();
  const { numerator, denominator, hideTarget } = puzzle.payload;
  const { fontScale } = useWindowDimensions();
  const size = usePieSize();
  const first = useFirstQuantityEncounter('fraction-build', !answered);
  const [touched, setTouched] = useState(false);
  const toggle = (index: number) => {
    if (answered) return;
    setTouched(true);
    onToggleSlice(index);
  };
  const given = hideTarget && !(answered && isCorrect) ? '?' : numerator;
  return <View style={styles.wrap}>
    <View nativeID="play-entry-model" accessible accessibilityRole={answered ? 'image' : 'adjustable'}
      accessibilityLabel={t('fractionModels.shaded', { count: shadedPieces, total: denominator })}
      accessibilityValue={{ min: 0, max: denominator, now: shadedPieces }}
      accessibilityActions={answered ? undefined : [{ name: 'increment' }, { name: 'decrement' },
        ...Array.from({ length: denominator }, (_, i) => ({ name: `slice-${i}`,
          label: `${i + 1} · ${t(selectedSlices.includes(i) ? 'fractionModels.remove' : 'fractionModels.add')}` }))]}
      onAccessibilityAction={({ nativeEvent: { actionName } }) => {
        if (answered) return;
        setTouched(true);
        if (actionName === 'increment' && shadedPieces < denominator) onChangeShaded(shadedPieces + 1);
        if (actionName === 'decrement' && shadedPieces > 0) onChangeShaded(shadedPieces - 1);
        if (actionName.startsWith('slice-')) toggle(Number(actionName.slice(6)));
      }}>
      <TappableFractionPie size={size} denominator={denominator} shaded={shadedPieces} selectedSlices={selectedSlices}
        onToggleSlice={toggle} showResult={answered} enter={!answered} />
      {!answered && <IdleHint movable firstEncounter={first} interacted={touched || shadedPieces > 0}
        from={{ x: size * (.5 + .3 * Math.sin(Math.PI / denominator)), y: size * (.5 - .3 * Math.cos(Math.PI / denominator)) }} />}
    </View>
    <FractionNotation numerator={given} denominator={denominator} compact={fontScale >= 1.5} />
  </View>;
}
const styles = StyleSheet.create({ wrap: { alignItems: 'center', gap: 4 } });
