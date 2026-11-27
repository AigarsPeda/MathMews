import { useLayoutEffect, useState } from 'react';
import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { glyphs } from '../glyphs/library';
import { Pressable, StyleSheet, useWindowDimensions, View, type AccessibilityActionEvent } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ink, ProofMotion, Quantity, Radius, Shape } from '@/constants/puzzle-theme';
import type { CountingTask } from '@/utils/quantity-task-scene';
import { Caption } from '../kit/Focus';
import { DiagramIcon } from '../kit/DiagramIcon';
import { EntryBuild, IdleHint, MovablePiece } from '../kit/PracticeAffordances';
import { RevealSurface } from '../kit/RevealSurface';
import { landTick } from '../kit/proofHaptics';
import { useRevealBeats } from '../kit/useRevealBeats';
import { CountingCounter } from './CountingCounter';
import { QuantityEquation } from './QuantityEquation';
import { useProofViewport } from '../PlayProofCaption';
import { useFirstQuantityEncounter, useQuantityPractice } from './QuantityPractice';
import { QuantityStage } from './QuantityStage';
import { ProofLanding } from '../kit/ProofFeedback';
import { useTransferCue } from './CountingTrays';
import { canSnapshotModel, useModelPaint } from './useModelPaint';
import { useProofAnnouncement } from './useProofAnnouncement';

type Point = {x: number; y: number};
function TransferPiece({ from, to, turn, size, model, progress, entry, index, selected, landed }: {
  from: Point; to: Point; turn: number; size: number; model: CountingTask; progress: SharedValue<number>;
  landed: boolean; entry: boolean; index: number; selected: boolean;
}) {
  const moving = turn >= 0;
  const motion = useAnimatedStyle(() => {
    const t = moving ? Math.min(1, Math.max(0, progress.value - turn)) : 0;
    return { transform: [{translateX: (to.x - from.x) * t}, {translateY: (to.y - from.y) * t - 8 * Math.sin(Math.PI * t)}] };
  });
  const secondary = moving && model.kind === 'join';
  const face = model.object ? <DiagramIcon name={model.object} size={size} tone={secondary ? 'secondary' : 'primary'} /> :
    <CountingCounter diameter={size * .73} hue={secondary ? 'violet' : 'teal'} />;
  return <Animated.View style={[styles.piece, {left: from.x, top: from.y, width: size, height: size}, selected && styles.picked, motion]}>
    <ProofLanding landed={landed}>{entry ? <EntryBuild index={index}>{face}</EntryBuild> : face}</ProofLanding>
  </Animated.View>;
}

