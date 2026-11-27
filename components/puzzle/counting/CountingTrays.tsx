import { EntryBuild, IdleHint, MovablePiece } from '../kit/PracticeAffordances';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CountingCounter } from './CountingCounter';
import { ProofWindow } from './ProofWindow';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type AccessibilityActionEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Ink, Motion, ProofMotion, Quantity, Radius, Shape } from '@/constants/puzzle-theme';
import { countingTrays, type CountingTask } from '@/utils/quantity-task-scene';
import { UnitRunGlyph } from '../kit/UnitRun';
import { Canvas } from '@shopify/react-native-skia';
import { ProofLanding } from '../kit/ProofFeedback';
import { QuantityEquation } from './QuantityEquation';
import { useProofViewport } from '../PlayProofCaption';
import { canSnapshotModel, useModelPaint } from './useModelPaint';
import { LandingFrame } from './CountingLane';
import { countabilityFloor } from '../kit/DenseLayout';
import { DiagramIcon } from '../kit/DiagramIcon';
import { Caption } from '../kit/Focus';
import { RevealSurface } from '../kit/RevealSurface';
import { RevealEasing, useRevealBeats } from '../kit/useRevealBeats';
import { useFirstQuantityEncounter } from './QuantityPractice';
import { landTick } from '../kit/proofHaptics';
import { announceCounting } from './announcements';

const transferCueKey = 'counting-trays.transfer-cue-seen';
let transferCueSeen = false;

export function useTransferCue(eligible: boolean) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!eligible || transferCueSeen) return;
    let mounted = true;
    AsyncStorage.getItem(transferCueKey).catch(() => null).then(seen => {
      if (!mounted || transferCueSeen) return;
      transferCueSeen = true;
      if (seen) return;
      setVisible(true);
      // Keep the cue once per session even when local storage is unavailable.
      void AsyncStorage.setItem(transferCueKey, '1').catch(() => {});
    });
    return () => { mounted = false; };
  }, [eligible]);
  return eligible && visible;
}

type Layout = ReturnType<typeof countingTrays>;
type Mark = Layout['frames'][number]['a']['marks'][number];
type Tray = Layout['frames'][number]['a'];

function ExchangeRod({ model, box, phase, pitch }: { model: CountingTask; box: Tray; phase: SharedValue<number>; pitch: number }) {
  const rod = box.marks[box.marks.length - 1];
  const growth = useAnimatedStyle(() => ({ opacity: phase.value < 5 * Motion.stagger ? 0 : 1,
    transform: [{ scaleY: Math.max(.05, (phase.value - 5 * Motion.stagger) / Motion.tap) }] }));
  return <Animated.View style={[styles.mark, { left: box.x + rod.x, top: box.y + rod.y, width: pitch, height: rod.height }, growth]}>
    <Piece {...{ model, pitch }} mark={rod} added={rod.added} /></Animated.View>;
}

function Piece({ model, mark, pitch, added }: {
  model: CountingTask; mark: Mark; pitch: number; added: number;
}) {
  const size = pitch - Shape.space.loose;
  if (mark.value === 10) {
    const height = mark.height - Shape.space.loose;
    const cellSize = height / 10;
    return <Canvas style={{ width: cellSize, height }}>
      <UnitRunGlyph width={cellSize} height={height} count={10} columns={1} hue={i => i < 10 - added ? 'teal' : 'violet'} />
    </Canvas>;
  }
  return model.object ? <DiagramIcon name={model.object} size={size} tone={added ? 'secondary' : 'primary'} /> :
    <CountingCounter diameter={size * .73} hue={added ? 'violet' : 'teal'} />;
}

