import { PuzzleText } from '@/components/puzzle/PuzzleText';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { useContext, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type TextProps } from 'react-native';
import { ProofPlaybackContext } from './ProofFeedback';
import { Caption } from './Focus';

export const denseSpacing = { label: 8, mark: 4, loosePiece: 4 } as const;
type LabelRole = 'axis' | 'value' | 'title' | 'readout' | 'sequence';

/** Pass one localized quantity, including its unit and any digit grouping. */
export function valueToken(quantity: string) {
  return quantity.trim().replace(/\s+/gu, '\u00a0');
}

/** Use the same role for the native probe and its visible label. */
export function DenseLabel({ role, children, ...props }: Omit<TextProps, 'style' | 'role'> & { role: LabelRole }) {
  return <PuzzleText {...props} numberOfLines={1} style={styles[role]}>{children}</PuzzleText>;
}

/** Mount probe once inside the stage; ready means every localized string has a native layout. */
export function useMeasuredLabels(labels: readonly string[], role: LabelRole) {
  const { fontScale, height } = useWindowDimensions();
  const strings = [...new Set(labels)];
  const key = JSON.stringify([role, fontScale, strings]);
  type Bounds = { width: number; height: number };
  const [cache, setCache] = useState<{ key: string; sizes: Record<number, Bounds> }>({ key: '', sizes: {} });
  const bounds = cache.key === key ? Object.values(cache.sizes) : [];
  const probe = <ScrollView key={key} horizontal scrollEnabled={false} pointerEvents="none" accessible={false}
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.probe, { height }]}
    contentContainerStyle={styles.samples}>
    {strings.map((label, i) => <DenseLabel key={label} role={role} onLayout={({ nativeEvent: { layout } }) => {
      const width = Math.ceil(layout.width), height = Math.ceil(layout.height);
      setCache(previous => {
        const sizes = previous.key === key ? previous.sizes : {};
        if (sizes[i]?.width === width && sizes[i]?.height === height) return previous;
        return { key, sizes: { ...sizes, [i]: { width, height } } };
      });
    }}>{label}</DenseLabel>)}
  </ScrollView>;
  return { probe, ready: bounds.length === strings.length,
    width: Math.max(0, ...bounds.map(b => b.width)), height: Math.max(0, ...bounds.map(b => b.height)) };
}

/** Compare the available dimension of one unit to this floor after trying reflow. */
export function countabilityFloor(kind: 'cell' | 'illustration', accessibilitySize: boolean, moving = false) {
  if (kind === 'illustration' || accessibilitySize) return 24;
  return moving ? 20 : 18;
}

/** @deprecated For legacy editors with group selection. Proofs show only their overview.
 * New models can replace the overview in place when a learner requests magnification. */
export function LinkedDetail<T>({ groups, active, onSelect, renderOverview, renderGroup, groupLabel, detailLabel, detailHeight }: {
  groups: readonly T[]; active: number; onSelect?: (index: number) => void;
  renderOverview: (groups: ReactNode[]) => ReactNode;
  renderGroup: (group: T, size: 'overview' | 'detail') => ReactNode;
  groupLabel: (group: T) => string; detailLabel: string; detailHeight: number;
}) {
  const { playback } = useContext(ProofPlaybackContext);
  if (playback) return <>{renderOverview(groups.map((group, index) => <View key={index}>{renderGroup(group, 'overview')}</View>))}</>;
  if (active < 0 || active >= groups.length) return null;
  return <View style={styles.detailStack}>
    {renderOverview(groups.map((group, index) => <View key={index} style={index === active && styles.link}>
      {renderGroup(group, 'overview')}
    </View>))}
    <View style={[styles.detail, { minHeight: detailHeight }]}>
      <Caption strong>{detailLabel} · {groupLabel(groups[active])}</Caption>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {renderGroup(groups[active], 'detail')}
      </View>
    </View>
    {onSelect && groups.length > 1 && <View style={styles.selectorRow}>{groups.map((group, index) =>
      <Pressable key={index} accessibilityRole="button" accessibilityState={{ selected: active === index }}
        style={[styles.selector, index === active && styles.link]} onPress={() => onSelect(index)}>
        <Caption strong>{groupLabel(group)}</Caption>
      </Pressable>)}</View>}
  </View>;
}

const styles = StyleSheet.create({
  axis: { color: Ink.soft, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  value: { color: Ink.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  // Mat headings (Tenths / Hundredths): 18 pt, like the place-value mats (wave 12).
  title: { color: Ink.text, fontSize: 18, fontWeight: '800' },
  sequence: { color: Ink.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  readout: { color: Ink.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  probe: { position: 'absolute', top: 0, left: 0, width: '100%', opacity: 0 },
  samples: { flexDirection: 'row', alignItems: 'flex-start' },
  detailStack: { gap: 8 },
  link: { backgroundColor: Quantity.teal.soft, borderRadius: 8 },
  detail: { gap: 8, padding: 8, backgroundColor: Ink.tray, borderRadius: 8 },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selector: { minHeight: 48, minWidth: 48, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
});
