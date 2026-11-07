/** Real diagram/answer/help components; all drafts and locale changes stay in memory. */
import { MultipleChoiceTask } from '@/components/puzzle/MultipleChoiceTask';
import { VisualHelpSheet } from '@/components/puzzle/VisualHelpSheet';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as C } from '@/constants/puzzle-theme';
import { getPuzzlesByDifficulty } from '@/constants/puzzles';
import { LocaleContext } from '@/contexts/LocaleProvider';
import type { AppLocale } from '@/types/locale';
import type { PuzzleDifficulty } from '@/types/puzzle';
import { checkPuzzleAnswer } from '@/utils/puzzle-type';
import i18n from '@/i18n';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, ScrollView, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const PREVIOUS_FAST_REFRESH = true;
const ids = ['easy-time-lesson-3-1','medium-data-lesson-3-1','easy-spatial-lesson-5-1','medium-spatial-lesson-5-1','medium-money-lesson-5-1','easy-capacity-lesson-1-1','hard-capacity-lesson-1-1','hard-time-lesson-1-1','hard-data-lesson-7-1','hard-money-lesson-5-1','medium-capacity-lesson-9-1'];
export default function EverydayFixture() {
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const [locale, setLocale] = useState<AppLocale>('en');
  const [slot, setSlot] = useState(0), [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState(''), [help, setHelp] = useState(false);
  const tier = ids[slot].split('-')[0] as PuzzleDifficulty;
  const puzzle = getPuzzlesByDifficulty(locale, tier).find(p => p.id === `v2-${ids[slot]}`)!;
  if (!__DEV__) return <Redirect href="/" />;
  const changeLocale = async (next: AppLocale) => { setLocale(next); await language.changeLanguage(next); };
  const control = (label: string, id: string, onPress: () => void, disabled = false) => <Pressable testID={id} accessibilityRole="button" onPress={onPress} disabled={disabled} style={{ minHeight: 48, padding: 12, justifyContent: 'center' }}><Text>{label}</Text></Pressable>;
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: changeLocale }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background, width: locale === 'en' ? '100%' : 320, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row' }}>
        {control('Next', 'pilot-next', () => { setSlot((slot + 1) % ids.length); setChoice(null); setResult(''); })}
        {control('Language', 'pilot-language', () => { void changeLocale(locale === 'en' ? 'lv' : locale === 'lv' ? 'ru' : 'en'); })}
        {control('Picture help', 'pilot-help', () => setHelp(true))}
      </View>
      <ScrollView key={`${slot}-${locale}`} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 24, lineHeight: 32, fontWeight: '900', color: C.text }}>{puzzle.question}</Text>
        {puzzle.type === 'multiple_choice' ? <MultipleChoiceTask puzzle={puzzle} selectedIndex={choice} answered={result === 'Correct'} incorrectAttempt={result === 'Try again'} isCorrect={result === 'Correct'} onSelect={index => { setChoice(index); setResult(''); }} /> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 20 }}><Text>{result || 'Ready'}</Text>
        {control('Check', 'pilot-check', () => setResult(choice !== null && checkPuzzleAnswer(puzzle, { kind: 'choice', index: choice }) ? 'Correct' : 'Try again'), choice === null || result === 'Correct')}
      </View>
      <VisualHelpSheet puzzle={puzzle} visible={help} cost={0} coins={0} unlocked onPurchase={() => true} onClose={() => setHelp(false)} />
    </SafeAreaView>
  </LocaleContext.Provider></I18nextProvider>;
}
