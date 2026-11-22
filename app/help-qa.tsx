/** Temporary design-review screen: opens picture help for one puzzle. No progress is written. */
import { VisualHelpSheet } from '@/components/puzzle/VisualHelpSheet';
import { getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES } from '@/constants/puzzles';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

export default function HelpReviewFixture() {
  const { example } = useLocalSearchParams<{ example?: string }>();
  const puzzle = PUZZLE_DIFFICULTIES.flatMap(level => getPuzzlesByDifficulty('en', level)).find(p => p.id === example);
  if (!__DEV__) return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
    {puzzle ? <VisualHelpSheet key={puzzle.id} visible puzzle={puzzle} cost={0} coins={999} unlocked onClose={() => {}} onPurchase={() => true} /> : null}
  </View>;
}
