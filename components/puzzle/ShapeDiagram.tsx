import { HelpProofContext } from './kit/HelpProofContext';
import { Digit } from './help/helpKit';
import { canSnapshotCanvas, modelInk, useModelPaint } from './counting/useModelPaint';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { PuzzleText } from './PuzzleText';
import { glide } from '@/utils/puzzle-motion';
import { useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Canvas, Circle, Group, Path, RoundedRect, Skia, useCanvasRef } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { ProofMotion, Quantity, Shape } from '@/constants/puzzle-theme';
import { useRevealBeats } from './kit/useRevealBeats';
import { ProofCaption } from './kit/Focus';
import { DiagramSurface } from './everyday/DiagramSurface';
import { shapeGeometry, type Segment, type ShapeModel } from '@/utils/puzzle-shapes';


/** Picture help tints one side at a time with a solid band this thick, in points. */
const HELP_BAND = 16;
/** A numbered chip sits just inside the side it counts. */
const HELP_CHIP = 36;

function CountMark({ segment, task, index, progress, scale, help, fade }: {
  help?: boolean; fade?: SharedValue<number>; segment: Segment; task: ShapeModel['task']; index: number; progress: SharedValue<number>; scale: number;
}) {
  const { from, to } = segment;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const thickness = (help ? HELP_BAND : 10) / scale;
  const portion = useDerivedValue(() => Math.min(1, Math.max(0, progress.value - index)));
  const bandWidth = useDerivedValue(() => length * glide(portion.value));
  // In help only the side being counted is tinted: the band fades as the next side starts, and the chip stays as its count.
  const visible = useDerivedValue(() => {
    const d = progress.value - index;
    if (!help) return portion.value > 0 ? 1 : 0;
    return d <= 0 ? 0 : Math.max(0, Math.min(1, d < 1 ? 1 : 1 - (d - 1) * 2)) * (1 - (fade?.value ?? 0));
  });
  const radius = useDerivedValue(() => (6.5 + 2 * Math.sin(portion.value * Math.PI)) / scale);

  if (task === 'corners') return <Group opacity={visible}>
    <Circle cx={from.x} cy={from.y} r={radius} color={Quantity.amber.fill} />
  </Group>;
  return <Group opacity={visible} transform={[{ translateX: from.x }, { translateY: from.y }, { rotate: angle }]}>
    <RoundedRect x={0} y={-thickness / 2} width={bandWidth} height={thickness} r={thickness / 2} color={Quantity.amber.fill} />
  </Group>;
}

/** The count of a side, a solid violet chip just inside it. It pops in as its side's band finishes. */
function SideChip({ left, top, number, index, progress }: { left: number; top: number; number: number; index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (progress.value - index - 0.4) / 0.6));
    return { opacity: Math.min(1, p * 3), transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  return <Animated.View pointerEvents="none" style={[styles.chip, { left: left - HELP_CHIP / 2, top: top - HELP_CHIP / 2 }, style]}>
    <PuzzleText allowFontScaling={false} style={styles.chipText}>{number}</PuzzleText>
  </Animated.View>;
}

// The moving half is clipped at the true axis. Projection onto that axis
// sends each vertex to its reflected partner at the end of the fold.
function Axis({ axis, edges, progress, index, last, scale }: { scale: number; axis: Segment; edges: Segment[]; progress: SharedValue<number>; index: number; last: boolean }) {
  const { from, to } = axis, dx = to.x - from.x, dy = to.y - from.y;
  const norm = Math.hypot(dx, dy), nx = -dy / norm, ny = dx / norm;
  const points = edges.flatMap(({ from: a, to: b }) => {
    const da = (a.x - from.x) * nx + (a.y - from.y) * ny;
    const db = (b.x - from.x) * nx + (b.y - from.y) * ny;
    const keep = da >= -1e-6 ? [a] : [];
    if (da * db < -1e-6) keep.push({ x: a.x + (b.x - a.x) * da / (da - db), y: a.y + (b.y - a.y) * da / (da - db) });
    return keep;
  });
  const path = useDerivedValue(() => {
    const at = Math.min(2, Math.max(0, progress.value - index)), k = 1 - Math.cos(Math.PI * Math.min(1, at));
    const p = Skia.Path.Make();
    points.forEach((v, i) => {
      const d = ((v.x - from.x) * nx + (v.y - from.y) * ny) * k;
      if (i) p.lineTo(v.x - d * nx, v.y - d * ny);
      else p.moveTo(v.x - d * nx, v.y - d * ny);
    });
    p.close();
    return p;
  });
  const visible = useDerivedValue(() => progress.value > index && (progress.value <= index + 1 || last) ? 1 : 0);
  return <Group opacity={visible}><Path path={path} color={Quantity.violet.light} />
    {/* friendly-ok: A symmetry axis locates the fold between matching halves. */}
    <Path path={`M${from.x} ${from.y} L${to.x} ${to.y}`} style="stroke" strokeWidth={10 / scale} strokeCap="round" color={Quantity.amber.fill} />
  </Group>;
}