function TrayPiece({ entryIndex, left, top, mark, model, added, dx, dy, pitch, turn, landed, position, aroundTray, bundle, gatherX, gatherY, phase }: {
  entryIndex?: number; left: number; top: number; mark: Mark; model: CountingTask; added: number; dx: number; dy: number;
  pitch: number; turn: number; landed: number; position: SharedValue<number>; aroundTray: boolean;
  bundle: number; gatherX: number; gatherY: number; phase: SharedValue<number>;
}) {
  // The native layout commit that advances the caption also seats the piece the last two points.
  const contact = Math.min(12, pitch / 3);
  const seated = turn >= 0 && turn < landed;
  const style = useAnimatedStyle(() => {
    const t = turn < 0 ? 0 : Math.max(0, Math.min(1, position.value - turn));
    // Approach a new row from its open side, clear of the ribbons already counted.
    const across = aroundTray ? Math.max(0, (t - .4) / .6) : t;
    const down = aroundTray ? Math.min(1, t / .4) : t;
    const gather = bundle < 0 ? 0 : Math.min(1, Math.max(0, (phase.value - (bundle % 5) * Motion.stagger / 4) / (4 * Motion.stagger)));
    return { opacity: bundle >= 0 && phase.value >= Motion.stagger * 5 ? 0 : 1, transform: [
      { translateX: dx * across + gatherX * gather },
      { translateY: (dy - contact) * down - Math.sin(Math.PI * t) * Math.min(12, pitch / 3) + gatherY * gather },
      { scale: 1 - .8 * gather },
    ] };
  });
  const glyph = <Piece {...{ model, mark, pitch, added }} />;
  return <Animated.View style={[styles.mark, { left, top: top + (seated ? contact : 0), width: pitch, height: mark.height, zIndex: turn === landed ? 2 : 0 }, style]}>
    <ProofLanding landed={seated}>{entryIndex === undefined ? glyph : <EntryBuild index={entryIndex}>{glyph}</EntryBuild>}</ProofLanding>
  </Animated.View>;
}

function sameSlot(a: Mark, b: Mark) {
  return a.value === b.value && a.row === b.row && a.col === b.col;
}

