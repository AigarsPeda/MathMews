import { QuantityTaskScene } from '@/components/puzzle/QuantityTaskScene';
import { PlaceValueTask } from '@/components/puzzle/PlaceValueTask';
import { ResultOverlay } from '@/components/puzzle/ResultOverlay';
import { getPuzzlesByDifficulty } from '@/constants/puzzles';
import { PuzzleColors as C } from '@/constants/puzzle-theme';
import { initialPlaceValue, type PlaceValueState } from '@/utils/place-value';
import i18n from '@/i18n';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, ScrollView, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const PREVIOUS_FAST_REFRESH = true;
export default function MotionFixture() {
  useEffect(() => {
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const [slot, setSlot] = useState(0), [value, setValue] = useState<PlaceValueState | null>(null);
  const [result, setResult] = useState(false), [continued, setContinued] = useState(0);
  const puzzle = getPuzzlesByDifficulty('en', 'medium').find(p => p.id === 'v2-medium-addition-tens-2')!;
  if (!__DEV__ || puzzle.type !== 'place_value') return <Redirect href="/" />;
  const state = value ?? initialPlaceValue(puzzle);
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
    <View style={{ flexDirection: 'row', padding: 12 }}>
      <Pressable accessibilityRole="button" testID="pilot-next" onPress={() => setSlot((slot + 1) % 2)} style={{ padding: 12 }}><Text>Next</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setResult(true)} style={{ padding: 12 }}><Text>Corrected result</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text>{`Scene ${slot}`}</Text>
      {slot === 0 ? <QuantityTaskScene model={{ kind: 'share', items: 8, groups: 3, object: 'cookie' }} disabled={false} /> : null}
      {slot === 1 ? <><PlaceValueTask puzzle={puzzle} value={value} onChange={setValue} answered={false} /><Text>{`${state.tens} tens ${state.ones} ones`}</Text></> : null}
      <Text>{`Continued ${continued}`}</Text>
    </ScrollView>
    {result ? <ResultOverlay visible correct petType="cat" petMood="correct" catReaction="puzzleProud" petName="Minka"
      encouragement="You found a new way and corrected it. We did it." message="Well done" detail="25 = 2 tens + 5 ones."
      continueLabel="Continue now" onContinue={() => { setResult(false); setContinued(n => n + 1); }} /> : null}
  </SafeAreaView></I18nextProvider>;
}
