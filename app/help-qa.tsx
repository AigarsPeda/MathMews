/** Temporary design-review screen: opens picture help for one puzzle. No progress is written. */
import { PuzzleFixtureLocale, fixtureLocale } from '@/components/dev/PuzzleFixtureLocale';
import { VisualHelpSheet } from '@/components/puzzle/VisualHelpSheet';
import { getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES } from '@/constants/puzzles';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

export default function HelpReviewFixture() {
  const { example, locale: requestedLocale } = useLocalSearchParams<{ example?: string; locale?: string }>();
  const locale = fixtureLocale(requestedLocale);
  const puzzle = PUZZLE_DIFFICULTIES.flatMap(level => getPuzzlesByDifficulty(locale, level)).find(p => p.id === example);
  if (!__DEV__) return <Redirect href="/" />;
  return <PuzzleFixtureLocale key={locale} locale={locale}><View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
    {puzzle ? <VisualHelpSheet key={puzzle.id} visible puzzle={puzzle} cost={0} coins={999} unlocked onClose={() => {}} onPurchase={() => true} /> : null}
  </View></PuzzleFixtureLocale>;
}
