import { HelpProofContext } from './kit/HelpProofContext';
import { ProofLine } from './help/helpKit';
import { MoveChips, VisitedFaces, moveChips } from './help/HelpGridMoves';
import { useModelStage } from './kit/ModelStage';
import { GridPoint } from './GridPoint';
import { canSnapshotCanvas, useModelPaint } from './counting/useModelPaint';
import { useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Circle, Group, Line, Path, RoundedRect, Skia, useCanvasRef } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { useRevealBeats } from './kit/useRevealBeats';
import { Caption } from './kit/Focus';
import { DiagramSurface } from './everyday/DiagramSurface';
import { useTranslation } from 'react-i18next';
import { ProofMotion, PuzzleColors as C, Quantity, Shape } from '@/constants/puzzle-theme';

import { gridPose, gridSteps, type GridModel } from '@/utils/puzzle-grid';

/** The move chips lane (52) and its gap sit under the board in picture help. */
const HELP_MOVE_LANE = 56;

export function GridDiagram({ model, onSolutionShown, instruction, renderCells, attemptedCell, playback = false }: {
  model: GridModel; onSolutionShown?: () => void; instruction?: string; attemptedCell?: number; playback?: boolean;
  renderCells?: (layout: { pitch: number; pad: number }) => ReactNode;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const help = useContext(HelpProofContext);
  const stage = useModelStage();
  const canvas = useCanvasRef();
  const steps = gridSteps(model);
  const start = gridPose(model, 0);
  const n = model.size;
  const checked = playback || !!onSolutionShown || attemptedCell !== undefined;
  // Fill the width, but never more than the entry stage height (it already reserves the checked dock and
  // is kept through playback), so the board keeps one size in entry, proof and miss and never slides under the dock.
  // The miss dock (verdict, Watch again, Try again, Back to path) is about 32 pt taller than the reserved checked dock (plus a 12 pt clearance gap).
  const lane = instruction ? 40 : 0;
  const MISS_DOCK_EXTRA = 44;
  const fitHeight = stage.height > 0 ? stage.height - lane - 8 - MISS_DOCK_EXTRA : Infinity;
  const extent = Math.max(168, Math.min(width - 32, 560, help ? help.height - 8 - HELP_MOVE_LANE : fitHeight));
  const pitch = extent / n;
  const pad = 0;
  const board = extent;
  const centre = extent / 2;
  const solving = !!onSolutionShown;
  // A reflection first draws the matching distances to the mirror (one 240 ms beat), then flips in 300 ms.
  const pre = model.task === 'reflect' ? 1 : 0;
  const attempting = attemptedCell !== undefined;
  const count = solving ? steps + pre : 0;
  // Consensus tempo: 180 ms per square (one continuous slide), 240 ms per quarter-turn; the start is pinned for 120 ms.
  const beats = useRevealBeats(count, { awaitInitialPaint: solving && canSnapshotCanvas, easing: 'inOut', onDone: onSolutionShown, minTotal: 0, reducedSteps: true,
    lead: ProofMotion.lead + ProofMotion.beat[120],
    step: () => Math.min(820, 2400 / Math.max(1, steps + pre)),
    hold: landed => model.task === 'translate' && landed < count ? 0 : ProofMotion.repeatHold,
  });
  // Wait for the native destination letters to lay out at the same size as the canvas.
  const [laidOutExtent, setLaidOutExtent] = useState(0);
  useModelPaint(solving && laidOutExtent > 0 && Math.abs(laidOutExtent - extent) < 1, beats, canvas);
  const { position } = beats;
  const step = useDerivedValue(() => {
    const at = Math.max(0, position.value - pre);
    if (model.task !== 'rotate') return at;
    const whole = Math.floor(at);
    const time = 1 - Math.cbrt(1 - (at - whole));
    return whole + time * time * (3 - 2 * time);
  });
  // Equal distances on either side of the mirror, drawn along the start row.
  const distances = useMemo(() => {
    const path = Skia.Path.Make();
    if (model.task !== 'reflect') return path;
    const y = pad + pitch * start.y - Shape.lip / 2, mirrored = n - start.x;
    path.moveTo(pad + pitch * start.x, y); path.lineTo(centre, y); path.lineTo(pad + pitch * mirrored, y);
    return path;
  }, [model, pad, pitch, start.x, start.y, n, centre]);
  const measured = useDerivedValue(() => Math.min(1, Math.max(0, position.value)));
  const pose = useDerivedValue(() => gridPose(model, step.value));
  const pivot = { x: centre, y: centre - Shape.lip / 2 };
  const tip = useDerivedValue(() => ({
    x: pad + pitch * pose.value.x, y: pad + pitch * pose.value.y - Shape.lip / 2,
  }));
  const diameter = pitch - Shape.space.seam - Shape.lip;
  const marker = useAnimatedStyle(() => ({ transform: [
    { translateX: pad + pitch * pose.value.x - diameter / 2 }, { translateY: pad + pitch * pose.value.y - (Shape.lip + diameter) / 2 },
    { rotate: `${pose.value.angle}rad` }, { scaleX: pose.value.scaleX },
    { scale: 1 + .06 * Math.sin(Math.PI * Math.max(0, (step.value % 1 - .80) / .20)) },
  ] }));
  const trail = useMemo(() => {
    const path = Skia.Path.Make();
    const samples = model.task === 'rotate' ? steps * 24 : steps;
    for (let i = 0; i <= samples; i++) {
      const point = gridPose(model, steps * i / samples);
      const x = pad + pitch * point.x, y = pad + pitch * point.y - Shape.lip / 2;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    return path;
  }, [model, pad, pitch, steps]);
  const traced = useDerivedValue(() => model.task === 'reflect' ? (1 - pose.value.scaleX) / 2 : step.value / steps);

  const done = solving && beats.settled;
  const location = (cell: number) => t('everyday.gridLocation', { row: Math.floor((cell - 1) / n) + 1, column: (cell - 1) % n + 1 });
  return <DiagramSurface playing={solving} beats={beats}><View style={styles.wrap}>
    {instruction && (model.task === 'translate'
      ? <View style={styles.moveChip}><Text style={styles.moveText}>{instruction}</Text></View>
      : <View accessibilityElementsHidden={checked} importantForAccessibility={checked ? 'no-hide-descendants' : 'auto'}
          style={[styles.instruction, checked && styles.hiddenInstruction]}><Caption>{instruction}</Caption></View>)}
    <View collapsable={false} testID={checked ? "play-proof-model" : "play-entry-model"} nativeID={checked ? "play-proof-model" : "play-entry-model"} style={{ width: extent, height: extent }}
      onLayout={({ nativeEvent: { layout } }) => setLaidOutExtent(layout.width)}>
      <View accessible accessibilityRole="image" accessibilityLabel={model.label + ' ' + location(model.start)} style={StyleSheet.absoluteFill}>
      <View style={[styles.board, { top: pad, left: pad, width: board, height: board }]} />
      <Canvas ref={canvas} style={StyleSheet.absoluteFill}>
        {Array.from({ length: n * n }, (_, i) => {
          const inset = Shape.space.seam / 2;
          const face = { x: pad + i % n * pitch + inset, y: pad + Math.floor(i / n) * pitch + inset,
            width: pitch - 2 * inset, height: pitch - 2 * inset, r: Shape.tile(pitch) };
          return <Group key={i}>
            <RoundedRect {...face} color={Shape.emptyLip} />
            <RoundedRect {...face} height={Math.max(0, face.height - Shape.lip)} color={Shape.empty} />
          </Group>;
        })}
        <Group>
          {model.task === 'reflect' && <RoundedRect x={centre - 7} y={pad} width={14} height={board} r={7} color={Quantity.violet.light} />}
          {/* friendly-ok: a soft radius band connects the rotating mark to its pivot. */}
          {model.task === 'rotate' && <Line p1={pivot} p2={tip} color={Quantity.amber.light} strokeWidth={10} strokeCap="round" />}
          {/* friendly-ok: a moving path shows the translation or the rotation around its pivot. */}
          {solving && !help && !done && !attempting && <Path path={trail} end={traced} color={Quantity.violet.fill} style="stroke" strokeWidth={10} strokeJoin="round" strokeCap="round" />}
          {/* friendly-ok: these two measured paths show the equal distances from the mirror axis. */}
          {(!attempting && solving && !done && model.task === 'reflect') && <Path path={distances} end={measured} color={Quantity.violet.fill} style="stroke" strokeWidth={12} strokeCap="round" strokeJoin="round" />}
        </Group>
        {help && model.task === 'translate' && <VisitedFaces model={model} step={step} pitch={pitch} />}
        {model.task === 'rotate' && <Circle cx={centre} cy={centre - Shape.lip / 2} r={6}
          color={Quantity.amber.fill} style="fill" />}
      </Canvas>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: diameter, height: diameter }, marker]}>
        <GridPoint diameter={diameter} hue={help && done ? Quantity.amber : Quantity.teal} label={help ? undefined : "→"} />
      </Animated.View>
      {/* The cell numbers sit above the marker, so a number is always readable, on the board or on the token. */}
      {help && Array.from({ length: n * n }, (_, i) => <View key={i} style={{ position: 'absolute',
        left: i % n * pitch, top: Math.floor(i / n) * pitch, height: pitch, width: pitch, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.cellNumber}>{i + 1}</Text>
      </View>)}
      </View>
      {renderCells?.({ pad, pitch })}
    </View>
    {help && <>
      <MoveChips chips={moveChips(model)} landed={beats.landed} />
      <ProofLine equation={done ? [
        model.dx && t(`visualHelp.examples.grid_moves.${model.dx > 0 ? 'right' : 'left'}`, { n: Math.abs(model.dx) }),
        model.dy && t(`visualHelp.examples.grid_moves.${model.dy < 0 ? 'up' : 'down'}`, { n: Math.abs(model.dy) }),
      ].filter(Boolean).join(', ') : undefined} />
    </>}
  </View></DiagramSurface>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6, gap: 3 },
  moveChip: { alignSelf: 'center', borderRadius: 16, backgroundColor: Quantity.violet.soft, paddingHorizontal: 12, paddingVertical: 3 },
  cellNumber: { color: C.text, fontSize: 28, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  moveText: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  hiddenInstruction: { opacity: 0 },
  instruction: { alignSelf: 'stretch', flexShrink: 1, paddingHorizontal: 4 },
  board: { position: 'absolute', backgroundColor: C.card, borderRadius: Shape.tile(48) },
});