/** Each object owns one source, one destination and one painted glyph throughout the attempt. */
export function TransferBoard({ model, running, interactive = false, onSolutionShown }: {
  model: CountingTask; running: boolean; interactive?: boolean; onSolutionShown?: () => void;
}) {
  const { t } = useTranslation();
  const screen = useWindowDimensions();
  const viewport = useProofViewport();
  const practice = useQuantityPractice();
  const [measured, setWidth] = useState(0);
  const [manual, setManual] = useState(() => Math.min(model.right, practice.snapshot.transfers));
  const [picked, pick] = useState<boolean | null>(null);
  const [touched, touch] = useState(false);
  const editing = interactive && !running;
  const first = useFirstQuantityEncounter('transfer', editing && measured > 0);
  const showCue = useTransferCue(editing && measured > 0 && !touched);
  const join = model.kind === 'join';
  const base = running ? manual : 0;
  const remaining = model.right - base;
  const transferStep = Math.min(300, Math.floor(3300 / Math.max(1, remaining)));
  const beats = useRevealBeats(running ? measured ? Math.max(1, remaining) : null : 0, {
    awaitInitialPaint: running && canSnapshotModel, lead: join ? 65 : 0,
    step: i => !join && i === 0 ? Math.min(ProofMotion.travel, transferStep) : transferStep, hold: 12,
    minTotal: 0, reducedSteps: true, onDone: running ? onSolutionShown : undefined,
  });
  const hand = useSharedValue(manual);
  const progress = useDerivedValue(() => running ? Math.min(model.right, base + beats.position.value) : hand.value);
  const moved = running ? Math.min(model.right, base + beats.landed) : manual;
  const result = model.left + (join ? model.right : -model.right);
  const equation = `${model.left} ${join ? '+' : '−'} ${model.right} = ${result}`;
  useProofAnnouncement(beats, beats.settled ? equation : '', running);
  const drawing = useModelPaint(measured > 0 && running, beats);
  const width = Math.max(100, measured || viewport?.innerWidth || screen.width - 48);
  const total = model.left + (join ? model.right : 0);
  const gap = join ? 28 : 12, inset = 4;
  const columnsFor = (size: number) => {
    const pitch = size + Shape.space.loose;
    const slots = Math.max(2, Math.floor((width - 4 * inset - gap) / pitch));
    const rightCols = Math.max(1, Math.min(model.right, Math.floor(slots / 2), join ? model.right : Math.ceil(model.right / 2)));
    const cardWidth = Math.min(width / 2, Math.max(join ? 44 : 72, rightCols * pitch + 2 * inset));
    const leftCols = Math.max(1, Math.min(total, Math.floor((width - cardWidth - gap - 2 * inset) / pitch)));
    return {rightCols, cardWidth, leftCols};
  };
  const maxHeight = Math.min(screen.height * .38, (viewport?.availableModelHeight ?? screen.height) - 12);
  let fit = Math.min(72, Math.floor((width - 4 * inset - gap) / 2) - Shape.space.loose);
  while (fit > 38) {
    const {rightCols, leftCols} = columnsFor(fit);
    const rows = Math.max(Math.ceil(total / leftCols), Math.ceil(model.right / rightCols));
    if (rows * (fit + Shape.space.loose) + 2 * inset <= maxHeight) break;
    fit--;
  }
  const layoutKey = `${width}:${screen.height}:${screen.fontScale}`;
  const size = !running ? fit : practice.snapshot.transferSizes.get(layoutKey) ?? fit;
  useLayoutEffect(() => {
    if (!running && measured && viewport) practice.snapshot.transferSizes.set(layoutKey, size);
  }, [running, measured, viewport, practice, layoutKey, size]);
  const pitch = size + Shape.space.loose;
  const {rightCols, cardWidth, leftCols} = columnsFor(size);
  const mainWidth = Math.min(width - cardWidth - gap, leftCols * pitch + 2 * inset);
  const boardWidth = mainWidth + gap + cardWidth;
  const heightFor = (n: number, cols: number) => 2 * inset + Math.max(1, Math.ceil(n / cols)) * pitch;
  const maxMain = heightFor(total, leftCols), maxCard = Math.max(join ? 44 : 72, heightFor(model.right, rightCols));
  const height = Math.max(maxMain, maxCard);
  const mainHeight = maxMain;
  const mainTop = (height - maxMain) / 2, cardTop = (height - maxCard) / 2;
  const slot = (main: boolean, i: number): Point => {
    const cols = main ? leftCols : rightCols;
    const left = main ? 0 : mainWidth + gap;
    return {x: left + ((main ? mainWidth : cardWidth) - cols * pitch) / 2 + Shape.space.loose / 2 + i % cols * pitch,
      y: (main ? mainTop : cardTop) + inset + Shape.space.loose / 2 + Math.floor(i / cols) * pitch};
  };
  const source = (turn: number) => join ? slot(false, turn) : slot(true, total - 1 - turn);
  const destination = (turn: number) => join ? slot(true, model.left + turn) : slot(false, turn);
  const center = (p: Point) => ({x: p.x + size / 2, y: p.y + size / 2});
  function transfer(forward: boolean) {
    const next = Math.max(0, Math.min(model.right, manual + (forward ? 1 : -1)));
    practice.saveTransfers(next); setManual(next); pick(null);
    hand.set(beats.reduced ? next : withTiming(next, {duration: ProofMotion.travel}));
  }
  function tray(main: boolean) {
    const donor = main !== join;
    const legal = picked !== null && picked !== donor;
    const canPick = donor ? manual < model.right : manual > 0;
    const label = main ? t('countingScene.inTray', {count: model.left + (join ? moved : -moved)}) :
      t(join ? 'countingScene.toAddLabel' : 'countingScene.cardLabel', {count: join ? model.right - moved : moved});
    const bounds = {left: main ? 0 : mainWidth + gap, top: main ? mainTop : cardTop, width: main ? mainWidth : cardWidth, height: main ? mainHeight : maxCard};
    const testID = main ? 'counting-main-tray' : 'counting-bank-tray';
    const trayTint = !main && !join ? Quantity.amber : main ? Quantity.teal : Quantity.violet;
    const starCard = !join && !main && model.object === 'star';
    const fill = interactive && legal && !starCard ? trayTint.light : trayTint.soft;
    if (!editing) return <View key={testID} testID={testID} accessible accessibilityRole="image" accessibilityLabel={label}
      style={[styles.tray, bounds, {backgroundColor: trayTint.soft}]} />;
    const activate = () => { touch(true); if (legal && picked !== null) transfer(picked); else if (canPick) pick(picked === donor ? null : donor); };
    const hint = donor ? t(join ? 'countingScene.move.piece' : 'countingScene.card') : t('challenges.undoStep');
    const actions = [{name: 'activate'}, ...(canPick ? [{name: 'move', label: hint}] : [])];
    const onAction = (e: AccessibilityActionEvent) => { touch(true); if (e.nativeEvent.actionName === 'move' && canPick) transfer(donor); else activate(); };
    const control = { testID, accessibilityLabel: label, accessibilityHint: hint, accessibilityActions: actions,
      onAccessibilityAction: onAction, style: [styles.tray, bounds, {backgroundColor: fill}] };
    if (canPick && !legal) return <MovablePiece key={testID} {...control} selected={picked === donor} onPress={activate}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {bottom: Shape.lip, borderRadius: Radius.tray, backgroundColor: fill}]} />
    </MovablePiece>;
    return <Pressable key={testID} {...control} disabled={!legal} accessibilityRole="button"
      onPress={() => {landTick(); activate();}} />;
  }
  const board = <View testID="practice-board" onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <QuantityStage model={model.kind} locked={!interactive}><View ref={drawing} collapsable={false} nativeID={running ? 'play-proof-model' : 'play-entry-model'} testID={running ? 'play-proof-model' : 'play-entry-model'}
      style={{alignSelf: 'center', width: boardWidth, height}}>
      {tray(true)}{tray(false)}
      {!join && model.object === 'star' && <Canvas pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
        {Array.from({length: model.right}, (_, turn) => {
          if (turn < moved) return null;
          const point = destination(turn);
          return <Group key={turn} transform={[{translateX: point.x + size * .07}, {translateY: point.y + size * .07}, {scale: size * .86 / 64}]}>
            <Path path={glyphs.star.body} color={Quantity.amber.light} />
          </Group>;
        })}
      </Canvas>}
      {join && <View pointerEvents="none" style={[styles.plus, {left: mainWidth, width: gap, top: height / 2 - 12}]}><View style={styles.across}/><View style={styles.down}/></View>}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        {Array.from({length: total}, (_, id) => {
          const turn = join ? id - model.left : total - 1 - id;
          const movable = turn >= 0 && turn < model.right;
          const from = movable ? source(turn) : slot(true, id);
          return <TransferPiece key={id} from={from} to={movable ? destination(turn) : from} turn={movable ? turn : -1}
            {...{size, model, progress}} entry={!running} index={id} landed={movable && moved > turn} selected={editing && movable && (picked === true && turn === manual || picked === false && turn === manual - 1)} />;
        })}
      </View>
      {editing && first && model.right > 0 && <IdleHint movable={interactive && !running} firstEncounter={first} interacted={touched || moved > 0} from={center(source(0))} to={center(destination(0))} />}
    </View>
    {showCue && (viewport?.availableModelHeight ?? Infinity) > height + 64 && <Caption>{t('friendlyQ.shareHint')}</Caption>}
    </QuantityStage>
    {running && <QuantityEquation text={equation} settled={beats.settled} />}
  </View>;
  return running ? <RevealSurface beats={beats}>{board}</RevealSurface> : board;
}
const styles = StyleSheet.create({
  tray: {position: 'absolute', borderRadius: Radius.tray}, piece: {position: 'absolute', alignItems: 'center', justifyContent: 'center'},
  picked: {backgroundColor: Quantity.berry.light, borderRadius: 12},
  plus: {position: 'absolute', height: 24, alignItems: 'center', justifyContent: 'center'},
  across: {width: 24, height: 5, backgroundColor: Ink.text, borderRadius: 2}, down: {position: 'absolute', width: 5, height: 24, backgroundColor: Ink.text, borderRadius: 2},
});
