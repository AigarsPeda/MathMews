import { useProofModelScroll } from '@/components/puzzle/place-value/ExchangeDetail';
import Animated, { FadeIn, FadeOut, ReduceMotion, useDerivedValue } from 'react-native-reanimated';
import { PlayProofCaption, useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Caption } from '@/components/puzzle/kit/Focus';
import { PressFace } from '@/components/puzzle/kit/PressFace';
import { useModelStage } from '@/components/puzzle/kit/ModelStage';
import { landTick } from '@/components/puzzle/kit/proofHaptics';
import { ProofFinale } from '@/components/puzzle/kit/ProofFeedback';
import { RevealSurface, TaskLiveControls } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { Ink, Motion, ProofMotion, Quantity, PuzzleColors as Colors, Radius, Shape } from '@/constants/puzzle-theme';
import { PlaceValueMat, type PlaceValueTransition } from '@/components/puzzle/place-value/PlaceValueMat';
import type { PlaceValuePuzzle, Puzzle } from '@/types/puzzle';
import { changePlaceValue, checkPlaceValue, initialPlaceValue, placeValueCapacity, placeValueProof, type PlaceValueAction, type PlaceValueState } from '@/utils/place-value';
import type { PuzzleAnswer } from '@/utils/puzzle-type';
import { Fragment, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';


type Props = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  puzzle: PlaceValuePuzzle;
  value: PlaceValueState | null;
  onChange: (value: PlaceValueState | null) => void;
  answered: boolean;
};

export function PlaceValueTask({ AnswerRow, puzzle, value, onChange, answered, retryOnly }: Props & { retryOnly?: boolean }) {
  const [movedPuzzle, setMovedPuzzle] = useState<string | null>(null);
  const state = value ?? initialPlaceValue(puzzle);
  const key = `${puzzle.id}:${state.tens}:${state.ones}:${state.added}`;
  const [prior, setPrior] = useState<{ key: string; boardKey: string; state: PlaceValueState; transition?: PlaceValueTransition }>(
    { key, boardKey: puzzle.id, state },
  );
  if (prior.key !== key) {
    const from = prior.state;
    const samePuzzle = prior.key.startsWith(`${puzzle.id}:`);
    const exchange = state.tens * 10 + state.ones === from.tens * 10 + from.ones && state.tens !== from.tens;
    const transition: PlaceValueTransition | undefined = value && samePuzzle
      ? !from.added && state.added ? { kind: 'join', from }
        : exchange ? { kind: state.tens > from.tens ? 'bundle' : 'split', from } : undefined : undefined;
    const boardKey = !samePuzzle || !value ? puzzle.id : transition ? key : prior.boardKey;
    setPrior({ key, boardKey, state, transition });
  }
  return <PlaceValueBoard key={prior.boardKey} AnswerRow={AnswerRow} puzzle={puzzle} value={value} moved={movedPuzzle === puzzle.id}
    onChange={next => { setMovedPuzzle(next ? puzzle.id : null); onChange(next); }}
    answered={answered || !!retryOnly} transition={retryOnly ? undefined : prior.transition} retryOnly={retryOnly} />;
}

type PlaceAnswer = Extract<PuzzleAnswer, { kind: 'place_value' }>;

export function placeValueFixtureAnswer(puzzle: PlaceValuePuzzle): PlaceAnswer {
  return { kind: 'place_value', state: placeValueProof(puzzle).final };
}

export function hasPlaceValueExchangeReveal(puzzle: Puzzle): puzzle is PlaceValuePuzzle & { payload: { mode: 'bundle' | 'split' } } {
  return puzzle.type === 'place_value' && (puzzle.payload.mode === 'bundle' || puzzle.payload.mode === 'split');
}

export function PlaceValueExchangeReveal({ puzzle, onSolutionShown }: { puzzle: PlaceValuePuzzle; onSolutionShown: () => void }) {
  return <PlaceValueBuildReveal puzzle={puzzle} answer={placeValueFixtureAnswer(puzzle)} onSolutionShown={onSolutionShown} />;
}

