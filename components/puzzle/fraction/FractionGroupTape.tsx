import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { PlayProofCaption } from '../PlayProofCaption';
import { EntryBuild } from '../kit/PracticeAffordances';
import { FractionStrip, fractionStripGap } from './FractionStrip';

const trayRowHeight = 56;

export function FractionGroupTape({ total, parts, shaded, groupSize, distributed = 0, highlighted, position, enter = false, caption }: {
  total: number; parts: number; shaded: number; groupSize?: number;
  distributed?: number; highlighted?: readonly number[]; position?: SharedValue<number>; enter?: boolean; caption?: ReactNode;
}) {
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const inlineTotal = fontScale >= 1.5;
  const rowHeight = inlineTotal ? 48 : trayRowHeight;
  const [width, setWidth] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const capacity = Math.max(1, Math.floor(((width || screenWidth - 44) - (inlineTotal ? 84 : 0) + fractionStripGap) / (28 + fractionStripGap)));
  const rows = Math.ceil(parts / capacity);
  const perRow = Math.ceil(parts / rows);
  const totalMotion = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, position?.get() ?? 0) }));
  return <View style={inlineTotal && styles.compact} onLayout={event => setWidth(event.nativeEvent.layout.width)} pointerEvents="none"
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {inlineTotal ? <View style={styles.inlineTotal}><Text maxFontSizeMultiplier={1.15} style={styles.totalText}>{total}</Text></View>
      : distributed === 0 ? <Animated.View style={[styles.total, totalMotion]}
      onLayout={event => setTotalHeight(event.nativeEvent.layout.height)}>
      <Text style={styles.totalText}>{total}</Text>
    </Animated.View> : <View style={[styles.total, { height: totalHeight || undefined }]}><Text style={styles.totalText}>{total}</Text></View>}
    <View style={[styles.rows, inlineTotal && styles.inlineRows]}>
      {Array.from({ length: rows }, (_, row) => {
        const first = row * perRow;
        const count = Math.min(perRow, parts - first);
        const filled = Math.max(0, Math.min(count, shaded - first));
        return <View key={row} style={{ height: rowHeight, width: `${count / perRow * 100}%` }}>
          <FractionStrip gap={fractionStripGap} height={rowHeight} parts={count} shaded={filled}
            highlighted={highlighted?.map(index => index - first)} animateEntry={enter} />
          {groupSize !== undefined ? <View style={[styles.groups, { gap: fractionStripGap }]}>
            {Array.from({ length: count }, (_, index) => <View key={index} style={styles.group}>
              {first + index < distributed ? <EntryBuild><Text maxFontSizeMultiplier={1.15} style={[styles.amount, index < filled && styles.onViolet]}>
                {groupSize}
              </Text></EntryBuild> : null}
            </View>)}
          </View> : null}
        </View>;
      })}
    </View>
    {caption ? <PlayProofCaption>{caption}</PlayProofCaption> : null}
  </View>;
}

const styles = StyleSheet.create({
  compact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineTotal: { width: 76, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', borderRadius: 12, backgroundColor: Quantity.violet.soft },
  inlineRows: { flex: 1 },
  total: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 12,
    backgroundColor: Quantity.violet.soft, marginBottom: Shape.space.group },
  totalText: { fontSize: 26, fontWeight: '800', color: Quantity.violet.onFill, fontVariant: ['tabular-nums'] },
  rows: { alignItems: 'center', gap: fractionStripGap },
  groups: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  group: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  amount: { fontSize: 28, fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
  onViolet: { color: Shape.seamColor },
});
