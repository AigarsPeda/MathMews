import { countingCadence } from '@/utils/puzzle-motion';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as Ink, PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { landingEquation, lineValue, type HopRoute } from '@/utils/number-line-reveal';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

function hopHeight(pixelDistance: number) {
  'worklet';
  return Math.min(44, Math.max(19, Math.abs(pixelDistance) * .67));
}

export function NumberLineReveal({ route, onSolutionShown }: { route: HopRoute; onSolutionShown: () => void }) {
  const { active, reduceMotion } = useAnimationActivity();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const baseline = 68 + 25 * Math.max(1, fontScale);
  const [measured, setMeasured] = useState(0);
  const width = measured || windowWidth - 56;
  const { min, max, stops, divisions } = route;
  const start = stops[0], end = stops[stops.length - 1];
  const last = stops.length - 1;
  const pad = Math.min(width / 5, Math.max(23, 20 * fontScale));
  const unit = (width - 2 * pad) / (max - min);
  const [landed, setLanded] = useState(0);
  const time = useSharedValue(0);
  const beats = useMemo(() => {
    let elapsed = 0;
    const flight = Math.min(660, Math.max(230, 2700 / Math.max(1, last)));
    const hops = [];
    for (const to of stops.slice(1)) {
      const arrive = elapsed + flight;
      hops.push({ to, begin: elapsed, arrive });
      elapsed = arrive + (to === 0 ? 370 : 100);
    }
    return hops;
  }, [stops, last]);
  const duration = beats.at(-1)?.arrive ?? 0;
  useEffect(() => {
    if (!active || reduceMotion || !duration) time.set(duration);
    else if (time.get() < duration) time.set(withDelay(430, withTiming(duration, { duration, easing: Easing.linear })));
    return () => cancelAnimation(time);
  }, [active, reduceMotion, duration, time]);

  const frame = useDerivedValue(() => {
    const now = time.get();
    let index = 0;
    while (index < beats.length && now >= beats[index].arrive) index++;
    const beat = beats[index];
    const phase = beat ? countingCadence(Math.max(0, (now - beat.begin) / (beat.arrive - beat.begin))) : 0;
    const from = stops[index], distance = beat ? beat.to - from : 0;
    const height = hopHeight(distance * unit);
    return { index, phase, x: pad + (from - min + distance * phase) * unit, y: baseline - 4 * height * phase * (1 - phase) };
  });
  const x = useDerivedValue(() => frame.get().x);
  const y = useDerivedValue(() => frame.get().y);
  const trace = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.moveTo(pad + (start - min) * unit, baseline);
    const { index, phase } = frame.get();
    for (let i = 0; i < Math.min(index + 1, last); i++) {
      const from = pad + (stops[i] - min) * unit;
      const length = (stops[i + 1] - stops[i]) * unit;
      const h = hopHeight(length);
      const p = i < index ? 1 : phase;
      // The partial quadratic ends at the moving marker, even on leftward hops.
      path.quadTo(from + length * p / 2, baseline - 2 * h * p, from + length * p, baseline - 4 * h * p * (1 - p));
    }
    return path;
  });
  useAnimatedReaction(() => frame.get().index, (next, prev) => {
    if (next !== prev) scheduleOnRN(setLanded, next);
  });
  useEffect(() => { if (landed === last) onSolutionShown(); }, [landed, last, onSolutionShown]);
  const edge = divisions ? Ink.fractionEdge : Ink.geometryEdge;
  const fill = divisions ? Ink.fractionFill : Ink.geometryFill;
  const axis = useMemo(() => {
    const path = Skia.Path.Make();
    path.moveTo(pad, baseline); path.lineTo(width - pad, baseline);
    for (let n = min; n <= max; n++) {
      const at = pad + (n - min) * unit;
      const size = n === 0 ? 11 : stops.includes(n) ? 7 : 4;
      path.moveTo(at, baseline - size); path.lineTo(at, baseline + size);
    }
    return path;
  }, [min, max, pad, unit, width, baseline, stops]);
  const tickLabel = (n: number) => n === divisions ? '1' : lineValue(n, divisions);
  // Give zero and the ends of the trip first choice of label space.
  const labels: { tick: number; center: number; half: number }[] = [];
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const candidates = [0, end, start, ...stops];
  if (divisions || max - min <= 12) candidates.push(max, min, ...ticks);
  for (const tick of candidates) {
    if (tick < min || tick > max) continue;
    const center = pad + (tick - min) * unit;
    const half = (tickLabel(tick).length * 5 + 4) * fontScale;
    if (labels.every(label => Math.abs(label.center - center) > label.half + half + 3))
      labels.push({ tick, center, half });
  }
  const nextHop = Math.min(landed + 1, last);
  const delta = last ? stops[nextHop] - stops[nextHop - 1] : 0;
  const midpoint = stops[nextHop] - delta / 2;
  const captionWidth = 58 * fontScale;
  const captionLeft = Math.max(0, Math.min(width - captionWidth, pad + (midpoint - min) * unit - captionWidth / 2));
  const move = `${delta < 0 ? '−' : '+'}${divisions ? `1/${divisions}` : Math.abs(delta)}`;
  return <View style={styles.wrap}>
    <View style={[styles.stage, { height: baseline + 24 + 28 * fontScale, backgroundColor: divisions ? Ink.fractionSurface : Ink.geometrySurface }]}
      onLayout={e => setMeasured(e.nativeEvent.layout.width)}>
      <Text style={[styles.step, {
        color: edge, left: captionLeft, width: captionWidth, top: baseline - hopHeight(delta * unit) - 25 * fontScale,
      }]}>{move}</Text>
      <Canvas style={StyleSheet.absoluteFill} accessible={false}>
        <Path path={axis} color={edge} style="stroke" strokeWidth={2.2} strokeCap="round" />
        <Path path={trace} color={edge} style="stroke" strokeWidth={3} strokeCap="round" />
        <Circle cx={pad + (start - min) * unit} cy={baseline} r={4} color={edge} />
        <Circle cx={x} cy={y} r={10} color={edge} />
        <Circle cx={x} cy={y} r={7.6} color={fill} />
        <Circle cx={x} cy={y} r={3.2} color={Colors.card} />
      </Canvas>
      {labels.map(({ tick, center, half }) => <Text key={tick} accessible={false} numberOfLines={1}
        style={[styles.tick, { top: baseline + 15, left: center - half - 3, width: half * 2 + 6, color: tick === stops[landed] ? edge : Colors.text }]}>
        {tickLabel(tick)}
      </Text>)}
    </View>
    <Text testID="line-solution-equation" style={styles.equation} accessibilityLiveRegion="polite">{landingEquation(route, landed)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 13, paddingVertical: 8 },
  stage: { width: '100%', maxWidth: 480, borderRadius: 16, overflow: 'hidden' },
  step: { position: 'absolute', textAlign: 'center', fontWeight: '800', fontSize: 17 },
  tick: { position: 'absolute', fontWeight: '700', fontSize: 16, textAlign: 'center', fontVariant: ['tabular-nums'] },
  equation: { color: Colors.primaryDark, fontSize: 27, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
});