export function PlaceValueBuildReveal({ puzzle, answer, mode: proofMode = 'attempt', onSolutionShown }: {
  puzzle: PlaceValuePuzzle; answer: PlaceAnswer; mode?: 'attempt' | 'worked'; onSolutionShown: () => void;
}) {
  const viewport = useProofViewport();
  const stage = useModelStage();
  const modelHeight = viewport?.availableModelHeight || stage.height;
  const modelScroll = useProofModelScroll(viewport ? viewport.availableModelHeight - 16 : undefined);
  const { initial, beats: moves, final } = placeValueProof(puzzle);
  const { mode, start, operand = 0 } = puzzle.payload;
  const correct = checkPlaceValue(puzzle, answer.state);
  const worked = correct || proofMode === 'worked';
  const timeline = worked ? moves : [{ state: answer.state, move: 'start' as const, duration: 120 as const }];
  const clock = useRevealBeats(timeline.length, {
    lead: 0, minTotal: 0, reducedSteps: true, step: index => timeline[index].move === 'split' || timeline[index].move === 'bundle'
      ? 400 : ProofMotion.beat[timeline[index].duration],
    hold: landed => ['bundle', 'split'].includes(timeline[landed - 1]?.move) || timeline[landed]?.move === 'bundle'
      ? ProofMotion.inspection : landed === timeline.length ? ProofMotion.settle : ProofMotion.press,
    onDone: onSolutionShown,
  });
  const { position, landed, reduced } = clock;
  const transferProgress = useDerivedValue(() => Math.max(0, Math.min(1, position.get() - landed)));
  const motionPosition = useDerivedValue(() => 1 + Math.max(0, position.get() - landed));
  const current = timeline[Math.max(0, landed - 1)].state;
  const upcoming = timeline[landed];
  const activeExchange = upcoming?.move === 'bundle' || upcoming?.move === 'split' ? upcoming.move : undefined;
  const committedMove = timeline[landed - 1]?.move;
  const exchangeMode = timeline.find(beat => beat.move === 'bundle' || beat.move === 'split')?.move as 'bundle' | 'split' | undefined;
  const transition = activeExchange && !reduced ? { kind: activeExchange, from: current } as const
    : (committedMove === 'bundle' || committedMove === 'split') && landed > 1
      ? { kind: committedMove, from: timeline[landed - 2].state } as const : undefined;
  const runExchange = Boolean(activeExchange && !reduced);
  const traceSubmitted = mode === 'build' && worked;
  const next = traceSubmitted ? final : runExchange ? upcoming.state : current;
  const trace = traceSubmitted && !clock.settled && landed > 1
    ? committedMove === 'addTen' ? { unit: 'tens' as const, index: current.tens - 1 }
      : { unit: 'ones' as const, index: Math.max(0, current.ones - 1), fromIndex: 0 }
    : undefined;
  const transfer = landed > 0 && !reduced && upcoming
    ? upcoming.move === 'join' ? { kind: 'join' as const, after: upcoming.state, progress: transferProgress }
      : upcoming.move === 'removeOne' || upcoming.move === 'removeTens' ? { kind: 'remove' as const, after: upcoming.state, progress: transferProgress } : undefined
    : undefined;
  const addend = mode === 'add' && worked ? { tens: Math.floor(operand / 10), ones: operand % 10 } : undefined;
  const pending = addend && !current.added ? { tens: initial.tens + addend.tens - current.tens,
    ones: initial.ones + addend.ones - current.ones } : undefined;
  const capacity = placeValueCapacity(puzzle);
  const total = current.tens * 10 + current.ones;
  const finalLine = worked && mode === 'subtract' ? `${start} − ${operand} = ${total}`
    : worked && mode === 'add' ? `${start} + ${operand} = ${total}`
      : `${current.tens} × 10 + ${current.ones} = ${total}`;
  return <RevealSurface beats={clock}>
    <View style={[styles.wrap, { minHeight: Math.max(0, modelHeight - 16), justifyContent: 'flex-start' }]}>
      <View {...modelScroll} style={styles.proofModel} nativeID="play-proof-model" testID="play-proof-model"><PlaceValueMat matHeight={modelHeight - 16} laneHeight={stage.height - 16} submittedOnly={mode === 'subtract'} total={mode === 'bundle' || mode === 'split' ? start : undefined} viewport={viewport} tens={next.tens} ones={next.ones} capacity={capacity} target={!worked ? final : undefined}
        stock={pending ? initial : undefined} addend={pending ? addend : undefined} pending={pending}
        transition={transition} landed={runExchange ? 1 : transition ? 2 : 0} position={motionPosition}
        reduced={reduced} exchangeMode={exchangeMode} trace={trace}
        detailVisible={Boolean(!clock.settled && (activeExchange || committedMove === exchangeMode || mode === exchangeMode))}
        transfer={transfer} compactOnes={clock.settled} checked />
      </View>
      {clock.settled ? <PlayProofCaption>
        <ProofFinale settled={clock.settled}>
          <Caption strong numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} nativeID="play-proof-equation" testID="play-proof-equation"
            accessible accessibilityRole="text" accessibilityLiveRegion="polite">{finalLine}</Caption>
        </ProofFinale>
      </PlayProofCaption> : <PlayProofCaption>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Caption strong>{'\u00a0'}</Caption></View>
      </PlayProofCaption>}
    </View>
  </RevealSurface>;
}

