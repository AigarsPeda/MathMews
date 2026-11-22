import { dropHeight } from '@/utils/puzzle-motion';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Canvas, DashPathEffect, Group, Path, Skia } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { landedVolumeRows, volumeLayers, type BoxModel } from '@/utils/puzzle-volume';
import { PuzzleText as Text } from './PuzzleText';

type Point = { x: number; y: number };
// Orthographic projection. One unit is the same centimetre along each 3D axis.
function project(x: number, y: number, z: number): Point {
  return { x: .88 * x + .475 * z, y: .23 * x - .87 * y - .43 * z };
}

function pathThrough(points: Point[], close = false) {
  const path = Skia.Path.Make();
  path.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) path.lineTo(p.x, p.y);
  if (close) path.close();
  return path;
}

function cubeRow(width: number) {
  const front = pathThrough([project(0, 0, 0), project(width, 0, 0), project(width, 1, 0), project(0, 1, 0)], true);
  const top = pathThrough([project(0, 1, 0), project(width, 1, 0), project(width, 1, 1), project(0, 1, 1)], true);
  const side = pathThrough([project(width, 0, 0), project(width, 0, 1), project(width, 1, 1), project(width, 1, 0)], true);
  const seams = Skia.Path.Make();
  seams.addPath(front); seams.addPath(top); seams.addPath(side);
  for (let x = 1; x < width; x++) {
    seams.addPath(pathThrough([project(x, 0, 0), project(x, 1, 0), project(x, 1, 1)]));
  }
  return { front, top, side, seams };
}

type Row = ReturnType<typeof volumeLayers>['rows'][number];
function CubeRow({ row, mesh, progress, unit }: {
  row: Row; mesh: ReturnType<typeof cubeRow>; progress: SharedValue<number>; unit: number;
}) {
  const place = project(0, row.layer, row.depthIndex);
  const fraction = useDerivedValue(() => Math.max(0, Math.min(1, (progress.value - row.begins) / (row.lands - row.begins))));
  const transform = useDerivedValue(() => [
    { translateX: place.x }, { translateY: place.y - .60 * dropHeight(fraction.value) },
  ]);
  const opacity = useDerivedValue(() => Math.min(1, fraction.value * 2));
  const alternate = row.layer % 2 === 1;
  return <Group transform={transform} opacity={opacity}>
    <Path path={mesh.front} color={alternate ? '#BAA1DE' : D.solidFront} />
    <Path path={mesh.side} color={alternate ? '#997AAF' : D.solidSide} />
    <Path path={mesh.top} color={alternate ? '#E1D2F5' : D.solidTop} />
    <Path path={mesh.seams} style="stroke" color="#71588B" strokeWidth={1 / unit} strokeJoin="round" />
  </Group>;
}

function boxFrame(w: number, h: number, d: number) {
  const a = project(0, 0, 0), b = project(w, 0, 0), c = project(w, 0, d), e = project(0, 0, d);
  const A = project(0, h, 0), B = project(w, h, 0), C = project(w, h, d), E = project(0, h, d);
  const floor = pathThrough([a, b, c, e], true);
  const floorGrid = Skia.Path.Make();
  for (let x = 1; x < w; x++) floorGrid.addPath(pathThrough([project(x, 0, 0), project(x, 0, d)]));
  for (let z = 1; z < d; z++) floorGrid.addPath(pathThrough([project(0, 0, z), project(w, 0, z)]));
  const hidden = pathThrough([a, e, c]); hidden.addPath(pathThrough([e, E]));
  const front = pathThrough([A, a, b, c, C, B, A]); front.addPath(pathThrough([B, b]));
  return { floor, floorGrid, hidden, front, inner: pathThrough([A, E, C]), walls: pathThrough([a, A, E, C, c, e], true) };
}

