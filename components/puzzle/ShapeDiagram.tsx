import { distanceAtStops, glide } from '@/utils/puzzle-motion';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Canvas, Circle, Group, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { shapeGeometry, type Segment, type ShapeModel } from '@/utils/puzzle-shapes';
import { PuzzleObjectImage } from './PuzzleObjectImage';
import { PuzzleText as Text } from './PuzzleText';

const finishes = [
  [D.goldLight, D.gold, D.goldEdge],
  ['#8EDBEB', D.geometryFill, D.geometryEdge],
  [D.solidTop, D.solidFront, D.solidSide],
];
const ink = C.primaryDark;

function CountMark({ segment, task, index, progress }: {
  segment: Segment; task: ShapeModel['task']; index: number; progress: SharedValue<number>;
}) {
  const { from, to } = segment;
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(from.x, from.y);
    p.lineTo(to.x, to.y);
    return p;
  }, [from, to]);
  const portion = useDerivedValue(() => Math.min(1, Math.max(0, progress.value - index)));
  const trim = useDerivedValue(() => glide(portion.value / .8));
  const visible = useDerivedValue(() => portion.value > 0 ? 1 : 0);
  const active = useDerivedValue(() => portion.value > 0 && portion.value < 1 ? 1 : 0);
  const x = useDerivedValue(() => from.x + (to.x - from.x) * trim.value);
  const y = useDerivedValue(() => from.y + (to.y - from.y) * trim.value);
  const radius = useDerivedValue(() => 4.6 + 4.8 * Math.sin(portion.value * Math.PI));

  if (task === 'corners') return <Group opacity={visible}>
    <Circle cx={from.x} cy={from.y} r={radius} color={ink} />
    <Circle cx={from.x} cy={from.y} r={3.2} opacity={active} color="white" />
  </Group>;
  return <Group opacity={visible}>
    <Path path={path} end={trim} style="stroke" strokeWidth={task === 'symmetry' ? 2.3 : 4.5} strokeCap="round" color={ink} />
    <Group opacity={active}>
      <Circle cx={x} cy={y} r={5.5} color={ink} />
      <Circle cx={x} cy={y} r={2.4} color="white" />
    </Group>
  </Group>;
}

export function ShapeDiagram({ model, onSolutionShown }: { model: ShapeModel; onSolutionShown?: () => void }) {
  const { t } = useTranslation();
  const { active, reduceMotion } = useAnimationActivity();
  const [width, setWidth] = useState(0);
  const solving = !!onSolutionShown;
  const figures = useMemo(() => {
    let offset = 0;
    const shapes = [];
    for (const sides of model.sides) {
      const { edges, axes } = shapeGeometry(sides, model.rectangle);
      const path = Skia.Path.Make();
      path.moveTo(edges[0].from.x, edges[0].from.y);
      edges.forEach(({ to }) => path.lineTo(to.x, to.y));
      path.close();
      const marks = model.task === 'symmetry' ? axes : edges;
      shapes.push({ path, marks, offset });
      offset += marks.length;
    }
    return shapes;
  }, [model]);
  const total = figures.reduce((sum, figure) => sum + figure.marks.length, 0);
  const clock = useSharedValue(0);
  const stops = useMemo(() => [0, ...figures.map(figure => figure.offset + figure.marks.length)], [figures]);
  const progress = useDerivedValue(() => distanceAtStops(clock.get(), stops, .55));
  const [count, setCount] = useState(0);
  useAnimatedReaction(() => {
    // Count the vertex on arrival, or the line when its tip reaches the end.
    const fraction = progress.value - Math.floor(progress.value);
    return Math.floor(progress.value) + Number(fraction > (model.task === 'corners' ? .01 : .8));
  }, (value, previous) => {
    if (value !== previous) scheduleOnRN(setCount, value);
  });
  useEffect(() => {
    if (!solving || !width) return;
    if (!active || reduceMotion) { clock.set(total); return; }
    const msPerMark = Math.min(500, Math.max(240, 4200 / total));
    clock.set(withTiming(total, { duration: (total - clock.get()) * msPerMark, easing: Easing.linear }));
    return () => cancelAnimation(clock);
  }, [active, reduceMotion, solving, total, clock, width]);
  useAnimatedReaction(() => progress.value >= total, (done, previous) => {
    if (done && !previous && onSolutionShown) scheduleOnRN(onSolutionShown);
  });

  const size = Math.min(148, Math.max(0, (width - (figures.length - 1) * 8) / figures.length));
  const answer = count === total && figures.length > 1
    ? figures.map(figure => figure.marks.length).join(' + ') + ' = ' + total
    : String(count);
  const unit = t(`everyday.shapeCount.${model.task}`);
  return <View style={styles.wrap} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {model.context === 'mats' && <View style={styles.subject}>
      <View style={styles.ribbon}><PuzzleObjectImage object="ribbon" /></View>
      <Text style={styles.note}>{t('everyday.ribbonPerCorner')}</Text>
    </View>}
    <View accessible accessibilityRole="image" accessibilityLabel={model.label} style={styles.row}>
      {size > 0 && figures.map(({ path, marks, offset }, i) => {
        const [light, face, rim] = finishes[i % finishes.length];
        return <Canvas key={i} style={{ width: size, height: size }}><Group transform={[{ scale: size / 140 }]}>
          <Group transform={[{ translateY: 3 }]}>
            <Path path={path} color={rim} />
            <Path path={path} style="stroke" strokeJoin="round" strokeWidth={3} color={rim} />
          </Group>
          <Path path={path}><LinearGradient start={vec(35, 18)} end={vec(96, 126)} colors={[light, face]} /></Path>
          <Path path={path} style="stroke" strokeJoin="round" strokeWidth={2} color={rim} />
          {solving && marks.map((segment, j) => <CountMark key={j} task={model.task} segment={segment} index={offset + j} progress={progress} />)}
        </Group></Canvas>;
      })}
    </View>
    {solving && <View accessible accessibilityLabel={unit + ', ' + answer} testID="shape-count" style={styles.count}>
      <Text style={styles.unit}>{unit}</Text>
      <Text style={styles.number}>{answer}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  subject: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ribbon: { width: 48, height: 48 },
  note: { flexShrink: 1, fontSize: 15, textAlign: 'center', color: C.textMuted },
  count: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 10 },
  unit: { fontSize: 16, fontWeight: '700', color: C.textMuted },
  number: { fontSize: 23, lineHeight: 32, fontWeight: '900', color: ink, fontVariant: ['tabular-nums'] },
});
