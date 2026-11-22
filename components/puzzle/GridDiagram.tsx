import { countingCadence, distanceAtStops, glide } from '@/utils/puzzle-motion';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Circle, DashPathEffect, Group, Line, Path, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';
import { PuzzleText as Text } from './PuzzleText';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { gridPose, gridSteps, gridStops, type GridModel } from '@/utils/puzzle-grid';

export function GridDiagram({ model, onSolutionShown }: { model: GridModel; onSolutionShown?: () => void }) {
  const { t } = useTranslation();
  const { active, reduceMotion } = useAnimationActivity();
  const { width: viewport, fontScale } = useWindowDimensions();
  const [available, setAvailable] = useState(viewport - 48);
  const steps = gridSteps(model);
  const stops = useMemo(() => gridStops(model), [model]);
  const stopsAt = useMemo(() => stops.map(stop => stop.step), [stops]);
  const start = gridPose(model, 0);
  const n = model.size;
  // On a turn, an outer square can swing past the border on its way to the next row.
  const radius = Math.hypot(start.x - n / 2, start.y - n / 2);
  const margin = model.task === 'rotate' ? Math.max(.15, radius + .62 - n / 2) : .15;
  const pitch = Math.max(1, Math.min(64, 252 / n, available / (n + 2 * margin)));
  const pad = margin * pitch;
  const board = n * pitch;
  const extent = board + 2 * pad;
  const centre = extent / 2;
  const progress = useSharedValue(0);
  const [reached, setReached] = useState(0);
  const solving = !!onSolutionShown;
  useEffect(() => {
    if (!solving) return;
    if (!active || reduceMotion) { progress.value = steps; return; }
    const msPerStep = model.task === 'reflect' ? 1450 : model.task === 'rotate' ? 1000 : Math.max(440, 1000 / steps);
    progress.value = withTiming(steps, { duration: (steps - progress.value) * msPerStep, easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [solving, active, reduceMotion, model.task, steps, progress]);
  const step = useDerivedValue(() => {
    if (model.task === 'translate') {
      const distance = distanceAtStops(progress.value, stopsAt, .48);
      const cell = Math.floor(distance);
      return cell + countingCadence(distance - cell);
    }
    const whole = Math.floor(progress.value);
    return whole + glide(progress.value - whole);
  });
  useAnimatedReaction(() => Math.floor(step.value), (cell, prev) => {
    if (cell !== prev) scheduleOnRN(setReached, cell);
  });
  useEffect(() => { if (reached === steps) onSolutionShown?.(); }, [reached, steps, onSolutionShown]);
  const pose = useDerivedValue(() => gridPose(model, step.value));
  const tip = useDerivedValue(() => vec(pad + pitch * pose.value.x, pad + pitch * pose.value.y));
  const marker = useDerivedValue(() => [
    { translateX: pad + pitch * pose.value.x }, { translateY: pad + pitch * pose.value.y },
    { rotate: pose.value.angle }, { scaleX: pose.value.scaleX },
  ]);
  const trail = useMemo(() => {
    const path = Skia.Path.Make();
    const samples = model.task === 'rotate' ? steps * 24 : steps;
    for (let i = 0; i <= samples; i++) {
      const point = gridPose(model, steps * i / samples);
      const x = pad + pitch * point.x, y = pad + pitch * point.y;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    return path;
  }, [model, pad, pitch, steps]);
  const traced = useDerivedValue(() => model.task === 'reflect' ? (1 - pose.value.scaleX) / 2 : step.value / steps);
  // Keep ink off the numerals, including on the middle column of an odd mirror grid.
  const numeralSize = Math.min(18, pitch * .37);
  const labelMask = useMemo(() => {
    const path = Skia.Path.Make();
    for (let i = 0; i < n * n; i++) {
      const x = pad + (i % n + .5) * pitch;
      const y = pad + (Math.floor(i / n) + .5) * pitch;
      const w = Math.min(pitch * .8, numeralSize * fontScale * .6 * String(i + 1).length + 4);
      const h = Math.min(pitch * .8, numeralSize * fontScale + 2);
      path.addRRect(Skia.RRectXY(Skia.XYWHRect(x - w / 2, y - h / 2, w, h), 3, 3));
    }
    return path;
  }, [fontScale, n, numeralSize, pad, pitch]);
  const half = pitch * .35;
  const square = stops[stops.length - 1].square;
  const done = solving && reached === steps;
  const journey = stops.filter(stop => stop.step <= reached).map(stop => stop.square).join(' → ');
  const answer = t('everyday.gridSquare', { number: square });
  return <View style={styles.wrap} onLayout={event => setAvailable(event.nativeEvent.layout.width)}>
    <View accessible accessibilityRole="image" accessibilityLabel={model.label}
      style={{ width: extent, height: extent }}>
      <View style={[styles.board, { top: pad - 3, left: pad - 3, width: board + 6, height: board + 6 }]} />
      <Canvas style={StyleSheet.absoluteFill}>
        {Array.from({ length: n * n }, (_, i) => <RoundedRect key={i} x={pad + i % n * pitch + 1}
          y={pad + Math.floor(i / n) * pitch + 1} width={pitch - 2} height={pitch - 2} r={4}
          color={done && i + 1 === square ? C.selectedStrong : C.card} />)}
        {solving && model.start !== square && <RoundedRect x={pad + start.x * pitch - half}
          y={pad + start.y * pitch - half} width={2 * half} height={2 * half} r={pitch * .14}
          style="stroke" strokeWidth={1.5} color={C.primary} opacity={.55}>
          <DashPathEffect intervals={[3, 3]} />
        </RoundedRect>}
        <Group clip={labelMask} invertClip>
          {model.task === 'reflect' && <Line p1={vec(centre, pad - 3)} p2={vec(centre, pad + board + 3)}
            color={D.geometryEdge} strokeWidth={2}><DashPathEffect intervals={[5, 4]} /></Line>}
          {solving && model.task === 'rotate' && <Line p1={vec(centre, centre)} p2={tip} color={D.geometryEdge}
            strokeWidth={1.5} opacity={.7}><DashPathEffect intervals={[4, 3]} /></Line>}
          {solving && <Path path={trail} end={traced} color={C.primary} opacity={.6} style="stroke"
            strokeWidth={2.5} strokeJoin="round" strokeCap="round" />}
        </Group>
        {model.task === 'rotate' && <Circle cx={centre} cy={centre} r={n % 2 ? pitch * .27 : 4.5}
          color={D.geometryEdge} style={n % 2 ? 'stroke' : 'fill'} strokeWidth={1.8} />}
        <Group transform={marker}>
          <RoundedRect x={-half} y={-half} width={2 * half} height={2 * half} r={pitch * .14} color={C.selectedSurface} />
          <RoundedRect x={-half} y={-half} width={2 * half} height={2 * half} r={pitch * .14}
            color={C.primaryDark} style="stroke" strokeWidth={3} />
          <Circle cx={-half * .7} cy={-half} r={4.8} color={C.primaryDark} />
          <Circle cx={-half * .7} cy={-half} r={2.5} color={D.goldLight} />
        </Group>
      </Canvas>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: pad, left: pad }}>
        {Array.from({ length: n }, (_, row) => <View key={row} style={styles.row}>
          {Array.from({ length: n }, (_, col) => {
            const value = row * n + col + 1;
            return <View key={col} style={[styles.cell, { width: pitch, height: pitch }]}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.number, { fontSize: numeralSize },
                value === (done ? square : model.start) && styles.emphasis]}>{value}</Text>
            </View>;
          })}
        </View>)}
      </View>
    </View>
    {solving && <Text testID="grid-journey" accessibilityLabel={done ? answer : journey}
      accessibilityLiveRegion="polite" style={[styles.caption, { minHeight: 27 * fontScale }]}>{journey}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6, gap: 3 },
  board: { position: 'absolute', backgroundColor: '#D5E4E5', borderColor: '#A7C4C8', borderWidth: 1.5, borderRadius: 9 },
  row: { flexDirection: 'row' },
  cell: { justifyContent: 'center', alignItems: 'center' },
  number: { color: C.text, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  emphasis: { color: C.primaryDark, fontWeight: '900' },
  caption: { color: C.primaryDark, fontSize: 19, lineHeight: 27, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
});
