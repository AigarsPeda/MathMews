import { useRef } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Quantity, Shape } from '@/constants/puzzle-theme';
import { RoundedTile } from '../kit/FriendlyShapes';

type Props = { columns: number; rows: number; unit: number; covered: ReadonlySet<number>; onChange: (cells: Set<number>) => void; available: number };

export function CoverGrid(props: Props) {
  const { columns, unit, available } = props;
  const grid = <EditableSquares {...props} />;
  if (columns * unit <= available + 0.5) return grid;
  // The gutter belongs to the scroller. Strokes starting on a square paint the grid.
  return <ScrollView horizontal nestedScrollEnabled persistentScrollbar style={{ width: available, flexGrow: 0 }}
    contentContainerStyle={{ paddingVertical: 12 }}>
    {grid}
  </ScrollView>;
}

function EditableSquares({ columns, rows, unit, covered, onChange }: Props) {
  const length = rows * columns;
  const { t } = useTranslation();
  const stroke = useRef<{ paint: boolean; cells: Set<number>; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const index = (x: number, y: number) => {
    if (x < 0 || x >= columns * unit || y < 0 || y >= rows * unit) return -1;
    const local = Math.floor(y / unit) * columns + Math.floor(x / unit);
    return local < length ? local : -1;
  };
  function toggle(id: number) {
    const next = new Set(covered);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
    AccessibilityInfo.announceForAccessibility(t(next.has(id) ? 'friendlyQ.covered' : 'friendlyQ.uncovered',
      { defaultValue: next.has(id) ? 'Covered' : 'Uncovered' }));
  }
  function begin(id: number, e: GestureResponderEvent) {
    const { pageX, pageY, locationX, locationY } = e.nativeEvent;
    const x = id % columns * unit + locationX, y = Math.floor(id / columns) * unit + locationY;
    const paint = !covered.has(id);
    const cells = new Set(covered);
    if (paint) cells.add(id); else cells.delete(id);
    stroke.current = { x, y, paint, cells, offsetX: pageX - x, offsetY: pageY - y };
    onChange(cells);
  }
  function move(e: GestureResponderEvent) {
    const s = stroke.current;
    if (!s) return;
    const x = e.nativeEvent.pageX - s.offsetX, y = e.nativeEvent.pageY - s.offsetY;
    const cells = new Set(s.cells);
    const steps = Math.max(1, Math.ceil(Math.hypot(x - s.x, y - s.y) / (unit / 4)));
    for (let i = 1; i <= steps; i++) {
      const id = index(s.x + (x - s.x) * i / steps, s.y + (y - s.y) * i / steps);
      if (id >= 0) { if (s.paint) cells.add(id); else cells.delete(id); }
    }
    stroke.current = { ...s, x, y, cells };
    if (cells.size !== s.cells.size) onChange(cells);
  }
  return <View style={{ width: columns * unit, height: rows * unit, backgroundColor: Shape.seamColor }}>{Array.from({ length }, (_, id) => {
    const full = covered.has(id);
    const label = t('friendlyQ.square', { row: Math.floor(id / columns) + 1, col: id % columns + 1, defaultValue: 'Row {{row}}, column {{col}}' });
    const action = t('friendlyQ.toggle', { defaultValue: 'Toggle square' });
    return <View key={id} testID={'geometry-square-' + id} accessible accessibilityRole="togglebutton" accessibilityLabel={label} accessibilityHint={t('friendlyQ.coverHint')}
      accessibilityState={{ checked: full }} accessibilityActions={[{ name: 'activate' }, { name: 'toggle', label: action }]}
      onAccessibilityAction={() => toggle(id)} onStartShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
      onResponderGrant={e => begin(id, e)} onResponderMove={move} onResponderRelease={() => { stroke.current = null; }}
      onResponderTerminate={() => { stroke.current = null; }} style={[styles.cell, { width: unit, height: unit, left: id % columns * unit, top: Math.floor(id / columns) * unit }]}>
      <View pointerEvents="none"><RoundedTile width={unit - Shape.space.seam} height={unit - Shape.space.seam} fill={full ? Quantity.teal.fill : Shape.empty}
        edge={full ? Quantity.teal.edge : Shape.emptyLip} /></View>
    </View>;
  })}</View>;
}
const styles = StyleSheet.create({
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' } });
