/** Installed only for capture-real-cat.mjs; never part of the release route tree. */
import { NativeRoomScene } from '@/components/pet/native/NativeRoomScene';
import { NativeCatDisplay } from '@/components/pet/native/NativeCatDisplay';
import { useRoomActivity } from '@/hooks/use-room-activity';
import { buildNativeRoomWorld, type NativeTravel, type Vec3 } from '@/utils/native-room-world';
import { roomActivityStepKey, type RoomActivityKind } from '@/utils/room-activities';
import { catModelRegistry, createRoomActivitySegment, createPuzzleReactionSegment } from '@/pet-display/registry/cat-model-registry';
import type { PuzzleCatReaction } from '@/constants/puzzle-cat-reactions';
import { ROOM_CAT_SIZE, ROOM_OBJECT_SCALE } from '@/constants/room-scale';
import { moderateScale } from '@/utils/scale';
import type { PlacedDecoration, PlacedToy } from '@/types/game';
import type { PawObjectTarget } from '@/utils/native-paw-contact';
import type { WorldClock } from '@/utils/world-clock';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, PixelRatio, Pressable, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
const PREVIOUS_FAST_REFRESH = true;
const WIDTH = Dimensions.get('window').width, HEIGHT = 500, TOP = 130;
const homeOffset = { x: 0, y: .12 };
// Store-size furnishings in a reproducible, uncluttered room. No saved game writes.
const decorations: PlacedDecoration[] = [
  { instanceId: 'sofa', decorationId: 'sofaBlueClassic', offset: { x: -.35, y: -.10 }, scale: 1.5 },
  { instanceId: 'bowl', decorationId: 'bowlBlue', offset: { x: .55, y: .32 } },
  { instanceId: 'left', decorationId: 'plantPotted', offset: { x: -.65, y: .12 } },
  { instanceId: 'window', decorationId: 'windowRoundPorthole', offset: { x: .25, y: -.45 } },
];
const toys: PlacedToy[] = [{ instanceId: 'ball', toyId: 'blueBall', offset: { x: .25, y: .43 } }];
type Command = { id: number; kind: string; target?: string; heading?: number; reaction?: PuzzleCatReaction };
export default function CaptureRoute() {
  const params = useLocalSearchParams<{ run: string; port: string; coat?: string; period?: string; zoom?: string; mode?: string }>();
  if (!__DEV__ || !params.run || !/^\d+$/.test(params.port ?? '')) return <Redirect href="/"/>;
  return <Capture key={params.run} {...params}/>;
}
export function CatCapturePreview() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Capture run="manual" port="0" interactive />;
}
function Capture({ interactive = false, run, port, coat = 'orange', period = 'day', zoom: zoomText = '1', mode = 'room' }: {
  interactive?: boolean; run: string; port: string; coat?: string; period?: string; zoom?: string; mode?: string;
}) {
  const router = useRouter();
  const zoom = Math.min(3, Math.max(1, Number(zoomText)));
  const endpoint = `http://127.0.0.1:${port}`;
  const events = useRef<object[]>([]);
  const emit = useCallback((type: string, data: object = {}) => {
    if (!interactive) events.current.push({ type, at: Date.now(), ...data });
  }, [interactive]);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState<{ id: number; travel: NativeTravel }>();
  const [reaction, setReaction] = useState<PuzzleCatReaction>();
  const [lastInteraction, setLastInteraction] = useState(() => Date.now());
  const world = useMemo(() => buildNativeRoomWorld({ width: WIDTH, height: HEIGHT,
    petSize: moderateScale(ROOM_CAT_SIZE), sizeScale: moderateScale(100) / 100 * ROOM_OBJECT_SCALE,
    homeOffset, decorations, toys }), []);
  const clock = useMemo<WorldClock>(() => ({ worldMs: (period === 'night' ? 23 : 12) * 3600000,
    realMs: 1, speed: 0, weather: 'clear' }), [period]);
  const options = useMemo(() => ({ nativeWorld: world, nativeStepCompletion: true,
    homeRoomId: 'livingRoom' as const, width: WIDTH, height: HEIGHT,
    petSize: moderateScale(ROOM_CAT_SIZE), sizeScale: moderateScale(100) / 100 * ROOM_OBJECT_SCALE,
    homeOffset, decorations, toys, ownedToyIds: ['blueBall'], hungry: false, asleep: false,
    // Undefined keeps autonomous idle delay at 30s. The driver sends explicit requests.
  }), [world]);
  const x = useSharedValue(0), y = useSharedValue(0);
  const room = useRoomActivity(options, 65, ready && mode === 'room' && !manual, lastInteraction, x, y,
    undefined, undefined, undefined, true, true, () => emit('stopped'),
    (kind, target) => emit('completed', { kind, target }), failure => emit('blocked', failure));
  const controls = useRef(room);
  useLayoutEffect(() => { controls.current = room; }, [room]);
  const step = room.activity?.plan.steps[room.activity.stepIndex];
  const playback = useMemo(() => ({ kind: 'segment' as const, mood: step?.mood ?? 'idle',
    segment: reaction ? createPuzzleReactionSegment(reaction) : step?.animation
      ? createRoomActivitySegment(step.animation, step.reverse, step.animationFps) : catModelRegistry.getSegment(step?.mood ?? 'idle') }), [step, reaction]);
  useEffect(() => {
    emit('step', { kind: room.activity?.plan.kind ?? 'idle', index: room.activity?.stepIndex,
      animation: step?.animation ?? 'idle', reverse: step?.reverse, pose: step?.sleepPose,
      hold: step?.hold, native: step?.native });
  }, [emit, room.activity, step]);
  useEffect(() => {
    if (interactive) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    emit('mounted', { run, coat, period, zoom, mode, viewport: { width: WIDTH, height: HEIGHT, top: TOP, ratio: PixelRatio.get() }, world });
    let stopped = false, busy = false;
    let lastResponse = Date.now();
    // A killed driver cannot run its cleanup. Leave its temporary screen even
    // when a request hangs, and let the effect cleanup restore Fast Refresh.
    const watchdog = setInterval(() => {
      if (!stopped && Date.now() - lastResponse > 10000) {
        stopped = true;
        router.replace('/');
      }
    }, 1000);
    let handled = 0;
    const tick = async () => {
      if (busy || stopped) return;
      busy = true;
      const batch = events.current.splice(0);
      try {
        const response = await fetch(`${endpoint}/tick`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run, events: batch }) });
        if (!response.ok) throw new Error('Capture driver unavailable');
        const command: Command | undefined = (await response.json()).command;
        lastResponse = Date.now();
        if (stopped || !command || command.id <= handled) return;
        handled = command.id;
        emit('command', command);
        setLastInteraction(Date.now());
        if (command.kind === 'turn') {
          setManual({ id: command.id, travel: { path: [world.home], distance: 0, duration: 3,
            jump: false, heading: command.heading, awaitCompletion: true } });
        } else if (command.kind === 'reaction') setReaction(command.reaction);
        else if (command.kind === 'stop') controls.current.stopActivity();
        else if (command.kind === 'returnHome') controls.current.returnHome();
        else { setManual(undefined); controls.current.startActivity(command.kind as RoomActivityKind, command.target); }
      } catch { if (!stopped) events.current.unshift(...batch); }
      finally { busy = false; }
    };
    const timer = setInterval(tick, 150); void tick();
    return () => { stopped = true; clearInterval(timer); clearInterval(watchdog); settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH); };
  }, [coat, emit, endpoint, interactive, mode, period, router, run, world, zoom]);
  const onReady = useCallback(() => { setReady(true); emit('ready'); }, [emit]);
  const onPosition = useCallback((point: { x: number; y: number; headX?: number; headY?: number }) => {
    x.set(point.x); y.set(point.y); emit('position', point);
  }, [emit, x, y]);
  const onContact = useCallback((position: Vec3, elapsed?: number, key?: string) => {
    controls.current.updateNativeHeight(position, elapsed, key);
  }, []);
  const onObject = useCallback((id: string, _point: { x: number; y: number }, center?: Vec3) => {
    if (center) controls.current.updateObjectPosition(id, center);
  }, []);
  const onComplete = useCallback((key: string, position: Vec3, motion?: import('@/utils/native-cat-locomotion').CatTravelMotion, toy?: PawObjectTarget) => {
    emit('native-complete', { key, position, motion, toy }); controls.current.completeNativeStep(key, position, motion, toy);
  }, [emit]);
  return <View style={{ flex: 1, backgroundColor: '#FFF5EB' }}>
    <Text style={{ position: 'absolute', top: interactive ? 10 : 65, left: 18, color: '#51473D', fontSize: 13 }}>{`${interactive ? 'Cat preview' : 'Capture QA'} · ${coat} · ${period} · ${zoom}×`}</Text>
    {interactive ? <View style={{ position: 'absolute', top: 35, left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {(['bowlEat', 'sofaSit', 'sofaSleep', 'toyPlay', 'returnHome'] as const).map(kind =>
        <Pressable key={kind} accessibilityRole="button" style={{ padding: 10, backgroundColor: '#E8FAF8', borderRadius: 8 }}
          onPress={() => { setLastInteraction(Date.now()); if (kind === 'returnHome') room.returnHome(); else room.startActivity(kind); }}>
          <Text>{kind}</Text>
        </Pressable>)}
    </View> : <Pressable accessibilityRole="button" onPress={() => router.replace('/')}
      style={{ position: 'absolute', top: 90, left: 18, padding: 10 }}><Text>Turn off</Text></Pressable>}
    <View style={{ position: 'absolute', top: interactive ? 140 : TOP, width: WIDTH, height: HEIGHT, overflow: 'hidden' }}>
      {mode === 'portrait' ? <View style={{ alignItems: 'center', paddingTop: 100 }}>
        <NativeCatDisplay width={192} skinId={coat} playback={playback} playing onReady={onReady}/>
      </View> : <View style={{ width: WIDTH, height: HEIGHT, transform: [{ scale: zoom }] }}>
        <NativeRoomScene world={world} worldClock={clock} roomId="room1" skinId={coat} playback={playback}
          travel={manual?.travel ?? step?.native} activityKey={manual ? `turn:${manual.id}` : room.activity ? roomActivityStepKey(room.activity) : undefined}
          commandAttention={room.commandAttention} playingId={room.activity?.plan.targetInstanceId}
          playContact={step?.animation === 'batToy'} onSceneReady={onReady} onPosition={onPosition}
          onContactPosition={onContact} onObjectPosition={onObject} onRoomStepComplete={onComplete}/>
      </View>}
    </View>
  </View>;
}
