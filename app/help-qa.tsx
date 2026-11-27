/** Temporary design-review screen: opens picture help for one puzzle. No progress is written. */
import { PuzzleFixtureLocale, fixtureLocale } from '@/components/dev/PuzzleFixtureLocale';
import { VisualHelpSheet } from '@/components/puzzle/VisualHelpSheet';
import { getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES } from '@/constants/puzzles';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

export default function HelpReviewFixture() {
  const { example, locale: requestedLocale, play, reopen } = useLocalSearchParams<{ example?: string; locale?: string; play?: string; reopen?: string }>();
  // Dev only: `reopen=<seconds>` closes the one mounted sheet after that long, then opens it again 3 s later, as Play's "?" does.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const after = Number(reopen);
    if (!after) return;
    const timers = [setTimeout(() => setVisible(false), after * 1000), setTimeout(() => setVisible(true), after * 1000 + 3000)];
    return () => timers.forEach(clearTimeout);
  }, [reopen]);
  const locale = fixtureLocale(requestedLocale);
  const puzzle = PUZZLE_DIFFICULTIES.flatMap(level => getPuzzlesByDifficulty(locale, level)).find(p => p.id === example);
  if (!__DEV__) return <Redirect href="/" />;
  return <PuzzleFixtureLocale key={locale} locale={locale}><View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
    {puzzle ? <VisualHelpSheet key={`${puzzle.id}:${play}`} visible={visible} puzzle={puzzle} cost={0} coins={999} unlocked onClose={() => {}} onPurchase={() => true} /> : null}
  </View></PuzzleFixtureLocale>;
}
