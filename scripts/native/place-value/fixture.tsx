/** Production board and grading; isolated state never writes player progress. */
import { PlaceValueTask } from '@/components/puzzle/PlaceValueTask';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { getPuzzlesByDifficulty } from '@/constants/puzzles';
import i18n from '@/i18n';
import { initialPlaceValue, type PlaceValueState } from '@/utils/place-value';
import { checkPuzzleAnswer } from '@/utils/puzzle-type';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, ScrollView, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PREVIOUS_FAST_REFRESH = true;
export default function PlaceValueFixture() {
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const [locale, setLocale] = useState<'en' | 'lv'>('en');
  const [slot, setSlot] = useState(0);
  const [value, setValue] = useState<PlaceValueState | null>(null);
  const [result, setResult] = useState('');
  const ids = ['v2-medium-addition-tens-1', 'v2-medium-addition-tens-2', 'v2-medium-addition-tens-3', 'v2-medium-subtraction-parts-2', 'v2-medium-subtraction-parts-3', 'v2-medium-subtraction-parts-4'];
  const puzzle = getPuzzlesByDifficulty(locale, 'medium').find(p => p.id === ids[slot]);
  if (!__DEV__ || puzzle?.type !== 'place_value') return <Redirect href="/" />;
  const state = value ?? initialPlaceValue(puzzle);
  const control = (label: string, id: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" testID={id} disabled={disabled} onPress={action} style={{ padding: 12, minHeight: 48 }}><Text>{label}</Text></Pressable>;
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, width: locale === 'lv' ? 320 : '100%', alignSelf: 'center' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 16 }}>
      {control('Next', 'pilot-next', () => { setSlot((slot + 1) % ids.length); setValue(null); setResult(''); })}
      {control(locale === 'en' ? 'Latviski' : 'English', 'pilot-language', () => { const next = locale === 'en' ? 'lv' : 'en'; void language.changeLanguage(next); setLocale(next); })}
    </View>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: Colors.text }}>{puzzle.question}</Text>
      <PlaceValueTask key={`${slot}-${locale}`} puzzle={puzzle} value={value} onChange={next => { setValue(next); setResult(''); }} answered={result === 'Correct'} />
    </ScrollView>
    <View style={{ paddingHorizontal: 20 }}>
      <Text testID="pilot-state">{`${state.tens} tens ${state.ones} ones`}</Text>
      <Text>{result || 'Ready'}</Text>
      {control(locale === 'en' ? 'Check' : 'Pārbaudīt', 'pilot-check', () => setResult(checkPuzzleAnswer(puzzle, { kind: 'place_value', state }) ? 'Correct' : 'Try again'), !value || result === 'Correct')}
    </View>
  </SafeAreaView></I18nextProvider>;
}
