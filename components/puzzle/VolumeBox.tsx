import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Canvas, CornerPathEffect, Group, Path, Skia, useCanvasRef } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { Ink, ProofMotion, Quantity, Shape } from '@/constants/puzzle-theme';
import type { BoxModel } from '@/utils/puzzle-volume';
import { canSnapshotCanvas, modelInk, useModelPaint } from './counting/useModelPaint';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { DiagramSurface } from './everyday/DiagramSurface';
import { valueToken } from './kit/DenseLayout';
import { ProofCaption } from './kit/Focus';
import { EntryBuild } from './kit/PracticeAffordances';
import { useRevealBeats } from './kit/useRevealBeats';
import { useProofViewport } from './PlayProofCaption';
import { PuzzleText } from './PuzzleText';

type Point = { x: number; y: number };
type Projection = (x: number, y: number, z: number) => Point;

function face(points: Point[]) {
  const path = Skia.Path.Make();
  path.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) path.lineTo(p.x, p.y);
  path.close();
  return path;
}

function Layer({ w, d, layer, top, project, gap, progress, submitted }: {
  w: number; d: number; layer: number; top: boolean; project: Projection; gap: number;
  progress: SharedValue<number>; submitted?: number;
}) {
  const paths = useMemo(() => {
    const base = layer + gap;
    const lid = layer + 1;
    const a = project(0, lid, 0), b = project(w, lid, 0), c = project(w, lid, d);
    const front = face([a, b, project(w, base, 0), project(0, base, 0)]);
    const side = face([b, c, project(w, base, d), project(w, base, 0)]);
    const roof = face([a, b, c, project(0, lid, d)]);
    const filled = submitted === undefined ? w * d : Math.max(0, Math.min(w * d, submitted - layer * w * d));
    let shortage = Skia.Path.Make();
    if (top && filled < w * d) {
      // One face for the missing footprint avoids seams between adjacent rows.
      const row = Math.floor(filled / w), col = filled % w;
      const points = [project(col, lid, row), project(w, lid, row), project(w, lid, d)];
      if (col > 0 && row + 1 === d) points.push(project(col, lid, d));
      else {
        points.push(project(0, lid, d), project(0, lid, col > 0 ? row + 1 : row));
        if (col > 0) points.push(project(col, lid, row + 1));
      }
      shortage = face(points);
    }
    return { front, side, roof, shortage, empty: filled === 0 };
  }, [project, w, d, layer, gap, submitted, top]);
  const lit = useDerivedValue(() => Math.max(0, Math.min(1, progress.value - layer)));
  return <Group>
    <Path path={paths.front} color={Quantity.teal.light}><CornerPathEffect r={3} /></Path>
    <Path path={paths.side} color={Quantity.violet.light}><CornerPathEffect r={3} /></Path>
    {top && <Path path={paths.roof} color={Quantity.teal.soft}><CornerPathEffect r={4} /></Path>}
    <Group opacity={lit}>
      <Path path={paths.front} color={paths.empty ? Quantity.amber.fill : Quantity.teal.fill}><CornerPathEffect r={3} /></Path>
      <Path path={paths.side} color={paths.empty ? Quantity.amber.light : Quantity.violet.fill}><CornerPathEffect r={3} /></Path>
      {top && <><Path path={paths.roof} color={Quantity.teal.light}><CornerPathEffect r={4} /></Path>
        <Path path={paths.shortage} color={Quantity.amber.fill} /></>}
    </Group>
  </Group>;
}

