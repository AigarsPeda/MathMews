import type { FractionMatchPuzzle } from '@/types/puzzle';
import { useFirstQuantityEncounter } from '../counting/QuantityPractice';
import { IdleHint } from '../kit/PracticeAffordances';
import { FractionNotation } from './FractionNotation';
import { TappableFractionPie, usePieSize } from './TappableFractionPie';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { useState } from 'react';

export function MatchPies({ puzzle, selected, onToggle, locked }: {
  puzzle: FractionMatchPuzzle; selected: readonly (readonly number[])[]; locked: boolean;
  onToggle: (pair: number, wedge: number) => void;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [touched, setTouched] = useState(false);
  const first = useFirstQuantityEncounter('fraction-match-wedges', !locked);
  const columns = Math.min(2, puzzle.payload.pairs.length);
  const size = usePieSize(columns);
  return <View testID="play-entry-model" nativeID="play-entry-model"
    style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
    {puzzle.payload.pairs.map(({ numerator, denominator }, index) => {
      const mask = selected[index] ?? [];
      const toggle = (wedge: number) => { if (!locked) { setTouched(true); onToggle(index, wedge); } };
      return <View key={index} accessible accessibilityRole={locked ? 'image' : 'adjustable'} style={{ alignItems: 'center', gap: 4 }}
        accessibilityLabel={`${numerator}/${denominator}`} accessibilityValue={{ min: 0, max: denominator, now: mask.length,
          text: t('fractionModels.shaded', { count: mask.length, total: denominator }) }}
        accessibilityActions={locked ? undefined : Array.from({ length: denominator }, (_, i) => ({ name: `slice-${i}`,
          label: `${i + 1} · ${t(mask.includes(i) ? 'fractionModels.remove' : 'fractionModels.add')}` }))}
        onAccessibilityAction={({ nativeEvent: { actionName } }) => { if (actionName.startsWith('slice-')) toggle(Number(actionName.slice(6))); }}>
        <TappableFractionPie size={size} denominator={denominator} shaded={mask.length} selectedSlices={mask}
          showResult={locked} onToggleSlice={toggle} enter={!locked} />
        <FractionNotation numerator={numerator} denominator={denominator} compact={fontScale >= 1.5} />
        {!locked && index === 0 ? <IdleHint movable from={{ x: size * .62, y: size * .25 }} firstEncounter={first} interacted={touched || selected.some(m => m.length > 0)} /> : null}
      </View>;
    })}
  </View>;
}
