import { DecimalTenths, usesTenthsSquare } from './place-value/DecimalTenths';
import { useProofViewport } from './PlayProofCaption';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { landTick } from '@/components/puzzle/kit/proofHaptics';
import { RevealSurface, TaskLiveControls } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { Ink, Motion, ProofMotion, PuzzleColors as Colors, Radius, Stroke } from '@/constants/puzzle-theme';
import { DecimalPlaceMat } from '@/components/puzzle/place-value/DecimalPlaceMat';
import type { DecimalPlaceValuePuzzle } from '@/types/puzzle';
import { changeDecimalPlace, initialDecimalPlace, type DecimalAction, type DecimalPlaceState } from '@/utils/decimal-models';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion, useDerivedValue } from 'react-native-reanimated';

type Props = { puzzle: DecimalPlaceValuePuzzle; value: DecimalPlaceState | null; onChange: (value: DecimalPlaceState | null) => void; answered: boolean };
export function DecimalPlaceValueTask({ puzzle, value, onChange, answered }: Props) {
  const { t } = useTranslation();
  const viewport = useProofViewport();
  const state = value ?? initialDecimalPlace(puzzle);
  const { mode, units, exchangeUnit } = puzzle.payload;
  const initial = initialDecimalPlace(puzzle);
  const exchanged = !answered && mode !== 'build' && state[exchangeUnit] !== initial[exchangeUnit];
  const [interacted, setInteracted] = useState(false);
  const beats = useRevealBeats(exchanged ? 2 : 0, {
    lead: 0, minTotal: 0, reducedSteps: true, hold: landed => landed === 2 ? ProofMotion.denseHold : 0,
    step: index => index ? 1050 : ProofMotion.beat[120],
  });
  const { position } = beats;
  const progress = useDerivedValue(() => Math.max(0, position.get() - 1));
  const committed = !exchanged || beats.landed === 2;
  const shown = committed ? state : initial;
  const capacity = mode === 'build' ? { ones: Math.max(1, state.ones), tenths: state.tenths, hundredths: state.hundredths }
    : { ones: Math.max(state.ones, initial.ones, exchangeUnit === 'tenths' ? 1 : 0),
      tenths: Math.max(state.tenths, initial.tenths, exchangeUnit === 'tenths' ? 10 : 0),
      hundredths: Math.max(state.hundredths, initial.hundredths, exchangeUnit === 'hundredths' ? 10 : 0) };
  const actionButton = (action: DecimalAction, label: string, id: string, compact = false) => {
    const next = changeDecimalPlace(puzzle, state, action), disabled = answered || !beats.done || next === state;
    return <Pressable key={id} testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      accessibilityState={{ disabled }} onPress={() => apply(action)} style={({ pressed }) => [styles.button, compact && styles.compact, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.buttonText}>{compact ? action.kind === 'add' ? '+' : '−' : label}</Text>
    </Pressable>;
  };
  const apply = (action: DecimalAction) => {
    const next = changeDecimalPlace(puzzle, state, action);
    if (!answered && beats.done && next !== state) {
      setInteracted(true);
      landTick();
      onChange(next);
    }
  };
  const exchangeAction: DecimalAction | undefined = mode !== 'build' ? { kind: mode, unit: exchangeUnit } : undefined;
  const exchange = exchangeAction ? {
    unit: mode === 'bundle' ? exchangeUnit : exchangeUnit === 'tenths' ? 'ones' as const : 'tenths' as const,
    label: t(`decimalModels.${mode}_${exchangeUnit}`),
    disabled: answered || !beats.done || changeDecimalPlace(puzzle, state, exchangeAction) === state,
    onPress: () => apply(exchangeAction),
  } : undefined;
  const visibleUnits = exchange && exchangeUnit === 'hundredths' && capacity.ones === 0 ? ['tenths', 'hundredths'] as const : units;
  if (usesTenthsSquare(puzzle)) return <View nativeID="play-entry-model" testID="play-entry-model" style={{ alignItems: 'center' }}>
    <DecimalTenths count={state.tenths} selected={state.selectedTenths} target={puzzle.payload.hundredths / 10}
      onChange={answered ? undefined : selectedTenths => onChange({ ones: 0, tenths: selectedTenths.length, hundredths: 0, selectedTenths })} />
  </View>;
  const board = <View nativeID="play-entry-model" testID="play-entry-model"><DecimalPlaceMat viewport={viewport} state={shown} units={visibleUnits} capacity={capacity}
    exchangeUnit={exchangeUnit} exchange={exchange} enter={!answered && value === null} interacted={interacted || value !== null}
    onAdd={mode === 'build' && !answered ? unit => apply({ kind: 'add', unit }) : undefined}
    onRemove={mode === 'build' && !answered ? unit => apply({ kind: 'remove', unit }) : undefined}
    preview={exchanged && beats.landed === 1 && !beats.reduced ? { state, progress } : undefined} controls={mode === 'build' ? unit => (
      <View style={styles.controls}>
        {actionButton({ kind: 'remove', unit }, t('decimalModels.removeUnit', { unit: t(`decimalModels.${unit}`) }), `decimal-remove-${unit}`, true)}
        {actionButton({ kind: 'add', unit }, t('decimalModels.addUnit', { unit: t(`decimalModels.${unit}`) }), `decimal-add-${unit}`, true)}
      </View>
    ) : undefined} /></View>;
  const fade = exchanged && beats.reduced;
  return <View style={styles.wrap}>
    {exchanged && !beats.settled ? <RevealSurface beats={beats}><Animated.View key={fade ? beats.landed : 'board'}
      entering={fade ? FadeIn.duration(Motion.fade).reduceMotion(ReduceMotion.Never) : undefined}
      exiting={fade ? FadeOut.duration(Motion.fade).reduceMotion(ReduceMotion.Never) : undefined}>{board}</Animated.View></RevealSurface> : board}
    <TaskLiveControls playback={!beats.settled || answered}><Pressable testID="decimal-place-reset" accessibilityRole="button" accessibilityState={{ disabled: answered || value === null }}
      disabled={answered || value === null} onPress={() => onChange(null)} style={styles.reset}>
      <Text style={[styles.resetText, (answered || value === null) && styles.resetDisabled]}>{t('decimalModels.reset')}</Text>
    </Pressable></TaskLiveControls>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: 8 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 2, width: '100%' },
  button: { minHeight: 48, padding: 12, borderRadius: Radius.control, borderBottomWidth: 3, borderColor: Colors.primary, backgroundColor: Colors.selectedSurface, justifyContent: 'center', alignItems: 'center' },
  compact: { flex: 1, minWidth: 44, paddingHorizontal: 0 }, buttonText: { color: Colors.primaryDark, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  disabled: { backgroundColor: Ink.guide, borderColor: Ink.trayEdge },
  pressed: { borderBottomWidth: Stroke.outline, marginTop: 2 },
  resetDisabled: { opacity: .6 },
  reset: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, resetText: { color: Colors.textMuted, fontSize: 16, textDecorationLine: 'underline' },
});
