import { moderateScale } from '@/utils/scale';
import { useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent, type ViewStyle } from 'react-native';

/** Short answers share a row; long labels and larger text retain full-width buttons. */
export function useChoiceLayout(labels: readonly string[], measureLabels = false) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  // Native text measurement determines which labels fit together at accessibility sizes.
  if (measureLabels && fontScale >= 2) return {
    measuredWidth,
    onLayout: undefined,
    container: { gap: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' } as ViewStyle,
    item: { minWidth: '30%', minHeight: Math.max(44, moderateScale(52)), paddingHorizontal: 6, paddingVertical: moderateScale(8) } as ViewStyle,
  };
  const available = measuredWidth ?? width - moderateScale(44);
  const needed = Math.max(...labels.map(label => label.length), 0) * moderateScale(20) * fontScale * .65 + moderateScale(32) + 4;
  // Choices keep equal prominence: three answers sit in three equal columns or stack,
  // never two narrow cards beside one double-width card.
  const columns = labels.length >= 2 && labels.length <= 4
    ? labels.length === 3 ? (needed <= (available - 16) / 3 ? 3 : 1)
      : needed <= (available - 8) / 2 ? 2 : 1
    : 1;
  return {
    measuredWidth,
    onLayout: (event: LayoutChangeEvent) => setMeasuredWidth(event.nativeEvent.layout.width),
    container: { gap: 8, flexDirection: 'row', flexWrap: 'wrap' } as ViewStyle,
    item: { minHeight: moderateScale(52), paddingVertical: moderateScale(8), width: columns === 3 ? '30%' : columns === 2 ? '48%' : '100%', flexGrow: columns === 1 ? 0 : 1 } as ViewStyle,
  };
}