export function ShapeDiagram({ model, submitted, onSolutionShown }: { model: ShapeModel; submitted?: string; onSolutionShown?: () => void }) {
  const { t } = useTranslation();
  const help = useContext(HelpProofContext);
  const screen = useWindowDimensions();
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
      shapes.push({ path, edges, marks, offset });
      offset += marks.length;
    }
    return shapes;
  }, [model]);
  const total = figures.reduce((sum, figure) => sum + figure.marks.length, 0);
  const attempted = Number(submitted);
  const symmetry = model.task === 'symmetry';
  const countMiss = !symmetry && Number.isFinite(attempted) && attempted !== total;
  const attemptedMarks = Math.max(0, Math.min(total, attempted));
  const attemptProgress = useSharedValue(0);
  useEffect(() => {
    attemptProgress.value = 0;
    if (countMiss) attemptProgress.value = withTiming(attemptedMarks, { duration: Math.min(1800, attemptedMarks * 100) });
  }, [attemptProgress, attemptedMarks, countMiss]);
  const steps: number[] = [];
  for (const {offset, marks} of figures) {
    const batch = help ? 1 : symmetry ? 2 : 3;
    for (let i = batch; i < marks.length + batch; i += batch) steps.push(offset + Math.min(i, marks.length));
  }
  const beats = useRevealBeats(solving ? steps.length : 0, { awaitInitialPaint: solving && canSnapshotCanvas, reducedSteps: true, lead: 50, minTotal: 0,
    step: help ? 600 : symmetry ? ProofMotion.beat[240] : ProofMotion.travel, hold: 0, onDone: onSolutionShown });
  const { position, landed, settled, reduced } = beats;
  const count = steps[landed - 1] ?? 0;
  const phase = useDerivedValue(() => reduced ? landed : position.value);
  const progress = useDerivedValue(() => {
    const at = phase.value, i = Math.floor(at), from = steps[i - 1] ?? 0;
    return from + (at - i) * ((steps[i] ?? from) - from);
  });
  const canvas = useCanvasRef();
  // The tinted band leaves once the count is complete, so the shape ends as plain teal with its numbered sides.
  const helpFade = useSharedValue(0);
  useEffect(() => { helpFade.value = help && settled ? withTiming(1, { duration: 400 }) : 0; }, [helpFade, help, settled]);
  const columns = Math.max(1, figures.length);
  const size = Math.min(help ? Math.max(1, help.height - 18) : screen.fontScale >= 2 ? 125 : 165, Math.max(1, Math.floor(((width || screen.width - 56) - (columns - 1) * 6) / columns)));
  const scale = size / 140;
  const canvasWidth = columns * size + (columns - 1) * 6;
  const bounds = figures.flatMap(({edges}, i) => edges.map(({from}) => i * (size + 6) + from.x * scale));
  const offsetX = bounds.length ? (canvasWidth - Math.min(...bounds) - Math.max(...bounds)) / 2 : 0;
  const drawing = useModelPaint(solving && width > 0, beats, canvas, image => {
    const hasFill = modelInk(image, canvasWidth, size);
    const rgb = parseInt((symmetry ? Quantity.teal.light : Quantity.teal.fill).slice(1), 16);
    return figures.every((_, i) => hasFill(offsetX + i * (size + 6) + size / 2, size / 2, rgb));
  });
  const modelID = solving ? 'play-proof-model' : 'play-entry-model';
  const equationID = settled ? 'play-proof-equation' : undefined;
  const terms = figures.map(figure => figure.marks.length).join(' + ');
  const comparison = Number.isFinite(attempted) && attempted !== total
    ? ` ${total > attempted ? '>' : '<'} ${attempted}` : '';
  const answer = settled ? (figures.length > 1 ? terms + ' = ' : '') + total + comparison : count ? String(count) : '';
  const unit = t(`everyday.shapeCount.${model.task}`);
  const heading = t(`everyday.${settled ? 'total' : 'counted'}_${model.task}`);
  useProofAnnouncement(beats, heading + ' · ' + answer, solving);
  return <View style={styles.wrap} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View ref={drawing} collapsable={false} nativeID={modelID} testID={modelID} accessible accessibilityRole="image" accessibilityLabel={model.label} style={{alignSelf:"stretch"}}>
      {!help && !symmetry && <View style={styles.lane}>{countMiss && <PuzzleText style={styles.delta}>{attempted > total ? '+' : '−'}{Math.abs(attempted - total)}</PuzzleText>}</View>}
      <View style={styles.row}>
      <View style={{ width: canvasWidth, height: size }}>
      <Canvas ref={canvas} style={{width: canvasWidth, height: size}}>
        {figures.map(({ path, edges, marks, offset }, i) => {
          return <Group key={i} transform={[{translateX: offsetX + i * (size + 6)}, {scale}]}>
            <Path path={path} color={(symmetry ? Quantity.teal.light : Quantity.teal.fill)} />
            {(solving || countMiss) && marks.map((segment, j) => symmetry ? <Axis key={j} scale={scale} axis={segment} edges={edges} progress={progress} index={offset + j} last={j === marks.length - 1} /> :
              <CountMark help={!!help} fade={helpFade} key={j} scale={scale} task={model.task} segment={segment} index={offset + j} progress={countMiss ? attemptProgress : progress} />)}
          </Group>;
        })}
      </Canvas>
      {help && solving && !symmetry && figures.map(({ edges, offset }, i) => {
        const centre = { x: edges.reduce((sum, e) => sum + e.from.x, 0) / edges.length, y: edges.reduce((sum, e) => sum + e.from.y, 0) / edges.length };
        return edges.map(({ from, to }, j) => {
          const mid = { x: (from.x + to.x) / 2 * scale, y: (from.y + to.y) / 2 * scale };
          const dx = centre.x * scale - mid.x, dy = centre.y * scale - mid.y, norm = Math.hypot(dx, dy) || 1;
          const inset = HELP_CHIP * .65;
          return <SideChip key={`${i}-${j}`} number={j + 1} index={offset + j} progress={progress}
            left={offsetX + i * (size + 6) + mid.x + dx / norm * inset} top={mid.y + dy / norm * inset} />;
        });
      })}
      </View>
    </View>
    </View>
    {solving && <DiagramSurface playing beats={beats}><View nativeID={equationID} testID={equationID}><View accessible accessibilityLabel={unit + ', ' + answer} testID="shape-count" style={styles.count}>
      {help ? <Digit size={28}>{settled ? t('visualHelp.examples.shapes.total', { count: total }) : answer || ' '}</Digit> : <ProofCaption text={answer} reserveTexts={[figures.map(f => f.marks.length).join(' + ') + ' = ' + total]} />}
    </View></View></DiagramSurface>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8, gap: 6 },
  row: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lane: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  delta: { textAlign: 'center', backgroundColor: Quantity.amber.fill, borderRadius: 14, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 2, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  count: { alignSelf: 'stretch' },
  chip: { position: 'absolute', width: HELP_CHIP, height: HELP_CHIP, borderRadius: HELP_CHIP / 2, backgroundColor: Quantity.violet.fill,
    borderBottomWidth: Shape.lip, borderBottomColor: Quantity.violet.edge, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 24, lineHeight: 28, fontWeight: '800', color: Quantity.violet.onFill, fontVariant: ['tabular-nums'] },
});
