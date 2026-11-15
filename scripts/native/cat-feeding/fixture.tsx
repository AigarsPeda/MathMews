/** Temporary simulator test route. All care state stays in memory. */
import { PetStage } from '@/components/pet/PetStage';
import { GameColors } from '@/constants/game';
import { catModelRegistry } from '@/pet-display/registry/cat-model-registry';
import { applyFeedBite } from '@/utils/game-operations';
import { createDefaultGameSave } from '@/utils/game-storage';
import type { GameSave } from '@/types/save';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const decorations = [{ instanceId: 'feeding-test-bowl', decorationId: 'bowlBlue', offset: { x: .35, y: .2 } }];
const home = { x: -.2, y: .1 };
const playback = { kind: 'segment' as const, mood: 'idle' as const, segment: catModelRegistry.getSegment('idle') };
const worldClock = { worldMs: 12 * 3600000, realMs: 1, speed: 0, weather: 'clear' as const };
function initialSave(): GameSave {
  const save = createDefaultGameSave();
  return { ...save, pet: { ...save.pet, name: 'Feeding test', isAsleep: false,
    stats: { ...save.pet.stats, hunger: 20, happiness: 50 } } };
}

export default function FeedingFixture() {
  const router = useRouter();
  const [save, setSave] = useState(initialSave);
  const current = useRef(save);
  const [revision, setRevision] = useState(0);
  const [ledger, setLedger] = useState<number[]>([]);
  const [active, setActive] = useState(false);
  const stop = useRef<() => void>(() => {});
  const onActivity = useCallback((running: boolean, returnHome: () => void) => {
    stop.current = returnHome;
    setActive(running);
  }, []);
  const onFeed = useCallback((finished: boolean, amount: number) => {
    const next = applyFeedBite(current.current, finished, Date.now(), amount);
    if (!next) return;
    current.current = next;
    setSave(next);
    setLedger(values => [...values, Math.round(next.pet.stats.hunger)]);
  }, []);
  const interact = useCallback(() => {
    const now = Date.now();
    current.current = { ...current.current, pet: { ...current.current.pet, lastInteractionAt: now } };
    setSave(current.current);
    return now;
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: GameColors.background }}>
    <View style={{ padding: 12, gap: 8 }}>
      <Text accessibilityRole="header">Feeding simulator test</Text>
      <Text>In-memory cat. Tap the bowl and choose Eat.</Text>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset fullness to 20 percent"
          style={{ padding: 10, backgroundColor: GameColors.card }} onPress={() => {
            stop.current(); current.current = initialSave(); setSave(current.current); setLedger([]); setRevision(n => n + 1);
          }}><Text>Reset 20%</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Interrupt feeding"
          style={{ padding: 10, backgroundColor: GameColors.card }} onPress={() => stop.current()}><Text>Interrupt</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit feeding test"
          style={{ padding: 10, backgroundColor: GameColors.card }} onPress={() => router.replace('/')}><Text>Exit</Text></Pressable>
      </View>
      <Text testID="feeding-test-ledger">{`Bites ${ledger.length}: ${[20, ...ledger].join(' → ')}`}</Text>
      <Text testID="feeding-test-activity">{active ? 'Activity running' : 'Activity stopped'}</Text>
    </View>
    <PetStage key={revision} compact name="Feeding test" petType="cat" catSkinId="orange"
      stats={save.pet.stats} wisdom={0} homeRoomId="livingRoom" catHomeRoomId="livingRoom"
      roomId="room1" roomPetOffset={home} placedDecorations={decorations} worldClock={worldClock}
      lastInteractionAt={save.pet.lastInteractionAt} playback={playback} onFeed={onFeed}
      onRoomInteraction={interact} onPetPress={interact} onRoomActivityChange={onActivity}/>
  </SafeAreaView>;
}
