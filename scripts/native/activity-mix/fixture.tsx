/** Real response controls and grading with disposable drafts. Never writes a player save. */
import { PuzzleButton } from '@/components/puzzle/PuzzleButton';
import { PuzzleCard } from '@/components/puzzle/PuzzleCard';
import { PuzzleResponseTask } from '@/components/puzzle/PuzzleResponseTask';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as C } from '@/constants/puzzle-theme';
import { getPuzzlesByDifficulty } from '@/constants/puzzles';
import { LocaleContext } from '@/contexts/LocaleProvider';
import type { Puzzle } from '@/types/puzzle';
import type { AppLocale } from '@/types/locale';
import { getPuzzleDraftAnswer } from '@/utils/puzzle-attempt';
import { checkPuzzleAnswer } from '@/utils/puzzle-type';
import { shufflePuzzleChoices } from '@/utils/puzzle-practice';
import type { ResponseValue } from '@/utils/puzzle-response';
import i18n from '@/i18n';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, ScrollView, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const PREVIOUS_FAST_REFRESH = true;
const empty = { choice: null, operators: [], shaded: 0, numberLine: null, pairIndices: [], order: [], matchedCount: 0, pairs: [], challenge: null };
const cases: ((p: Puzzle) => boolean)[] = [
  p => p.type === 'multiple_choice' && p.topic === 'addition' && p.response?.kind === 'write',
  p => p.response?.kind === 'write' && p.response.format === 'clock',
  p => p.type === 'multiple_choice' && p.everyday?.model.kind === 'money' && p.response?.kind === 'write' && p.response.answer.includes('.'),
  p => p.type === 'geometry_measure' && p.response?.kind === 'judge',
  p => p.type === 'coordinate_map' && p.response?.kind === 'choose',
  p => p.type === 'decimal_place_value' && p.response?.kind === 'choose',
  p => p.type === 'place_value' && p.response?.kind === 'choose',
  p => p.type === 'equation_board' && p.response?.kind === 'choose',
  p => p.type === 'ratio_table' && p.response?.kind === 'choose',
];
export default function ActivityMixFixture() {
  const [step, setStep] = useState(0), [value, setValue] = useState<ResponseValue>(null);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const locale = (['en', 'lv', 'ru'] as const)[Math.floor(step / cases.length)];
  const [readyCase, setReadyCase] = useState(-1);
  const [correct, setCorrect] = useState(false), [lastWrong, setLastWrong] = useState<string | null>(null);
  useEffect(() => {
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  useEffect(() => { void language.changeLanguage(locale).then(() => setReadyCase(step)); }, [language, locale, step]);
  const raw = ['easy', 'medium', 'hard'].flatMap(d => getPuzzlesByDifficulty(locale, d as 'easy' | 'medium' | 'hard')).find(cases[step % cases.length])!;
  const puzzle = shufflePuzzleChoices(raw, 'native-mix'), r = puzzle.response!;
  const draft = getPuzzleDraftAnswer(puzzle, { ...empty, response: value });
  const key = JSON.stringify(draft), ready = readyCase === step;
  const t = language.t.bind(language);
  const answer = r.kind === 'write' ? r.answer : r.kind === 'choose' ? t('play.answerLabel', { answer: r.options[r.correctIndex] }) : t(`puzzleTypes.${r.isCorrect ? 'trueLabel' : 'falseLabel'}`);
  const next = () => { setValue(null); setCorrect(false); setLastWrong(null); setStep(s => (s + 1) % (cases.length * 3)); };
  if (!__DEV__) return <Redirect href="/" />;
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: async (_: AppLocale) => {} }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background, width: locale === 'en' ? '100%' : 320, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row' }}><Pressable testID="mix-next" accessibilityRole="button" onPress={next} style={{ minHeight: 44, padding: 10 }}><Text>Next example</Text></Pressable><Pressable testID="mix-focus" accessibilityRole="button" onPress={() => { setValue(null); setCorrect(false); setLastWrong(null); setStep(21); }} style={{ minHeight: 44, padding: 10 }}><Text>Review wording</Text></Pressable></View>
      {ready ? <>
        <Text testID="mix-case" style={{ position: 'absolute', width: 1, height: 1, color: 'transparent' }}>{JSON.stringify({ index: String(step), kind: r.kind, format: r.kind === 'write' ? r.format : '', answer, check: t('play.checkAnswer'), locale })}</Text>
        <ScrollView key={step} contentContainerStyle={{ padding: 22, gap: 12 }}>
          <PuzzleCard puzzle={r.prompt ? { ...puzzle, question: r.prompt } : puzzle} />
          <PuzzleResponseTask puzzle={puzzle} value={value} onChange={setValue} answered={correct} incorrectAttempt={lastWrong === key} isCorrect={correct} />
          {correct ? <Text testID="mix-correct">Correct</Text> : null}
        </ScrollView>
        <View style={{ padding: 20 }}><PuzzleButton label={t('play.checkAnswer')} accessibilityLabel={t('play.checkAnswer')} disabled={correct || !draft || key === lastWrong} onPress={() => { if (!draft || correct || key === lastWrong) return; if (checkPuzzleAnswer(puzzle, draft)) setCorrect(true); else setLastWrong(key); }} /></View>
      </> : null}
    </SafeAreaView>
  </LocaleContext.Provider></I18nextProvider>;
}
