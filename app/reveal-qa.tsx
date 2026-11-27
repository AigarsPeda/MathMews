import { CountingAnnouncementLog } from '@/components/dev/CountingAnnouncementLog';
import { PuzzleFixtureLocale, fixtureLocale } from '@/components/dev/PuzzleFixtureLocale';
import { CheckedPuzzleReveal } from '@/components/puzzle/CheckedPuzzleReveal';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES } from '@/constants/puzzles';
import type { Puzzle } from '@/types/puzzle';
import { effectivePuzzlePrompt, freezeCheckedAttempt } from '@/utils/checked-attempt';
import { puzzleQADraft, type QAOutcome } from '@/utils/puzzle-qa-draft';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const noop = () => {};
function Fixture({ puzzle, outcome }: { puzzle: Puzzle; outcome: QAOutcome }) {
  const { t } = useTranslation();
  const snapshot = useMemo(() => {
    const fixture = puzzleQADraft(puzzle, outcome);
    return fixture && freezeCheckedAttempt(puzzle, effectivePuzzlePrompt(puzzle, t), fixture.draft, fixture.answer, fixture.arrangement, fixture.correct);
  }, [puzzle, outcome, t]);
  return snapshot ? <>
    <Text accessibilityRole="text" style={{ color: '#526176', fontSize: 14 }}>{t('reveal.checkedExample')}</Text>
    <CheckedPuzzleReveal snapshot={snapshot} mode={snapshot.correct ? 'worked' : 'attempt'} onSolutionShown={noop} />
  </> :
    <Text>{outcome === 'wrong' ? 'This puzzle has no incorrect Check submission.' : 'No reveal for this puzzle.'}</Text>;
}

export default function RevealReviewFixture() {
  const { example, locale: requestedLocale, autoAnswer, countingLog } = useLocalSearchParams<{ example?: string; locale?: string; autoAnswer?: string; countingLog?: string }>();
  const locale = fixtureLocale(requestedLocale);
  if (!__DEV__) return <Redirect href="/" />;
  const puzzle = PUZZLE_DIFFICULTIES.flatMap(level => getPuzzlesByDifficulty(locale, level)).find(p => p.id === example);
  if (!puzzle) return <Text>No reveal for this puzzle.</Text>;
  return <PuzzleFixtureLocale key={locale} locale={locale}><SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <ScrollView testID="checked-fixture" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Fixture key={puzzle.id + autoAnswer} puzzle={puzzle} outcome={autoAnswer === 'wrong' ? 'wrong' : 'correct'} />
    </ScrollView>
    {countingLog === '1' && <CountingAnnouncementLog />}
  </SafeAreaView></PuzzleFixtureLocale>;
}