function PlaceValueBoard({ AnswerRow = Fragment, puzzle, value, onChange, answered, transition, onSolutionShown, retryOnly, moved }: Props & {
  moved: boolean;
  transition?: PlaceValueTransition; onSolutionShown?: () => void; retryOnly?: boolean;
}) {
  const { t } = useTranslation();
  const viewport = useProofViewport();
  const stage = useModelStage();
  const modelHeight = viewport?.availableModelHeight || stage.height;
  const initial = initialPlaceValue(puzzle);
  const state = value ?? initial;
  const { mode, start, operand } = puzzle.payload;
  const [interacted, setInteracted] = useState(false);
  const exchange = transition && transition.kind !== 'join';
  const beats = useRevealBeats(transition ? 2 : 0, { minTotal: 0,
    reducedSteps: Boolean(exchange), hold: landed => exchange && landed === 1 ? 0 : Motion.hold,
    lead: Motion.tap / 2,
    step: index => transition?.kind === 'join' ? Motion.step - Motion.stagger + Motion.stagger * Math.max(0,
      (index === 0 ? state.tens - transition.from.tens : Math.ceil((state.ones - transition.from.ones) / 5)) - 1)
      : index === 0 ? 90 : 400,
    onDone: onSolutionShown,
  });
  const playing = Boolean(transition && !beats.done);
  const current = state.tens * 10 + state.ones;
  const taken = Math.max(0, start - current);
  const equation = mode === 'add' && state.added && state.ones < 10 ? `${start} + ${operand} = ${current}`
    : mode === 'subtract' && taken > 0 ? `${start} − ${taken} = ${current}`
      : onSolutionShown ? `${state.tens} × 10 + ${state.ones} = ${start}` : undefined;
  const addend = mode === 'add' && operand !== undefined ? { tens: Math.floor(operand / 10), ones: operand % 10 } : undefined;
  const pending = !retryOnly && !state.added ? addend : undefined;
  const capacity = placeValueCapacity(puzzle);
  const shortActions: Partial<Record<PlaceValueAction, string>> = { addTen: '+10', addOne: '+1', removeTen: '−10', removeOne: '−1' };
  const direct = (action: PlaceValueAction) => {
    if (answered || playing) return;
    const next = changePlaceValue(puzzle, state, action);
    if (next !== state) {
      setInteracted(true);
      landTick();
      onChange(next);
    }
  };
  const button = (action: PlaceValueAction, label: string) => {
    const next = changePlaceValue(puzzle, state, action);
    const disabled = answered || playing || next === state;
    return <Pressable key={action} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      testID={`place-value-${action}`} disabled={disabled} onPress={() => direct(action)}
      style={({ pressed }) => [styles.button, mode === 'build' ? styles.buildKey : mode === 'subtract' ? styles.subtractKey : styles.actionKey, disabled && (mode === 'build' ? styles.disabledKey : styles.disabled), pressed && styles.pressed]}>
      {mode === 'build' && <PressFace pressed={false} fill={disabled ? Shape.empty : Quantity.teal.soft} edge={disabled ? Shape.emptyLip : Quantity.teal.edge} radius={Radius.control} />}
      <Text numberOfLines={shortActions[action] ? 1 : undefined} adjustsFontSizeToFit={!!shortActions[action]} maxFontSizeMultiplier={shortActions[action] ? 1.5 : undefined} style={[styles.buttonText, mode === 'build' && styles.buildKeyText, mode === 'subtract' && styles.subtractKeyText]}>{shortActions[action] ?? label}</Text>
    </Pressable>;
  };
  const exchangeKind: 'bundle' | 'split' | undefined = mode !== 'split' && state.ones >= 10 ? 'bundle' : mode === 'split' || mode === 'subtract' ? 'split' : undefined;
  const exchangeAction = exchangeKind && !playing && !answered && changePlaceValue(puzzle, state, exchangeKind) !== state
    ? { kind: exchangeKind, label: t(`placeValue.${exchangeKind}`), onPress: () => direct(exchangeKind) } as const : undefined;
  const picking = mode === 'build' && !answered && !playing;
  const canRemove = !answered && !playing && (mode === 'subtract' || picking);
  const board = <View style={styles.wrap}>
    <Animated.View key={exchange && beats.reduced ? beats.landed : 'board'} style={styles.wrap}
      nativeID="play-entry-model" testID="play-entry-model"
      entering={exchange && beats.reduced ? FadeIn.duration(Motion.fade).reduceMotion(ReduceMotion.Never) : undefined}
      exiting={exchange && beats.reduced ? FadeOut.duration(Motion.fade).reduceMotion(ReduceMotion.Never) : undefined}>
      <PlaceValueMat matHeight={modelHeight - (!answered && (mode === 'subtract' || mode === 'add' && !state.added) ? 64 : 16)} laneHeight={stage.height - 16} submittedOnly={mode === 'subtract'} total={mode === 'bundle' || mode === 'split' ? start : undefined} viewport={viewport} tens={state.tens} ones={state.ones} target={retryOnly ? placeValueProof(puzzle).final : undefined} pending={pending}
        stock={addend ? initial : undefined} addend={addend} capacity={capacity}
        transition={transition} landed={beats.landed} position={beats.position} reduced={beats.reduced}
        exchangeMode={exchangeKind} exchangeAction={exchangeAction} interacted={interacted || value !== null}
        enter={!answered && !interacted && value === null} fadeOnRemove={mode === 'build' || mode === 'subtract'}
        onPiece={canRemove ? unit => direct(unit === 'tens' ? 'removeTen' : 'removeOne') : undefined} />
    </Animated.View>
    {answered && !retryOnly && (mode === 'add' || mode === 'subtract' || onSolutionShown) ? <Caption strong>{beats.settled ? equation : null}</Caption> : null}
  </View>;
  if (onSolutionShown || answered && transition) return <RevealSurface beats={beats}>{board}</RevealSurface>;
  const ControlsRow = mode === 'build' ? AnswerRow : Fragment;
  return <View style={[styles.wrap, { minHeight: modelHeight, justifyContent: 'flex-start' }]}>
    {playing ? <RevealSurface beats={beats}>{board}</RevealSurface> : board}
    <TaskLiveControls playback={playing || answered}><ControlsRow>
    {mode === 'add' && state.added ? null : <View style={mode === 'build' ? styles.buildKeys : styles.controls}>
      {mode === 'build' ? <>
        {button('addTen', t('placeValue.addTen'))}{button('addOne', t('placeValue.addOne'))}
      </> : null}
      {mode === 'build' || mode === 'subtract' ? <>
        {button('removeTen', t('placeValue.removeTen'))}{button('removeOne', t('placeValue.removeOne'))}
      </> : null}
      {mode === 'add' && !state.added ? button('addOperand', t('placeValue.add', { count: operand })) : null}
    </View>}
    {value !== null && (moved || (mode !== 'add' && mode !== 'build' && mode !== 'subtract')) ? <Pressable accessibilityRole="button" onPress={() => onChange(null)}
      testID="place-value-reset" accessibilityLabel={t('placeValue.reset')} style={styles.reset}>
      <Text style={styles.resetText}>{t('geometryModels.reset')}</Text>
    </Pressable> : null}
    </ControlsRow></TaskLiveControls>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  proofModel: { marginBottom: 8 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: Radius.control },
  subtractKey: { flex: 1, paddingVertical: 2, backgroundColor: Quantity.teal.soft },
  subtractKeyText: { fontSize: 22, color: Ink.text },
  actionKey: { flexGrow: 1, flexBasis: '45%', backgroundColor: Colors.selectedSurface },
  buildKeys: { alignSelf: 'stretch', flexDirection: 'row', gap: 4 },
  buildKey: { flex: 1, minWidth: 0, paddingHorizontal: 2, paddingVertical: 2, backgroundColor: Quantity.teal.soft },
  disabledKey: { backgroundColor: Shape.empty },
  // Dark ink on the teal key: pink-on-teal was hard to read.
  buildKeyText: { color: Ink.text, fontWeight: '800', fontSize: 24 },
  buttonText: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark, textAlign: 'center' },
  disabled: { backgroundColor: Ink.guide, borderColor: Ink.trayEdge },
  pressed: { transform: [{ translateY: 2 }] },
  reset: { minWidth: 48, minHeight: 48, padding: 8, alignItems: 'center', justifyContent: 'center' },
  resetText: { textAlign: 'center', fontSize: 16, color: Colors.textMuted, textDecorationLine: 'underline' },
});
