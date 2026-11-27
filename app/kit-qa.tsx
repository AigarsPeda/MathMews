/** Temporary design-review screen: shared puzzle kit and answer-feedback states, cycling. */
import { ChoiceButton } from '@/components/puzzle/ChoiceButton';
import { ModelTray, NumberTile, ResultMark, UnknownWell, ValueChip } from '@/components/puzzle/kit/PuzzleKit';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink } from '@/constants/puzzle-theme';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PHASES = ['idle', 'selected', 'correct', 'idle', 'selected', 'wrong'] as const;

export default function KitReviewFixture() {
  const [phase, setPhase] = useState(0);
  useEffect(() => { const t = setInterval(() => setPhase(p => (p + 1) % PHASES.length), 1400); return () => clearInterval(t); }, []);
  if (!__DEV__) return <Redirect href="/" />;
  const state = PHASES[phase];
  const label = (s: string) => <Text style={{ color: Ink.soft, fontSize: 14, fontWeight: '700' }}>{s}</Text>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: Ink.text }}>Answer feedback: {state}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['12', '13', '14'].map((v, i) => <ChoiceButton key={v} label={v} style={{ flex: 1 }}
          selected={i === 1 && state !== 'idle'} disabled={state === 'correct' || state === 'wrong'}
          result={i === 1 && (state === 'correct' || state === 'wrong') ? state : null} onPress={() => {}} />)}
      </View>
      {label('Given value · unknown (passive) · unknown (active) · filled')}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <ValueChip label="24" /><UnknownWell /><UnknownWell active /><UnknownWell filled label="7" />
        <ValueChip label="3/8" tone="violet" /><ValueChip label="0.4" tone="amber" />
      </View>
      {label('Number tiles: idle · selected · disabled')}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <NumberTile label="+" /><NumberTile label="−" selected /><NumberTile label="×" disabled /><NumberTile label="18" />
      </View>
      {label('Model tray with result marks')}
      <ModelTray style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <ResultMark kind="correct" size={24} /><ResultMark kind="wrong" size={24} />
        <Text style={{ color: Ink.text, fontSize: 18, fontWeight: '700' }}>Flat tray — never pressable</Text>
      </ModelTray>
    </ScrollView>
  </SafeAreaView>;
}
