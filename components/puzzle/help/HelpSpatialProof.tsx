import { Ink, PuzzleColors, Shape } from '@/constants/puzzle-theme';
import type { EverydayModel } from '@/types/everyday';
import { gridPose, gridStops, type GridModel } from '@/utils/puzzle-grid';
import { Canvas, CornerPathEffect, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { PuzzleText as Text } from '../PuzzleText';
import { RevealSurface } from '../kit/RevealSurface';
import { amber, beatProgress, ProofLine, teal, useHelpBeats, useHelpCaption, violet } from './helpKit';

type SpatialModel = Extract<EverydayModel, { kind: 'grid' | 'shapes' | 'solid' }>;
type Beats = ReturnType<typeof useHelpBeats>;
type Point = [number, number];
const polygon = (points: Point[]) => 'M' + points.map(p => p.join(' ')).join(' L') + ' Z';

/** Every marker sits this far below its cell's centre, so the cell number above it is never covered. */
const MARKER_DROP = 0.2;
const NUMBER_PT = 24;

function Grid({ model, size, beats }: { model: GridModel; size: number; beats: Beats }) {
  const flip = model.task === 'reflect';
  const pitch = size / model.size, centre = size / 2, drop = pitch * MARKER_DROP;
  const origin = gridPose(model, 0), target = gridStops(model).at(-1)!.square;
  const row = Math.floor(origin.y);
  const position = beats.position;
  const progress = useDerivedValue(() => flip ? Math.min(1, Math.max(0, (position.value - 1) / 3)) : beatProgress(position.value, 1));
  const x = useDerivedValue(() => flip
    ? (origin.x + (model.size - 2 * origin.x) * progress.value) * pitch
    : gridPose(model, progress.value).x * pitch);
  const y = useDerivedValue(() => gridPose(model, flip ? 0 : progress.value).y * pitch + drop);
  const lipY = useDerivedValue(() => y.value + 3);
  const arc = `M ${centre} ${pitch / 2 + drop} A ${pitch} ${pitch} 0 0 1 ${centre + pitch} ${centre + drop}`;
  return <View style={{ width: size, height: size }}>
    <Canvas style={StyleSheet.absoluteFill}>
      {Array.from({ length: model.size ** 2 }, (_, i) => {
        const col = i % model.size;
        const onRow = flip && Math.floor(i / model.size) === row;
        const landing = onRow && col === model.size - 1 - Math.floor(origin.x) && beats.landed >= model.size;
        const active = onRow ? (col === 0 || beats.landed >= col + 1) : (i + 1 === model.start || (beats.landed > 0 && i + 1 === target));
        const hue = landing ? amber : onRow ? teal : violet;
        const cell = { x: col * pitch + 2, y: Math.floor(i / model.size) * pitch + 2, width: pitch - 4, r: 9 };
        return <Group key={i}>
          <RoundedRect {...cell} height={pitch - 4} color={active ? hue.edge : Shape.emptyLip} />
          <RoundedRect {...cell} height={pitch - 7} color={active ? hue.light : Shape.empty} />
        </Group>;
      })}
      {flip ? <RoundedRect x={centre - 8} y={0} width={16} height={size} r={8} color={violet.fill} />
        : <>
          <Path path={arc} end={progress} style="stroke" strokeWidth={14} strokeCap="round" color={teal.fill} />
          <Circle cx={centre} cy={centre + drop} r={11} color={teal.edge} />
        </>}
      <Circle cx={origin.x * pitch} cy={origin.y * pitch + drop} r={10} color={teal.edge} />
      <Circle cx={x} cy={lipY} r={pitch * .19} color={amber.edge} />
      <Circle cx={x} cy={y} r={pitch * .19} color={amber.fill} />
    </Canvas>
    {Array.from({ length: model.size ** 2 }, (_, i) => <Text key={i} allowFontScaling={false} style={[styles.square, {
      left: (i % model.size) * pitch, width: pitch, top: Math.floor(i / model.size) * pitch + 6,
    }]}>{i + 1}</Text>)}
  </View>;
}

/** A right-hand heart half in a unit box: the fold line is x = .5 and the heart's top dip sits on it. */
const HEART = 'M 0.5 0.30 C 0.5 0.12 0.62 0.05 0.74 0.05 C 0.90 0.05 0.98 0.20 0.98 0.34 C 0.98 0.60 0.70 0.78 0.5 0.96 Z';
/** Where the shine dot sits on that half, in the same unit box. */
export const HEART_DOT: Point = [0.76, 0.32];
/** The heart's half outline, for the guard: points that must be mirrored by the other half. */
export const HEART_HALF_POINTS: Point[] = [[0.5, 0.30], [0.74, 0.05], [0.98, 0.34], [0.5, 0.96]];

/** The heart is drawn in a box of this fraction of the figure; its half path is the unit path scaled into it. */
function heartFrame(box: number) {
  const s = box * .94;
  return { s, left: box / 2 - s / 2, top: (box - s * .91) / 2 - s * .05 };
}
const heartPath = (box: number) => {
  const { s, left, top } = heartFrame(box);
  return HEART.replace(/(\d\.\d+) (\d\.\d+)/g, (_, a: string, b: string) => `${left + Number(a) * s} ${top + Number(b) * s}`);
};

function Fold({ size, beats }: { size: number; beats: Beats }) {
  const { s, left, top } = heartFrame(size), mid = size / 2;
  const half = heartPath(size);
  const dot: Point = [left + HEART_DOT[0] * s, top + HEART_DOT[1] * s];
  const position = beats.position;
  const fold = useDerivedValue(() => {
    const angle = Math.PI * (beatProgress(position.value, 2) - beatProgress(position.value, 3));
    return [{ scaleX: -Math.cos(angle) }];
  });
  const crease = useDerivedValue(() => beatProgress(position.value, 1));
  return <Canvas style={{ width: size, height: size }}>
    <Group transform={[{ translateY: 4 }]}><Path path={half} color={teal.edge}><CornerPathEffect r={14} /></Path></Group>
    <Path path={half} color={teal.fill}><CornerPathEffect r={14} /></Path>
    <Circle cx={dot[0]} cy={dot[1]} r={14} color={PuzzleColors.background} />
    <Group origin={{ x: mid, y: mid }} transform={fold}>
      <Group transform={[{ translateY: 4 }]}><Path path={half} color={teal.fill}><CornerPathEffect r={14} /></Path></Group>
      <Path path={half} color={teal.light}><CornerPathEffect r={14} /></Path>
      <Circle cx={dot[0]} cy={dot[1]} r={14} color={PuzzleColors.background} />
    </Group>
    <RoundedRect x={mid - 7} y={top + s * .04} width={14} height={s * .94} r={7} color={violet.fill} opacity={crease} />
  </Canvas>;
}

type Solid = Extract<SpatialModel, { kind: 'solid' }>;
const SLOPE = [.48, .45] as const;

/** Turn the long face toward the child so all six cubes can be counted across the roof. */
function Layer({ columns, rows, unit, bottom, layer, beats }: {
  columns: number; rows: number; unit: number; bottom: number; layer: number; beats: Beats;
}) {
  const project = (x: number, y: number, z: number): Point => [(x + z * SLOPE[0]) * unit, bottom - (y + z * SLOPE[1]) * unit];
  const base = layer, lid = layer + 1;
  const roofTile = (x: number, z: number, w: number, d: number) => polygon([
    project(x, lid, z), project(x + w, lid, z), project(x + w, lid, z + d), project(x, lid, z + d),
  ]);
  // The silhouette underpaints every shared edge. Alternating roof colours show units without grout.
  const outline = polygon([project(0, base, 0), project(columns, base, 0), project(columns, base, rows),
    project(columns, lid, rows), project(0, lid, rows), project(0, lid, 0)]);
  const side = polygon([project(columns, base, 0), project(columns, base, rows), project(columns, lid, rows), project(columns, lid, 0)]);
  const hue = layer ? violet : teal;
  const visible = layer === 0 || beats.landed >= layer + 1;
  if (!visible) return null;
  return <Group>
      <Path path={outline} color={hue.fill} />
      <Path path={side} color={hue.light} />
      <Path path={side} color={hue.fill} opacity={0.45} />
      <Path path={roofTile(0, 0, columns, rows)} color={hue.soft} />
      {Array.from({ length: columns * rows }, (_, i) => {
        const x = i % columns, z = Math.floor(i / columns);
        return (x + z) % 2 === 0 && <Path key={i} path={roofTile(x, z, 1, 1)} color={hue.light} />;
      })}
  </Group>;
}

function Box({ model, height, beats }: { model: Solid; height: number; beats: Beats }) {
  const [width, setWidth] = useState(0);
  const columns = Math.max(model.width, model.depth), rows = Math.min(model.width, model.depth);
  const unit = Math.min(width / (columns + rows * SLOPE[0]), height / (model.height + rows * SLOPE[1]));
  const boxHeight = unit * (model.height + rows * SLOPE[1]);
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', height }}>
    {unit > 0 && <Canvas style={{ width: unit * (columns + rows * SLOPE[0]), height: boxHeight }}>
      {Array.from({ length: model.height }, (_, layer) => <Layer key={layer} {...{ columns, rows, unit, bottom: boxHeight, layer, beats }} />)}
    </Canvas>}
  </View>;
}

export function HelpSpatialProof({ model, height, onSolutionShown }: { model: SpatialModel; height: number; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const size = Math.max(100, Math.min(width - 32, height));
  const key = model.kind === 'grid' ? (model.task === 'rotate' ? 'grid_turn' : 'grid_flip') : model.kind === 'solid' ? 'volume' : 'symmetry';
  const count = { grid_flip: 4, grid_turn: 1, volume: 2, symmetry: 3 }[key];
  // The folded half rests on the other for a moment: that is where the child sees the two halves match.
  const beats = useHelpBeats(count, onSolutionShown, count === 1 ? 1500 : count === 2 ? 1150 : 750,
    key === 'symmetry' ? landed => landed === 2 ? 650 : 240 : key === 'volume' ? landed => landed >= 2 ? 1100 : 300 : 240);
  const mirrorCount = key === 'grid_flip' && beats.landed > 0
    ? beats.landed <= 2 ? String(beats.landed) : `2  │  ${beats.landed - 2}`
    : undefined;
  const layerCount = Math.max(1, beats.landed);
  const layers = model.kind === 'solid' ? t(`visualHelp.examples.volume.${layerCount === 1 ? 'layerOne' : 'layerMany'}`,
    { count: layerCount, total: layerCount * model.depth * model.width }) : undefined;
  const sheetCaption = useHelpCaption(layers ?? null);
  return <RevealSurface beats={beats}>
    <View style={styles.model} accessible accessibilityLabel={t(`visualHelp.examples.${key}.question`)}>
      {model.kind === 'grid' ? <Grid model={model} size={size} beats={beats} />
        : model.kind === 'shapes' ? <Fold size={size} beats={beats} />
        : <Box model={model} height={height} beats={beats} />}
      {key === 'symmetry'
        ? <View style={styles.line}>{beats.settled && <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.7} style={styles.match}>{t('visualHelp.examples.symmetry.equation')}</Text>}</View>
        : <ProofLine caption={mirrorCount ?? (sheetCaption ? undefined : layers)} readout equation={beats.settled ? t(`visualHelp.examples.${key}.equation`) : undefined} />}
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  model: { alignItems: 'center', gap: 6 },
  square: { position: 'absolute', color: Ink.text, fontSize: NUMBER_PT, lineHeight: NUMBER_PT + 4, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  line: { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  match: { color: Ink.text, fontWeight: '800', fontSize: 28, lineHeight: 36, textAlign: 'center' },
});
