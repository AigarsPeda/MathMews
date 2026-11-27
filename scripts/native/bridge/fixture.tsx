/** Real boards and shared grading with isolated drafts. Never writes player progress. */
import { BridgeTask } from '@/components/puzzle/BridgeTask';
import { isBridgePuzzle, type BridgeState } from '@/utils/bridge-models';
import type { PuzzleDifficulty } from '@/types/puzzle';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { getPuzzlesByDifficulty } from '@/constants/puzzles';
import i18n from '@/i18n';
import { getPuzzleDraftAnswer } from '@/utils/puzzle-attempt';
import { checkPuzzleAnswer } from '@/utils/puzzle-type';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, ScrollView, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PREVIOUS_FAST_REFRESH = true;
// Each case exercises a particular board and solution, independent of lesson ordering.
const scenarios: [PuzzleDifficulty, string][] = [
  ['easy', 'v2-easy-multiplication-explore-8-1'], ['easy', 'v2-easy-numbers-explore-8-1'],
  ['easy', 'v2-easy-addition-explore-8-1'], ['easy', 'v2-easy-numbers-explore-9-1'],
  ['medium', 'v2-medium-multiplication-explore-8-1'], ['medium', 'v2-medium-subtraction-explore-8-1'],
  ['medium', 'v2-medium-addition-explore-8-4'], ['medium', 'v2-medium-operations-explore-9-1'],
  ['hard', 'v2-hard-measurement-explore-8-1'], ['hard', 'v2-hard-operations-explore-8-1'],
  ['hard', 'v2-hard-operations-explore-9-1'], ['hard', 'v2-hard-measurement-explore-9-1'],
  ['medium', 'v2-medium-subtraction-lesson-8-boss-3'], ['hard', 'v2-hard-measurement-explore-9-4'],
];
export default function BridgeFixture() {
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const [locale, setLocale] = useState<'en' | 'lv' | 'ru'>('en');
  const [slot, setSlot] = useState(0);
  const [point, setPoint] = useState<BridgeState | null>(null);
  const [result, setResult] = useState('');
  const [difficulty, id] = scenarios[slot];
  const puzzle = getPuzzlesByDifficulty(locale, difficulty).find(candidate => candidate.id === id)!;
  if (!__DEV__) return <Redirect href="/" />;
  const answer = getPuzzleDraftAnswer(puzzle, { bridge: point, numberLine: null, choice: null, operators: [], shaded: 0, pairIndices: [], order: [], matchedCount: 0, pairs: [], challenge: null });
  const reset = () => { setPoint(null); setResult(''); };
  const control = (label: string, id: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" testID={id} disabled={disabled} onPress={action} style={{ padding: 12, minHeight: 48 }}><Text>{label}</Text></Pressable>;
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, width: locale !== 'en' ? 320 : '100%', alignSelf: 'center' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
      {control('Next', 'pilot-next', () => { const next=(slot+1)%scenarios.length; const difficulty=scenarios[next][0]; const lang=({easy:'en',medium:'lv',hard:'ru'} as const)[difficulty]; void language.changeLanguage(lang); setLocale(lang); setSlot(next); reset(); })}
      {control(locale === 'en' ? 'Latviski' : locale === 'lv' ? 'Русский' : 'English', 'pilot-language', () => { const next = locale === 'en' ? 'lv' : locale === 'lv' ? 'ru' : 'en'; void language.changeLanguage(next); setLocale(next); })}
      {control('Again', 'pilot-again', reset)}
    </View>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: Colors.text }}>{puzzle.question}</Text>
      {isBridgePuzzle(puzzle) ? <BridgeTask key={`${slot}-${locale}`} puzzle={puzzle} value={point}
        onChange={n => { setPoint(n); setResult(''); }} answered={result === 'Correct'} /> : null}
    </ScrollView>
    <View style={{ paddingHorizontal: 20 }}>
      <Text>{`Answer ${JSON.stringify(point)}`}</Text>
      <Text>{result || 'Ready'}</Text>
      {control(locale === 'en' ? 'Check' : locale === 'lv' ? 'Pārbaudīt' : 'Проверить', 'pilot-check', () => setResult(answer && checkPuzzleAnswer(puzzle, answer) ? 'Correct' : 'Try again'), !answer || result === 'Correct')}
    </View>
  </SafeAreaView></I18nextProvider>;
}
