import { BaseTenGrid } from '@/components/puzzle/BaseTenGrid';
import { EntryBuild, IdleHint } from './kit/PracticeAffordances';
import { useFirstQuantityEncounter } from './counting/QuantityPractice';
import { Stroke } from '@/constants/puzzle-theme';
import type { DecimalGridPuzzle } from '@/types/puzzle';
import { decimalGridCell } from '@/utils/decimal-models';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { resizeFractionSelection, toggleFractionSlice } from '@/utils/fraction-pie';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

type Props = { puzzle: DecimalGridPuzzle; value: number | null; onChange: (value: number | null) => void; selectedCells?: readonly number[]; onSelectionChange?: (selected: readonly number[]) => void; answered: boolean };
export function DecimalGridTask({ puzzle, value, onChange, selectedCells, onSelectionChange, answered }: Props) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const first = useFirstQuantityEncounter('decimal-grid', !answered);
  const size = Math.min(fontScale >= 1.5 ? 208 : 280, width - 56);
  const { scale } = puzzle.payload;
  const shaded = value ?? 0;
  const [mask, setMask] = useState<{ puzzleId: string; selected: readonly number[] }>({ puzzleId: puzzle.id, selected: [] });
  const storedSelection = selectedCells ?? (mask.puzzleId === puzzle.id ? mask.selected : []);
  const selected = storedSelection.length === shaded ? storedSelection : Array.from({ length: shaded }, (_, index) => index);
  const commit = (next: readonly number[]) => {
    setMask({ puzzleId: puzzle.id, selected: next });
    onSelectionChange?.(next);
    onChange(next.length);
  };
  const change = (amount: number) => { if (!answered) commit(resizeFractionSelection(selected, shaded + amount, scale)); };
  const cellAt = (x: number, y: number) => (decimalGridCell(x - Stroke.outline / 2, y - Stroke.outline / 2, size - Stroke.outline, scale, 'columns') ?? 1) - 1;
  const toggle = (index: number) => {
    commit(toggleFractionSlice(selected, index));
  };
  const held = useSharedValue<{ x: number; y: number; shade: boolean; selected: readonly number[] } | null>(null);
  const sweep = Gesture.Pan().runOnJS(true).enabled(!answered).activateAfterLongPress(140)
    .onStart(event => {
      const x = event.x - event.translationX, y = event.y - event.translationY;
      held.set({ x, y, shade: !selected.includes(cellAt(x, y)), selected });
    }).onUpdate(event => {
      const state = held.get();
      if (!state) return;
      const distance = Math.hypot(event.x - state.x, event.y - state.y);
      const samples = Math.ceil(distance / (size / 20));
      const cells = new Set(state.selected);
      for (let i = 0; i <= samples; i++) {
        const fraction = samples === 0 ? 1 : i / samples;
        const index = cellAt(state.x + (event.x - state.x) * fraction, state.y + (event.y - state.y) * fraction);
        if (state.shade) cells.add(index);
        else cells.delete(index);
      }
      const changed = [...cells].sort((a, b) => a - b);
      held.set({ ...state, x: event.x, y: event.y, selected: changed });
      if (changed.length !== state.selected.length) commit(changed);
    }).onFinalize(() => { held.set(null); });
  return <View testID="play-entry-model" nativeID="play-entry-model" style={styles.wrap}>
    <EntryBuild><GestureDetector gesture={sweep}>
      <Pressable testID="decimal-grid" disabled={answered} style={{ width: size, height: size }}
        onPress={e => toggle(cellAt(e.nativeEvent.locationX, e.nativeEvent.locationY))}
        accessibilityRole="adjustable" accessibilityLabel={t('decimalModels.gridLabel')}
        accessibilityValue={{ min: 0, max: scale, now: shaded, text: t('decimalModels.shaded', { count: shaded, total: scale }) }}
        accessibilityActions={answered ? undefined : [{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => { if (!answered) change(e.nativeEvent.actionName === 'increment' ? 1 : -1); }}>
        <BaseTenGrid size={size} amount={shaded * 100 / scale} scale={scale} selected={selected} hue="teal" />
        {!answered && <IdleHint movable firstEncounter={first} interacted={value !== null} from={{ x: size / 20, y: size / 20 }} />}
      </Pressable>
    </GestureDetector></EntryBuild>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
});
