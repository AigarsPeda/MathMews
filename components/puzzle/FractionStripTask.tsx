import { FractionPartTargets, FractionStrip, fractionStripGap, fractionStripHeight } from '@/components/puzzle/fraction/FractionStrip';
import { IdleHint } from './kit/PracticeAffordances';
import { useFirstQuantityEncounter } from './counting/QuantityPractice';
import { FractionChoiceHint } from './fraction/FractionChoiceHint';
import { landTick } from './kit/proofHaptics';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink, PuzzleColors as Colors, Quantity, Radius, Shape, Stroke } from '@/constants/puzzle-theme';
import type { FractionStripPuzzle } from '@/types/puzzle';
import { partitionFractionStrip, type FractionStripState } from '@/utils/fraction-models';
import { Fragment, useState, type ComponentType, type ReactNode } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { resizeFractionSelection, toggleFractionSlice } from '@/utils/fraction-pie';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = { puzzle: FractionStripPuzzle; value: FractionStripState | null; onChange: (state: FractionStripState | null) => void; answered: boolean;
  AnswerRow?: ComponentType<{ children: ReactNode }> };

export function FractionStripTask({ puzzle, value, onChange, answered, AnswerRow = Fragment }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [choiceWidth, setChoiceWidth] = useState(0);
  const [interacted, setInteracted] = useState(value !== null);
  const { partitions } = puzzle.payload;
  const parts = value?.parts ?? (partitions.length === 1 ? partitions[0] : null);
  const firstEncounter = useFirstQuantityEncounter('fraction-strip-shade', !answered && parts !== null);
  const reference = puzzle.payload.mode === 'equivalent' ? { numerator: puzzle.payload.numerator, denominator: puzzle.payload.denominator } : null;
  const shaded = value?.shaded ?? null;
  const selected = value?.selected ?? Array.from({ length: shaded ?? 0 }, (_, index) => index);
  const sweep = useSharedValue<{ last: number; selected: readonly number[]; shade: boolean } | null>(null);
  const cellAt = (x: number) => parts !== null && width > 0
    ? Math.max(0, Math.min(parts - 1, Math.floor(x / width * parts))) : null;
  const commit = (next: readonly number[]) => {
    if (answered || parts === null) return;
    setInteracted(true);
    landTick();
    onChange({ parts, shaded: next.length, selected: next });
  };
  const toggle = (index: number) => commit(toggleFractionSlice(selected, index));
  const setShaded = (count: number) => { if (parts !== null) commit(resizeFractionSelection(selected, count, parts)); };
  const pan = Gesture.Pan().runOnJS(true).enabled(!answered && parts !== null)
    .activeOffsetX([-8, 8]).failOffsetY([-12, 12])
    .onStart(event => {
      setInteracted(true);
      const index = cellAt(event.x - event.translationX);
      if (index !== null) sweep.set({ last: index, selected, shade: !selected.includes(index) });
    }).onUpdate(event => {
      const state = sweep.get();
      const index = cellAt(event.x);
      if (!state || index === null) return;
      const next = new Set(state.selected);
      for (let cell = Math.min(index, state.last); cell <= Math.max(index, state.last); cell++) {
        if (state.shade) next.add(cell);
        else next.delete(cell);
      }
      const changed = [...next].sort((a, b) => a - b);
      sweep.set({ ...state, last: index, selected: changed });
      if (changed.length !== state.selected.length) commit(changed);
    }).onFinalize(() => { sweep.set(null); });
  return <View style={styles.wrap}>
    <View nativeID="play-entry-model" style={styles.model}>
    {reference ? <View pointerEvents="none" style={styles.reference}>
      <FractionStrip gap={fractionStripGap} height={fractionStripHeight} tone="teal" parts={reference.denominator} shaded={reference.numerator} />
    </View> : null}
    <GestureDetector gesture={pan}><Pressable testID="fraction-strip-board" style={styles.touchStrip} disabled={answered || parts === null}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onPressIn={() => setInteracted(true)}
      onPress={e => { const index = cellAt(e.nativeEvent.locationX); if (index !== null) toggle(index); }}
      accessibilityRole="adjustable" accessibilityLabel={t('fractionModels.yourStrip')}
      accessibilityState={{ disabled: answered || parts === null }}
      accessibilityValue={{ min: 0, max: parts ?? 1, now: shaded ?? 0, text: parts === null ? t('fractionModels.chooseParts') : t('fractionModels.shaded', { count: shaded ?? 0, total: parts }) }}
      accessibilityActions={answered || parts === null ? undefined : [
        { name: 'increment' }, { name: 'decrement' },
        ...Array.from({ length: parts }, (_, index) => ({
          name: `part-${index}`,
          label: `${index + 1} · ${t(selected.includes(index) ? 'fractionModels.remove' : 'fractionModels.add')}`,
        })),
      ]}
      onAccessibilityAction={({ nativeEvent: { actionName } }) => {
        if (actionName.startsWith('part-')) toggle(Number(actionName.slice(5)));
        if (actionName === 'increment') setShaded((shaded ?? 0) + 1);
        if (actionName === 'decrement') setShaded((shaded ?? 0) - 1);
      }}>
      <FractionStrip gap={fractionStripGap} height={fractionStripHeight} parts={parts ?? 1} shaded={shaded ?? 0} selected={selected}
        animateEntry={!answered && partitions.length === 1} animateChange={!answered} opening={partitions.length > 1 && parts !== null}
        demoFace={firstEncounter && !interacted && !answered && partitions.length === 1} />
      {!answered && parts !== null && width > 0 ? <IdleHint movable firstEncounter={firstEncounter} interacted={interacted}
        from={{ x: width / parts / 2, y: fractionStripHeight / 2 }} /> : null}
    </Pressable></GestureDetector>
    </View>
    <AnswerRow><View style={styles.inputs}>
      {!answered && parts !== null && width < parts * 44
        ? <FractionPartTargets count={parts} selected={selected} onToggle={toggle} /> : null}
      {partitions.length > 1 ? <View style={styles.choices} onLayout={event => setChoiceWidth(event.nativeEvent.layout.width)}>{partitions.map(count => <Pressable key={count} testID={`fraction-strip-parts-${count}`}
          accessibilityRole="button" accessibilityState={{ disabled: answered, selected: parts === count }} disabled={answered}
          accessibilityHint={shaded && parts !== count ? t('fractionModels.partitionResets') : undefined}
          onPress={() => {
            setInteracted(true);
            if (parts === count) return;
            landTick();
            onChange(partitionFractionStrip(puzzle, count));
          }}
          style={({ pressed }) => [styles.choice, parts === count && styles.chosen, answered && styles.disabled, pressed && styles.pressed]}>
          <Text style={[styles.choiceText, parts === count && styles.chosenText]}>{t('fractionModels.parts', { count })}</Text>
        </Pressable>)}
        {!answered && parts === null ? <FractionChoiceHint mechanic="partition" width={choiceWidth} interacted={interacted} /> : null}
      </View> : null}
      <View style={styles.controls}>
        {([-1, 1] as const).map(direction => {
          const disabled = answered || parts === null || (direction < 0 ? (shaded ?? 0) === 0 : shaded === parts);
          const label = t(direction < 0 ? 'fractionModels.remove' : 'fractionModels.add');
          return <Pressable key={direction} testID={direction < 0 ? 'fraction-strip-remove' : 'fraction-strip-add'}
            accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => setShaded((shaded ?? 0) + direction)}
            style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>{direction < 0 ? '−1' : '+1'}</Text>
          </Pressable>;
        })}
        <Pressable testID="fraction-strip-reset" accessibilityRole="button" accessibilityLabel={t('fractionModels.reset')} accessibilityState={{ disabled: answered || value === null }}
          disabled={answered || value === null} onPress={() => { setInteracted(true); onChange(null); }} style={styles.reset}>
          <Text style={[styles.resetText, (answered || value === null) && styles.resetDisabled]}>↺</Text>
        </Pressable>
      </View>
    </View></AnswerRow>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  inputs: { gap: 4 },
  model: { alignSelf: 'center', width: '100%', maxWidth: 410, gap: fractionStripGap },
  reference: { width: '100%' },
  touchStrip: { alignSelf: 'center', width: '100%', maxWidth: 410, minHeight: fractionStripHeight, justifyContent: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  choice: { minWidth: 72, minHeight: 52, flexGrow: 1, paddingHorizontal: 10, paddingVertical: 4, gap: Shape.space.loose, borderRadius: Radius.control, backgroundColor: Ink.tray, borderBottomWidth: Shape.lip, borderColor: Colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  chosen: { borderColor: Colors.primary, backgroundColor: Colors.selectedSurface },
  choiceText: { color: Colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  chosenText: { color: Colors.primaryDark },
  controls: { flexDirection: 'row', gap: 8 },
  // Soft teal keys with dark 22 pt text, like the place-value build keys (wave 12).
  button: { flex: 1, minWidth: 44, minHeight: 48, padding: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: Quantity.teal.soft, borderColor: Quantity.teal.light, borderBottomWidth: Shape.lip, borderRadius: Radius.control },
  buttonText: { color: Ink.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  disabled: { backgroundColor: Ink.guide, borderColor: Ink.trayEdge },
  pressed: { borderBottomWidth: Stroke.outline, marginTop: 2 },
  reset: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  resetDisabled: { opacity: .6 },
  resetText: { textAlign: 'center', color: Colors.textMuted, fontSize: 22, fontWeight: '800' },
});