export function VolumeBox({ model, onSolutionShown }: { model: BoxModel; onSolutionShown?: () => void }) {
  const { t } = useTranslation();
  const { width: viewport, fontScale } = useWindowDimensions();
  const [available, setAvailable] = useState(viewport - 48);
  const { width: w, depth: d, height: h } = model;
  const plan = useMemo(() => volumeLayers(model), [model]);
  const mesh = useMemo(() => cubeRow(w), [w]);
  const frame = useMemo(() => boxFrame(w, h, d), [w, h, d]);
  const { active, reduceMotion } = useAnimationActivity();
  const progress = useSharedValue(0);
  const [landed, setLanded] = useState(0);
  const solving = !!onSolutionShown;
  useEffect(() => {
    if (!solving) return;
    if (!active || reduceMotion) { progress.value = h; return; }
    progress.value = withTiming(h, { duration: Math.max(0, h - progress.value) * 1060, easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [solving, active, reduceMotion, h, progress]);
  useAnimatedReaction(() => landedVolumeRows(progress.value, d, h), (count, prev) => {
    if (count !== prev) scheduleOnRN(setLanded, count);
  });
  const done = landed === plan.rows.length;
  useEffect(() => { if (done) onSolutionShown?.(); }, [done, onSolutionShown]);

  const largeText = fontScale > 1.4;
  const canvasWidth = Math.min(available, 350);
  const span = project(w, 0, d).x;
  const top = project(0, h, d).y, bottom = project(w, 0, 0).y;
  const unit = Math.max(1, Math.min(55, (canvasWidth - (largeText ? 20 : 84 * fontScale)) / span, 184 / (bottom - top)));
  const left = (canvasWidth - unit * span) / 2;
  const baseline = 17 - unit * top;
  const height = baseline + unit * bottom + (largeText ? 8 : 26 * fontScale);
  const dimension = (n: number) => t('everyday.boxLength', { n });
  const labels = [
    { at: project(0, h / 2, 0), dx: -25, dy: 0, value: h },
    { at: project(w / 2, 0, 0), dx: -3, dy: 14, value: w },
    { at: project(w, 0, d / 2), dx: 17, dy: 11, value: d },
  ];
  const layersFilled = Math.floor(landed / d);
  const count = done ? plan.total : landed * w;
  const amount = model.answerUnit === 'cubes' ? t('everyday.boxCubes', { count }) : t('everyday.boxVolume', { n: count });
  const caption = done ? h + ' × ' + plan.perLayer + ' = ' + amount : amount;
  return <View style={styles.wrap} onLayout={e => setAvailable(e.nativeEvent.layout.width)}>
    <View accessible accessibilityRole="image" accessibilityLabel={model.label} style={{ width: canvasWidth, height }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ translateX: left }, { translateY: baseline }, { scale: unit }]}>
          <Path path={frame.walls} color="#F6F2FA" />
          <Path path={frame.floor} color="#EDE4F5" />
          <Path path={frame.floorGrid} color="#CBBBD8" style="stroke" strokeWidth={1 / unit} />
          <Path path={frame.hidden} color="#BDA8CE" style="stroke" strokeWidth={1 / unit}>
            <DashPathEffect intervals={[4 / unit, 3 / unit]} />
          </Path>
          <Path path={frame.inner} color="#90779F" style="stroke" strokeJoin="round" strokeWidth={1.5 / unit} />
          {solving && plan.rows.map((row, i) => <CubeRow key={i} row={row} mesh={mesh} progress={progress} unit={unit} />)}
          <Path path={frame.front} color="#785F8C" style="stroke" strokeJoin="round" strokeWidth={1.6 / unit} />
        </Group>
      </Canvas>
      {!largeText && labels.map(({ at, dx, dy, value }, i) => <View key={i} style={[styles.label, {
        width: 52 * fontScale, left: left + at.x * unit + (dx - 26) * fontScale,
        top: baseline + at.y * unit + (dy - 10) * fontScale,
      }]}><Text style={styles.measure}>{dimension(value)}</Text></View>)}
    </View>
    {largeText && <Text style={styles.measure}>{[w, h, d].map(dimension).join(' × ')}</Text>}
    {solving && <View style={styles.count}>
      <Text style={styles.layer}>{done ? t('everyday.boxBase', { w, d, area: plan.perLayer }) : t('everyday.boxLayer', { layer: layersFilled, height: h })}</Text>
      <Text testID="volume-count" accessibilityLiveRegion={done ? 'polite' : 'none'} style={styles.amount}>{caption}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6 },
  label: { position: 'absolute', alignItems: 'center' },
  measure: { color: C.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  count: { alignItems: 'center', paddingTop: 4 },
  layer: { color: C.textMuted, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  amount: { color: C.primaryDark, fontSize: 22, lineHeight: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