export function VolumeBox({ model, submitted, onSolutionShown }: { model: BoxModel; submitted?: string; onSolutionShown?: () => void }) {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
  const viewport = useProofViewport();
  const [width, setWidth] = useState(0);
  const canvasWidth = Math.max(1, Math.min(width || viewport?.innerWidth || screenWidth - 48, 480));
  const { width: w, depth: d, height: h } = model;
  const perLayer = w * d, total = h * perLayer;
  const target = Number(submitted);
  const attempted = Number.isFinite(target) ? target : undefined;
  const compact = fontScale > 1.4;
  const labelWidth = (compact ? 21 : 52) * fontScale;
  // Labels live inside the canvas with 16 pt of margin: the height label to the left of the box, the others below and right of it.
  const leftRoom = 16 + labelWidth + 6, rightRoom = 16 + labelWidth * .5;
  const span = .88 * w + .475 * d;
  const rise = .23 * w + .87 * h + .43 * d;
  const unit = Math.max(1, Math.min((canvasWidth - leftRoom - rightRoom) / span, Math.min(compact ? 156 : 216, screenHeight * .26) / rise));
  const height = Math.ceil(unit * rise + (compact ? 20 : 26) * fontScale + 8);
  const project = useMemo<Projection>(() => (x, y, z) => ({
    x: leftRoom + (canvasWidth - leftRoom - rightRoom - span * unit) / 2 + (.88 * x + .475 * z) * unit,
    y: 4 + (.23 * x + .87 * (h - y) + .43 * (d - z)) * unit,
  }), [canvasWidth, span, unit, h, d, leftRoom, rightRoom]);
  const gap = Math.min(.22, Shape.space.seam / (.87 * unit));
  const labels = [
    { at: project(0, h / 2, 0), left: project(0, h / 2, 0).x - 6 - labelWidth, align: 'right' as const, dy: -13 * fontScale, value: h },
    { at: project(w / 2, 0, 0), left: project(w / 2, 0, 0).x - labelWidth / 2, align: 'center' as const, dy: 4, value: w },
    { at: project(w, 0, d / 2), left: project(w, 0, d / 2).x + 6, align: 'left' as const, dy: -8 * fontScale, value: d },
  ];
  const solving = !!onSolutionShown;
  const beats = useRevealBeats(solving && !width ? null : solving ? h : 0, {
    awaitInitialPaint: solving && canSnapshotCanvas, lead: 40, step: ProofMotion.group,
    minTotal: 0, hold: 0, reducedSteps: true, onDone: onSolutionShown,
  });
  const { position, reduced, landed, settled } = beats;
  const progress = useDerivedValue(() => reduced ? landed : position.value);
  const canvas = useCanvasRef();
  const drawing = useModelPaint(solving && width > 0, beats, canvas, image => {
    const ink = modelInk(image, canvasWidth, height);
    return Array.from({ length: h }, (_, layer) => {
      const p = project(w / 2, layer + .5, 0);
      return ink(p.x, p.y, parseInt(Quantity.teal.light.slice(1), 16));
    }).every(Boolean);
  });
  const amount = model.answerUnit === 'cubes' ? t('everyday.boxCubes', { count: total }) : valueToken(t('everyday.boxVolume', { n: total }));
  const result = attempted !== undefined && attempted !== total
    ? `${attempted} ${attempted < total ? '<' : '>'} ${total}` : `${w} × ${d} × ${h} = ${amount}`;
  const caption = settled ? result : landed ? (landed === 1 ? `${w} × ${d} = ${perLayer}` : `${landed} × ${perLayer} = ${landed * perLayer}`) : '';
  useProofAnnouncement(beats, caption, solving);
  const modelID = solving ? 'play-proof-model' : 'play-entry-model';
  const center = project(w / 2, h, d / 2);
  const surplus = attempted === undefined ? 0 : attempted - total;
  const box = <View style={{ width: canvasWidth, height }}>
    <Canvas ref={canvas} style={StyleSheet.absoluteFill}>
      {Array.from({ length: h }, (_, layer) => <Layer key={layer} {...{ w, d, layer, project, gap, progress }}
        top={layer === h - 1} submitted={attempted} />)}
    </Canvas>
    {labels.map(({ at, left, align, dy, value }, i) => <PuzzleText key={i} style={[styles.dimension, {
      width: labelWidth, textAlign: align, left: Math.max(16, Math.min(canvasWidth - 16 - labelWidth, left)),
      top: Math.max(0, at.y + dy),
    }]}>{compact ? value : valueToken(t('everyday.boxLength', { n: value }))}</PuzzleText>)}
    {settled && surplus > 0 && <View style={[styles.surplus, { left: center.x - labelWidth / 2, width: labelWidth, top: center.y - 12 }]}>
      <PuzzleText numberOfLines={1} adjustsFontSizeToFit style={styles.surplusText}>+{surplus}</PuzzleText>
    </View>}
  </View>;
  return <DiagramSurface beats={beats} playing={solving}><View style={styles.wrap} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <View ref={drawing} collapsable={false} nativeID={modelID} testID={modelID} accessible accessibilityRole="image" accessibilityLabel={model.label}>
      {solving ? box : <EntryBuild>{box}</EntryBuild>}
    </View>
    {solving && landed > 0 && <View nativeID={settled ? 'play-proof-equation' : undefined} testID={settled ? 'play-proof-equation' : undefined}>
      <ProofCaption text={caption} />
    </View>}
  </View></DiagramSurface>;
}

const styles = StyleSheet.create({
  dimension: { position: 'absolute', color: Ink.text, textAlign: 'center', fontWeight: '800', fontSize: 18, lineHeight: 24 },
  surplus: { position: 'absolute', borderRadius: 10, backgroundColor: Quantity.amber.fill },
  surplusText: { color: Ink.text, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 6, paddingVertical: 6 },
});
