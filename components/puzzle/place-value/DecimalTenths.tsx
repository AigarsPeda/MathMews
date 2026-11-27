import { useModelStage } from '../kit/ModelStage';
import { useProofViewport } from '../PlayProofCaption';
import { Quantity, Shape } from '@/constants/puzzle-theme';
import { resizeFractionSelection, toggleFractionSlice } from '@/utils/fraction-pie';
import type { DecimalPlaceValuePuzzle } from '@/types/puzzle';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { EntryBuild, IdleHint } from '../kit/PracticeAffordances';
import { useFirstQuantityEncounter } from '../counting/QuantityPractice';

export function usesTenthsSquare(puzzle: DecimalPlaceValuePuzzle) {
  return puzzle.payload.mode === 'build' && puzzle.payload.digits === 1 && puzzle.payload.hundredths < 100;
}

export function DecimalTenths({ count, target, selected, onChange, checked = false }: {
  count: number; target: number; selected?: readonly number[]; onChange?: (columns: number[]) => void; checked?: boolean;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const stage = useModelStage();
  const viewport = useProofViewport();
  const size = Math.min(width - 32, stage.width || viewport?.innerWidth || width - 32);
  const height = Math.min(size, Math.max(56, (viewport?.availableModelHeight || stage.height || size + 28) - 28));
  const first = useFirstQuantityEncounter('decimal-tenths', !!onChange);
  const mask = selected?.length === count ? selected : Array.from({ length: count }, (_, i) => i);
  const cells = Array.from({ length: 10 }, (_, i) => i);
  const difference = !checked ? [] : count > target
    ? mask.slice(target)
    : cells.filter(column => !mask.includes(column)).slice(0, target - count);
  const grid = <View pointerEvents="none" style={[styles.rods, { width: size, height }]}>
    {cells.map(column => {
      const missingOrExtra = difference.includes(column);
      const paint = mask.includes(column) ? Quantity.teal : undefined;
      return <View key={column} style={[styles.rod, { backgroundColor: missingOrExtra ? Quantity.amber.light : paint?.edge ?? Shape.emptyLip }]}>
        <View style={[styles.face, { backgroundColor: missingOrExtra ? Quantity.amber.light : paint?.fill ?? Shape.empty }]} />
      </View>;
    })}
  </View>;
  return <Pressable testID="decimal-tenths-board" style={{ width: size, height }} disabled={!onChange}
    accessibilityRole={onChange ? 'adjustable' : 'image'} accessibilityLabel={t('decimalModels.tenths')}
    accessibilityValue={{ min: 0, max: 10, now: count }}
    accessibilityActions={onChange ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
    onAccessibilityAction={({ nativeEvent }) => onChange?.(resizeFractionSelection(mask, count + (nativeEvent.actionName === 'increment' ? 1 : -1), 10))}
    onPress={({ nativeEvent }) => {
      const column = Math.max(0, Math.min(9, Math.floor((nativeEvent.locationX + Shape.space.seam / 2) / ((size + Shape.space.seam) / 10))));
      onChange?.(toggleFractionSlice(mask, column));
    }}>
    {onChange ? <EntryBuild index={5}>{grid}</EntryBuild> : grid}
    {onChange && <IdleHint movable firstEncounter={first} interacted={count > 0} from={{ x: size / 20, y: height / 2 }} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  rods: { flexDirection: 'row', gap: Shape.space.seam },
  rod: { flex: 1, borderRadius: 8, paddingBottom: Shape.lip },
  face: { flex: 1, borderRadius: 8 },
});
