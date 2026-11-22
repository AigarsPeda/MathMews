import { distanceAtStops, glide } from '@/utils/puzzle-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, LinearGradient, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import type { GeometryMeasurePuzzle } from '@/types/puzzle';
import { geometryMeasurement, measureStops, perimeterPoint } from '@/utils/geometry-models';
import { PuzzleText as Text } from './PuzzleText';

function Square({ index, columns, unit, progress }: { index: number; columns: number; unit: number; progress: SharedValue<number> }) {
  const x = index % columns * unit, y = Math.floor(index / columns) * unit;
  const entry = useDerivedValue(() => glide(progress.value - index));
  const transform = useDerivedValue(() => [{ scale: .72 + .28 * entry.value }]);
  const top = Math.floor(index / columns) % 2 ? '#72CCDD' : '#65C6DA';
  return <Group opacity={entry} origin={{ x: x + unit / 2, y: y + unit / 2 }} transform={transform}>
    <RoundedRect x={x + 1} y={y + 1} width={unit - 2} height={unit - 2} r={1}>
      <LinearGradient start={{ x, y }} end={{ x: x + unit * .4, y: y + unit }} colors={[top, D.geometryFill]} />
    </RoundedRect>
  </Group>;
}

function Boundary({ w, h, unit, progress }: { w: number; h: number; unit: number; progress: SharedValue<number> }) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(0, 0); p.lineTo(w * unit, 0); p.lineTo(w * unit, h * unit); p.lineTo(0, h * unit); p.close();
    return p;
  }, [w, h, unit]);
  const trim = useDerivedValue(() => Math.min(1, Math.max(0, progress.value / (2 * (w + h)))));
  const point = useDerivedValue(() => perimeterPoint(w, h, progress.value));
  const x = useDerivedValue(() => point.value.x * unit), y = useDerivedValue(() => point.value.y * unit);
  return <>
    <Path path={path} end={trim} color={C.primaryDark} style="stroke" strokeWidth={4} strokeCap="round" strokeJoin="round" />
    <Circle cx={x} cy={y} r={5.5} color={C.primaryDark} />
    <Circle cx={x} cy={y} r={2.6} color={C.card} />
  </>;
}

export function MeasureInk({ width, height, unit, area, progress }: {
  width: number; height: number; unit: number; area: boolean; progress: SharedValue<number>;
}) {
  // Let the pen sit on the actual boundary, including at the four corners.
  const pad = 6;
  return <Canvas pointerEvents="none" style={{ position: 'absolute', left: -pad, top: -pad,
    width: width * unit + 2 * pad, height: height * unit + 2 * pad }}>
    <Group transform={[{ translateX: pad }, { translateY: pad }]}>
      {area ? Array.from({ length: width * height }, (_, i) =>
        <Square key={i} index={i} columns={width} unit={unit} progress={progress} />)
        : <Boundary w={width} h={height} unit={unit} progress={progress} />}
    </Group>
  </Canvas>;
}

export function GeometryMeasureReveal({ puzzle, marked, onSolutionShown, children }: {
  puzzle: GeometryMeasurePuzzle; marked: number; onSolutionShown: () => void;
  children: (progress: SharedValue<number>, done: boolean) => ReactNode;
}) {
  const { t } = useTranslation();
  const { active, reduceMotion } = useAnimationActivity();
  const { total, otherTotal, equation } = geometryMeasurement(puzzle);
  const steps = Math.max(total, otherTotal);
  const stops = useMemo(() => measureStops(puzzle, marked), [puzzle, marked]);
  const clock = useSharedValue(marked);
  const progress = useDerivedValue(() => distanceAtStops(clock.get(), stops, .55));
  const [count, setCount] = useState(marked);
  useEffect(() => {
    if (clock.get() >= steps) return;
    if (!active || reduceMotion) { clock.set(steps); return; }
    const perUnit = Math.min(310, Math.max(110, 3900 / steps));
    clock.set(withTiming(steps, { duration: (steps - clock.get()) * perUnit, easing: Easing.linear }));
    return () => cancelAnimation(clock);
  }, [active, reduceMotion, clock, steps]);
  useAnimatedReaction(() => Math.max(marked, Math.floor(progress.value)), (n, previous) => {
    if (n !== previous) scheduleOnRN(setCount, n);
  });
  const done = count >= steps;
  useEffect(() => { if (done) onSolutionShown(); }, [done, onSolutionShown]);
  const { mode } = puzzle.payload;
  const isMissing = mode === 'missing_area' || mode === 'missing_perimeter';
  const label = done && isMissing ? 'sideAnswer' : mode === 'area' || mode === 'missing_area' ? 'areaAnswer' : 'perimeterAnswer';
  return <>
    {children(progress, done)}
    <View style={styles.caption}>
      <Text style={styles.label}>{t(`geometryModels.${label}`)}</Text>
      <Text testID="geometry-measure-total" accessibilityLiveRegion={done ? 'polite' : 'none'} style={styles.result}>
        {done ? equation : mode === 'compare' ? `A = ${Math.min(count, total)}     B = ${Math.min(count, otherTotal)}` : count}
      </Text>
    </View>
  </>;
}

const styles = StyleSheet.create({
  caption: { alignItems: 'center', paddingTop: 6 },
  label: { color: C.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', fontWeight: '700' },
  result: { color: C.primaryDark, fontSize: 23, lineHeight: 32, fontWeight: '900', fontVariant: ['tabular-nums'], textAlign: 'center' },
});