export function CountingTrays({ model, running, interactive = false, onSolutionShown }: {
  model: CountingTask; running: boolean; interactive?: boolean; showExpression: boolean; onSolutionShown?: () => void;
}) {
  const { t } = useTranslation();
  const viewport = useWindowDimensions();
  const modelViewport = useProofViewport();
  const [width, setWidth] = useState(0);
  const prefix = 'countingScene.';
  const startLabel = t(prefix + 'startLabel', { count: model.left });
  const compactEditor = !running;
  const editing = interactive && !running;
  const [interacted, setInteracted] = useState(false);
  const firstTransfer = useFirstQuantityEncounter('transfer', editing && width > 0);
  const showCue = useTransferCue(editing && width > 0 && !interacted);
  const [cueHeight, setCueHeight] = useState(0);
  const editorHeight = compactEditor && modelViewport
    ? Math.max(1, modelViewport.availableModelHeight - (showCue ? cueHeight : 0)) : undefined;
  // DiagramGlyph silhouettes span at least 47/64 of their frame; dots span 73%.
  const floor = countabilityFloor(model.object ? 'illustration' : 'cell', viewport.fontScale > 1.3, true);
  const pieceFloor = compactEditor ? 4 + Math.ceil(floor / (model.object ? 47 / 64 : .73)) : undefined;
  const rodCell = countabilityFloor('cell', viewport.fontScale > 1.3, true);
  const layout = useMemo(() => countingTrays(model, width || viewport.width - 48, 0, undefined, compactEditor, {
    rodCell, editorHeight, pieceFloor, fitColumns: running && model.kind === 'join',
  }), [model, width, viewport.width, compactEditor, running, editorHeight, pieceFloor, rodCell]);
  const { join, frames, amounts, pitch } = layout;
  const count = amounts.length - 1;
  const measured = width > 0;
  const clock = useRevealBeats(running && !measured ? null : running ? count : 0, {
    awaitInitialPaint: running && canSnapshotModel,
    step: i => Math.min(i === 0 ? ProofMotion.travel : ProofMotion.countStride, ProofMotion.maxCountTravel / count),
    hold: n => layout.grouped && (model.left + amounts[n]) % 10 === 0 ? ProofMotion.inspection :
      n === count ? ProofMotion.settle : 0,
    // The take-away opening already waits for the starting stars to paint.
    reducedSteps: true, minTotal: 0, lead: join ? ProofMotion.lead : 0, onDone: running && measured ? onSolutionShown : undefined,
  });
  const drawing = useModelPaint(running && measured, clock);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [manual, setManual] = useState(0);
  const [movingTo, setMovingTo] = useState<number | null>(null);
  const moving = movingTo !== null;
  const inFlight = useRef(false);
  const practice = useSharedValue(0);
  const landed = running ? clock.landed : manual;
  const current = frames[landed], amount = amounts[landed], next = layout.flights[landed];
  // While a piece is travelling, its destination has space for the arriving piece.
  const arriving = movingTo === null ? current : frames[movingTo];
  const aWidth = Math.max(44, current.a.width, arriving.a.width), bWidth = Math.max(44, current.b.width, arriving.b.width);
  const sideBySide = current.a.y === current.b.y;
  const trayGap = 16;
  const contentWidth = sideBySide ? aWidth + trayGap + bWidth : Math.max(aWidth, bWidth);
  const aHeight = Math.max(44, current.a.height, arriving.a.height);
  const frame = compactEditor ? { ...current,
    a: { ...current.a, x: sideBySide ? 0 : (contentWidth - aWidth) / 2, width: aWidth, height: aHeight },
    b: { ...current.b, x: sideBySide ? aWidth + trayGap : (contentWidth - bWidth) / 2,
      y: sideBySide ? current.b.y : current.a.y + aHeight + trayGap, width: bWidth, height: Math.max(44, current.b.height, arriving.b.height) },
  } : current;
  const settled = running && measured && clock.settled;
  const mainCount = model.left + (join ? amount : -amount);
  const bankCount = join ? model.right - amount : amount;
  const equation = `${model.left} ${join ? '+' : '−'} ${model.right} = ${model.left + (join ? model.right : -model.right)}`;
  const result = t(prefix + (join ? 'joinResult' : 'takeResult'), { start: model.left, amount, result: mainCount });
  const announced = useRef(-1);
  const notified = useRef(0);
  const change = amount - (amounts[landed - 1] ?? 0);
  const exchangeBeat = layout.grouped && landed > 0 && change === 1 && mainCount % 10 === 0;
  const moveDescription = running && exchangeBeat ? t(prefix + 'exchangeAnnouncement', { tens: mainCount / 10 }) :
    t(prefix + (change === 10 ? 'movedTen' : 'movedOne')) + ' ' +
    (join && bankCount === 0 ? t(prefix + 'allMoved') : t(prefix + (join ? 'toAddLabel' : 'cardLabel'), { count: bankCount }));
  const { position: playback, reduced, skipped, announce } = clock;
  const position = useDerivedValue(() => reduced ? landed : running ? playback.value : practice.value);
  const sourceBox = join ? frame.b : frame.a;
  const targetBox = join ? frame.a : frame.b;
  const trayPulse = useSharedValue(0);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: trayPulse.value }));
  useEffect(() => {
    inFlight.current = false;
    if (landed === 0) { notified.current = 0; return; }
    if (notified.current === landed || skipped) return;
    notified.current = landed;
    if (!running) announceCounting(moveDescription);
    else if (exchangeBeat) {
      announce(moveDescription);
    }
    if (clock.reduced) return;
    if (!running) return;
    if (landed === count || (join && mainCount === 10)) trayPulse.set(withSequence(withTiming(1, { duration: Motion.tap }), withTiming(0, { duration: Motion.settle })));
  }, [landed, count, join, mainCount, running, clock.reduced, clock.runId, exchangeBeat, moveDescription, trayPulse, skipped, announce]);
  useEffect(() => {
    if (!settled || announced.current === clock.runId) return;
    announced.current = clock.runId;
    announce(result);
  }, [settled, clock.runId, announce, result]);

  function finishTurn(step: number) {
    setManual(step);
    setMovingTo(null);
  }
  function moveOne(forward: boolean) {
    if (inFlight.current || forward && !next || !forward && !manual) return;
    inFlight.current = true;
    const step = manual + (forward ? 1 : -1);
    if (clock.reduced) { practice.set(step); finishTurn(step); return; }
    setMovingTo(step);
    practice.set(withTiming(step, { duration: ProofMotion.travel, easing: RevealEasing }, done => {
      if (done) runOnJS(finishTurn)(step);
    }));
  }
  const action = !next ? t('challenges.undoStep') : !join ? t(prefix + 'card') : next.value === 10 ? t(prefix + 'moveTen') :
    t(prefix + 'move.' + (model.object ?? 'piece'), { defaultValue: t(prefix + 'move.piece') });
  const regroup = exchangeBeat && !reduced && !skipped;
  const oldBox = regroup ? frames[landed - 1].a : frame.a;
  const phase = useSharedValue(0);
  useEffect(() => {
    const duration = Motion.stagger * 5 + Motion.tap;
    phase.set(regroup ? withTiming(duration, { duration }) : 0);
  }, [regroup, phase]);
  const boxStyle = useAnimatedStyle(() => {
    const shrink = Math.min(1, phase.value / (Motion.stagger * 5));
    return { width: oldBox.width + (frame.a.width - oldBox.width) * shrink, height: oldBox.height + (frame.a.height - oldBox.height) * shrink };
  });
  const trayBounds = (main: boolean) => {
    const box = main ? frame.a : frame.b;
    return { left: box.x, top: box.y,
      width: compactEditor ? box.width : main ? layout.mainWidth : layout.bankWidth,
      height: compactEditor ? box.height : main ? layout.mainHeight : layout.bankHeight };
  };
  const mainTray = trayBounds(true), bankTray = trayBounds(false);
  const boardHeight = compactEditor ? Math.max(mainTray.top + mainTray.height, bankTray.top + bankTray.height) : layout.height;
  // A first-use cue follows the trays in the outer scroll area. Keep both touch targets
  // visible whenever the space above the keypad can hold the floor-sized drawing.
  const trayViewportHeight = editorHeight == null || !modelViewport ? undefined
    : Math.max(editorHeight, Math.min(boardHeight, modelViewport.availableModelHeight));
  const tray = (main: boolean) => {
    const bounds = main ? mainTray : bankTray;
    return <><Animated.View key={main && regroup ? 'exchange' : 'rest'} style={[styles.tray, !main && {backgroundColor: join ? Quantity.violet.soft : Quantity.amber.soft}, bounds,
      main && regroup && boxStyle]} />
      {main && running && <Animated.View style={[styles.tray, styles.pulse, bounds, pulseStyle]} />}</>;
  };
  const marks = (main: boolean, box: Tray = main ? frame.a : frame.b) => {
    const bundling = main && regroup;
    const pieces = bundling ? [...oldBox.marks, layout.flights[landed - 1].target] : box.marks;
    return pieces.map((mark, i) => {
      const bundle = bundling && mark.value === 1 ? i - (pieces.length - 10) : -1;
      const rod = frame.a.marks[frame.a.marks.length - 1];
      // Source and destination views live in one keyed list. A transfer keeps its mounted glyph
      // and its original path on both sides of the landing, including when the donor disappears.
      const receiving = main === join;
      if (main && !join && i >= mainCount) return null;
      const turn = layout.flights.findIndex((flight, index) => receiving
        ? index < landed && sameSlot(flight.target, mark) : index >= landed && sameSlot(flight.source, mark));
      const flight = layout.flights[turn];
      const source = flight && (compactEditor && !receiving ? mark : flight.source);
      const target = flight && (compactEditor && receiving ? mark : flight.target);
      const left = source ? sourceBox.x + source.x : box.x + mark.x;
      const top = source ? sourceBox.y + source.y : box.y + mark.y;
      const aroundTray = !!flight && join && !layout.grouped && flight.target.row === 2 && flight.target.col === 0 && frame.a.y === frame.b.y;
      return <TrayPiece entryIndex={interactive && !running ? turn >= 0 ? turn : i : undefined} key={flight ? `flight-${turn}` : `${main ? 'main' : 'bank'}-${mark.value}-${mark.row}-${mark.col}`}
        {...{ left, top, mark, model, pitch, turn, landed, position, aroundTray, phase, bundle }} added={main ? mark.added : join ? mark.value : 0}
        dx={target ? targetBox.x + target.x - left : 0} dy={target ? targetBox.y + target.y - top : 0}
        gatherX={bundle >= 0 ? rod.x - mark.x : 0}
        gatherY={bundle >= 0 ? rod.y + (bundle + .5) * rod.height / 10 - pitch / 2 - mark.y : 0} />;
    });
  };
  const bankCaption = !join || bankCount > 0 ? t(prefix + (join ? 'toAddLabel' : 'cardLabel'), { count: bankCount }) : '';
  const mainLabel = running ? settled ? result : t(prefix + 'trayCount', { count: mainCount }) :
    [startLabel, amount ? t(prefix + (join ? 'addedLabel' : 'cardLabel'), { count: amount }) : ''].filter(Boolean).join('. ');
  const body = <View testID="practice-board" onTouchStart={editing && !interacted ? () => setInteracted(true) : undefined} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <LandingFrame reduced={reduced} step={landed}><View ref={drawing} collapsable={false} nativeID={running ? "play-proof-model" : undefined} testID={running ? "play-proof-model" : undefined}><ProofWindow height={trayViewportHeight} contentHeight={compactEditor ? boardHeight : undefined} focus={compactEditor ? 0 : (frame.a.y + layout.mainHeight / 2) / layout.height}><View testID={compactEditor ? "play-entry-model" : undefined} style={{ alignSelf: 'center', width: compactEditor ? contentWidth : width || viewport.width - 48, height: boardHeight }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {tray(true)}
      {regroup && <ExchangeRod model={model} box={frame.a} phase={phase} pitch={pitch} />}
      {(!running || !join || bankCount > 0) && tray(false)}
      {join && bankCount > 0 && <Animated.View style={[styles.operator, { left: compactEditor && sideBySide ? bankTray.left - trayGap / 2 - 14 : compactEditor ? contentWidth / 2 - 14 : layout.plus.x - 14,
        top: compactEditor && !sideBySide ? bankTray.top - trayGap / 2 - 15 : layout.plus.y - 15 }]}>
        <View style={styles.plusAcross} /><View style={styles.plusDown} />
      </Animated.View>}
      </View>
      {[true, false].map(main => {
        const bounds = main ? mainTray : bankTray;
        const donor = main !== join;
        const label = main ? mainLabel : bankCaption;
        const targetStyle = { position: 'absolute' as const, ...bounds,
          width: Math.max(44, bounds.width), height: Math.max(44, bounds.height),
          borderRadius: Radius.tray };
        if (!editing && !main && running && join && !bankCount) return null;
        if (!editing) return <View key={String(main)} accessible accessibilityRole="image" accessibilityLabel={label}
          testID={main ? 'counting-main-tray' : 'counting-bank-tray'} style={targetStyle} />;
        const canPick = donor ? !!next : manual > 0;
        const pickedHere = picked === donor;
        const legal = picked !== null && !pickedHere;
        function activate() {
          setInteracted(true);
          if (moving) return;
          if (legal && picked !== null) { moveOne(picked); setPicked(null); }
          else if (canPick) setPicked(pickedHere ? null : donor);
        }
        const moveLabel = donor ? action : t('challenges.undoStep');
        const control = {
          testID: main ? 'counting-main-tray' : 'counting-bank-tray',
          accessibilityLabel: label || action, accessibilityHint: moveLabel, style: targetStyle, onPress: activate,
          accessibilityActions: [{ name: 'activate' }, ...(canPick ? [{ name: 'move', label: moveLabel }] : [])],
          onAccessibilityAction: (event: AccessibilityActionEvent) => {
            setInteracted(true);
            if (moving) return;
            if (event.nativeEvent.actionName === 'move' && canPick) { setPicked(null); moveOne(donor); }
            else activate();
          },
        };
        return pickedHere || (donor && !legal && canPick)
          ? <MovablePiece key={String(main)} {...control} borderless selected={pickedHere} />
          : <Pressable key={String(main)} {...control} accessibilityRole="button" accessibilityState={{selected: false}}
              onPress={() => { landTick(); activate(); }} style={[targetStyle, legal && {backgroundColor: (main ? Quantity.teal : join ? Quantity.violet : Quantity.amber).light}]} />;
      })}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.foreground]}>
        {[...marks(true), ...marks(false)]}
        {editing && firstTransfer && measured && next && <IdleHint movable={editing} firstEncounter={firstTransfer} interacted={interacted}
          from={{ x: sourceBox.x + next.source.x + pitch / 2, y: sourceBox.y + next.source.y + next.source.height / 2 }}
          to={{ x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 }} />}
      </View>
    </View></ProofWindow></View></LandingFrame>
    {running && <QuantityEquation text={equation} settled={settled} />}
    {showCue && <View onLayout={e => setCueHeight(e.nativeEvent.layout.height)}><Caption>{t('friendlyQ.shareHint')}</Caption></View>}
  </View>;
  return running ? <RevealSurface beats={clock}>{body}</RevealSurface> : body;

}

const styles = StyleSheet.create({
  foreground: { zIndex: 1 },
  tray: { position: 'absolute', borderRadius: Radius.tray, backgroundColor: Quantity.teal.soft },
  mark: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  operator: { position: 'absolute', width: 28, height: 30, justifyContent: 'center', alignItems: 'center' },
  plusAcross: { width: 24, height: 5, borderRadius: 2, backgroundColor: Ink.text },
  plusDown: { position: 'absolute', height: 24, width: 5, borderRadius: 2, backgroundColor: Ink.text },
  pulse: { backgroundColor: Quantity.teal.light },
});
