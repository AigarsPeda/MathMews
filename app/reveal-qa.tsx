/** Temporary design-review screen: plays the solution reveal for one puzzle. No progress is written. */
import { DecimalReveal } from '@/components/puzzle/DecimalReveal';
import { EverydayDiagram } from '@/components/puzzle/EverydayDiagram';
import { FractionReveal } from '@/components/puzzle/FractionReveal';
import { GeometryMeasureTask } from '@/components/puzzle/GeometryMeasureTask';
import { NumberLineReveal } from '@/components/puzzle/NumberLineReveal';
import { PercentageReveal } from '@/components/puzzle/PercentageReveal';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { QuantityTaskScene } from '@/components/puzzle/QuantityTaskScene';
import { RatioReveal } from '@/components/puzzle/RatioReveal';
import { getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES } from '@/constants/puzzles';
import { fractionRevealPlan } from '@/utils/fraction-reveal';
import { numberLineRoute } from '@/utils/number-line-reveal';
import { percentageRevealPlan } from '@/utils/percentage-reveal';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const noop = () => {};

export default function RevealReviewFixture() {
  const { example } = useLocalSearchParams<{ example?: string }>();
  const puzzle = PUZZLE_DIFFICULTIES.flatMap(level => getPuzzlesByDifficulty('en', level)).find(p => p.id === example);
  if (!__DEV__) return <Redirect href="/" />;
  if (!puzzle) return null;
  const route = numberLineRoute(puzzle);
  const percent = percentageRevealPlan(puzzle, null);
  const fraction = fractionRevealPlan(puzzle);
  let reveal = null;
  if (route) reveal = <NumberLineReveal route={route} onSolutionShown={noop} />;
  else if (puzzle.type === 'ratio_table') reveal = <RatioReveal puzzle={puzzle} onSolutionShown={noop} />;
  else if (percent) reveal = <PercentageReveal plan={percent} onSolutionShown={noop} />;
  else if (puzzle.type === 'decimal_grid' || puzzle.type === 'decimal_place_value') reveal = <DecimalReveal puzzle={puzzle} onSolutionShown={noop} />;
  else if (fraction) reveal = <FractionReveal plan={fraction} onSolutionShown={noop} />;
  else if (puzzle.type === 'geometry_measure') reveal = <GeometryMeasureTask puzzle={puzzle} value={null} onChange={noop} answered onSolutionShown={noop} />;
  else if (puzzle.type === 'multiple_choice' && puzzle.everyday) reveal = <EverydayDiagram model={puzzle.everyday.model} onSolutionShown={noop} />;
  else if (puzzle.type === 'multiple_choice' && puzzle.taskVisual) reveal = <QuantityTaskScene model={puzzle.taskVisual} disabled onSolutionShown={noop} showExpression />;
  return <SafeAreaView key={puzzle.id} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 22, lineHeight: 30, fontWeight: '800', color: '#24314B' }}>{puzzle.question}</Text>
      {reveal ?? <Text>No reveal for this puzzle.</Text>}
    </ScrollView>
  </SafeAreaView>;
}
