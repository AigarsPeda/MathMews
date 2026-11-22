import { countingCadence, glide } from '@/utils/puzzle-motion';
import { Canvas, Group, Oval, RoundedRect } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { PuzzleColors } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { PuzzleObjectImage } from './PuzzleObjectImage';
import { PuzzleText as Text } from './PuzzleText';

type Spot = { x: number; y: number; size: number };

// Center each row, including an incomplete last row, within the dish.
function spot(index: number, count: number, columns: number, step: number, cx: number, cy: number, size: number): Spot {
  const row = Math.floor(index / columns);
  const rowLength = Math.min(columns, count - row * columns);
  return {
    x: cx + (index % columns - (rowLength - 1) / 2) * step,
    y: cy + (row - (Math.ceil(count / columns) - 1) / 2) * step * .81,
    size,
  };
}

function Cookie({ from, to, turn, progress }: { from: Spot; to: Spot; turn: number; progress: SharedValue<number> }) {
  const motion = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value - turn));
    const slide = glide(p);
    return { transform: [
      { translateX: from.x - from.size / 2 + (to.x - from.x) * slide },
      { translateY: from.y - from.size / 2 + (to.y - from.y) * slide - Math.sin(Math.PI * p) * 9 },
      { scale: 1 + (to.size / from.size - 1) * slide },
    ] };
  });
  return <Animated.View style={[styles.cookie, { width: from.size, height: from.size }, motion]}>
    <PuzzleObjectImage object="cookie" />
  </Animated.View>;
}

export function CookieSharingBoard({ items, plates, disabled, onUseHelp }: {
  items: number; plates: number; disabled: boolean; onUseHelp?: () => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const { active, reduceMotion } = useAnimationActivity();
  const progress = useSharedValue(0);
  const each = Math.floor(items / plates);
  const shared = each * plates;
  const done = phase === 'done';

  useEffect(() => {
    if (phase !== 'playing') return;
    const duration = active && !reduceMotion && !disabled ? Math.min(5200, shared * 490) : 0;
    progress.value = 0;
    progress.value = withTiming(shared, { duration, easing: countingCadence }, finished => {
      if (finished) scheduleOnRN(setPhase, 'done');
    });
    return () => cancelAnimation(progress);
  }, [active, disabled, phase, progress, reduceMotion, shared]);

  const trayColumns = Math.min(items, items <= 12 ? 6 : 10);
  const trayStep = Math.min(46, (width * .76 - 16) / trayColumns);
  const trayH = Math.max(48, (Math.ceil(items / trayColumns) - 1) * trayStep * .81 + trayStep + 6);
  const trayW = Math.min(width - 8, trayColumns * trayStep + 22);
  const across = plates <= 3 ? plates : Math.ceil(plates / 2);
  const plateW = Math.min(138, (width - 8) / across - 5);
  const plateH = plateW * .58;
  const platePitch = plateW + 6;
  const plateCenters = Array.from({ length: plates }, (_, index) => {
    const row = Math.floor(index / across);
    const rowCount = Math.min(across, plates - row * across);
    return { x: width / 2 + (index % across - (rowCount - 1) / 2) * platePitch,
      y: trayH + 13 + plateH / 2 + row * (plateH + 7) };
  });
  const plateColumns = Math.max(1, each < 4 ? each : Math.ceil(each / 2));
  const plateStep = Math.min(39, plateW * .76 / plateColumns, plateH * .75 / Math.max(1, Math.ceil(each / plateColumns)));
  const summary = t('cookieShare.result', { each, left: items - shared });
  return <View style={styles.board} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <Text style={styles.trayTitle}>{t('cookieShare.tray')}</Text>
    {width > 40 && <View accessible accessibilityRole="image" accessibilityLabel={done ? summary : t('cookieShare.diagram', { items, plates })}
      style={{ height: plateCenters[plates - 1].y + plateH / 2 + 4 }}>
      <Canvas style={StyleSheet.absoluteFill} accessible={false}>
        <RoundedRect x={(width - trayW) / 2} y={0} width={trayW} height={trayH} r={15} color="#E4C9A7" />
        <RoundedRect x={(width - trayW) / 2 + 1.5} y={1} width={trayW - 3} height={trayH - 4} r={14} color="#FFF4E3" />
        {plateCenters.map(({ x, y }, i) => <Group key={i}>
          <Oval x={x - plateW / 2} y={y - plateH / 2 + 2} width={plateW} height={plateH} color="#72A8AB" />
          <Oval x={x - plateW / 2} y={y - plateH / 2} width={plateW} height={plateH} color="#BCDFDF" />
          <Oval x={x - plateW * .42} y={y - plateH * .39} width={plateW * .84} height={plateH * .78} color="#9CC9C9" />
          <Oval x={x - plateW * .41} y={y - plateH * .36} width={plateW * .82} height={plateH * .72} color="#F0FAF8" />
        </Group>)}
      </Canvas>
      {Array.from({ length: items }, (_, i) => {
        const from = spot(i, items, trayColumns, trayStep, width / 2, trayH / 2 - 1, trayStep);
        const turn = items - 1 - i;
        const center = plateCenters[turn % plates];
        const to = turn < shared ? spot(Math.floor(turn / plates), each, plateColumns, plateStep,
          center.x, center.y, plateStep) : from;
        return <Cookie key={i} from={from} to={to} turn={turn} progress={progress} />;
      })}
    </View>}
    <Pressable testID="cookie-sharing-demo" accessibilityRole="button" disabled={disabled || phase === 'playing'}
      accessibilityState={{ disabled: disabled || phase === 'playing' }}
      onPress={() => { onUseHelp?.(); setPhase('playing'); }}
      style={({ pressed }) => [styles.demo, pressed && styles.pressed]}>
      <Text style={styles.demoText}>{t(done ? 'cookieShare.replay' : phase === 'playing' ? 'cookieShare.playing' : 'cookieShare.watch')}</Text>
    </Pressable>
    <Text testID="cookie-sharing-status" accessibilityLiveRegion="polite" style={styles.question}>
      {done ? summary : t('cookieShare.ask')}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  board: { gap: 6 },
  trayTitle: { marginTop: 4, textAlign: 'center', fontSize: 15, fontWeight: '700', color: PuzzleColors.textMuted },
  demo: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  demoText: { fontSize: 16, fontWeight: '700', color: PuzzleColors.primaryDark },
  pressed: { opacity: .65 },
  cookie: { position: 'absolute', left: 0, top: 0 },
  question: { marginTop: 5, fontSize: 18, fontWeight: '700', color: PuzzleColors.text },
});
