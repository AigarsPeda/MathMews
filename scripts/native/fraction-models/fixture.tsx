/** Real boards and shared grading with isolated drafts. Never writes player progress. */
import { FractionNumberLineTask } from '@/components/puzzle/FractionNumberLineTask';
import { FractionStripTask } from '@/components/puzzle/FractionStripTask';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { PUZZLE_PATHS } from '@/constants/puzzle-path';
import { getPuzzlesByDifficulty } from '@/constants/puzzles';
import i18n from '@/i18n';
import type { FractionStripState } from '@/utils/fraction-models';
import { getPuzzleDraftAnswer } from '@/utils/puzzle-attempt';
import { checkPuzzleAnswer } from '@/utils/puzzle-type';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, ScrollView, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PREVIOUS_FAST_REFRESH = true;
const scenarios: [string, number][] = [
  ['easy-fractions-pictures', 0], ['easy-fractions-pictures', 1], ['easy-fractions-pictures', 3],
  ['easy-fractions-explore-6', 0], ['medium-fractions-equivalent', 1], ['medium-fractions-equivalent', 0],
  ['easy-fractions-explore-3', 9],
];
export default function FractionFixture() {
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const [locale, setLocale] = useState<'en' | 'lv'>('en');
  const [slot, setSlot] = useState(0);
  const [point, setPoint] = useState<number | null>(null);
  const [strip, setStrip] = useState<FractionStripState | null>(null);
  const [result, setResult] = useState('');
  const [lessonId, step] = scenarios[slot], lesson = PUZZLE_PATHS.find(l => l.id === lessonId)!;
  const puzzle = getPuzzlesByDifficulty(locale, lesson.difficulty).find(p => p.id === lesson.levels[step].puzzleIds[0])!;
  if (!__DEV__) return <Redirect href="/" />;
  const answer = getPuzzleDraftAnswer(puzzle, { fractionStrip: strip, numberLine: point, choice: null, operators: [], shaded: 0, pairIndices: [], order: [], matchedCount: 0, pairs: [], challenge: null });
  const reset = () => { setPoint(null); setStrip(null); setResult(''); };
  const control = (label: string, id: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" testID={id} disabled={disabled} onPress={action} style={{ padding: 12, minHeight: 48 }}><Text>{label}</Text></Pressable>;
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, width: locale === 'lv' ? 320 : '100%', alignSelf: 'center' }}>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {control('Next', 'pilot-next', () => { setSlot((slot + 1) % scenarios.length); reset(); })}
      {control(locale === 'en' ? 'Latviski' : 'English', 'pilot-language', () => { const next = locale === 'en' ? 'lv' : 'en'; void language.changeLanguage(next); setLocale(next); })}
      {control('Again', 'pilot-again', reset)}
    </View>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: Colors.text }}>{puzzle.question}</Text>
      {puzzle.type === 'fraction_number_line' ? <FractionNumberLineTask key={`${slot}-${locale}`} puzzle={puzzle} value={point}
        onChange={n => { setPoint(n); setResult(''); }} answered={result === 'Correct'} /> : null}
      {puzzle.type === 'fraction_strip' ? <FractionStripTask key={`${slot}-${locale}`} puzzle={puzzle} value={strip}
        onChange={next => { setStrip(next); setResult(''); }} answered={result === 'Correct'} /> : null}
    </ScrollView>
    <View style={{ paddingHorizontal: 20 }}>
      <Text>{puzzle.type === 'fraction_number_line' ? `Point ${point ?? 'none'}` : `${strip?.parts ?? 'none'} parts ${strip?.shaded ?? 'none'} shaded`}</Text>
      <Text>{result || 'Ready'}</Text>
      {control(locale === 'en' ? 'Check' : 'Pārbaudīt', 'pilot-check', () => setResult(answer && checkPuzzleAnswer(puzzle, answer) ? 'Correct' : 'Try again'), !answer || result === 'Correct')}
    </View>
  </SafeAreaView></I18nextProvider>;
}
