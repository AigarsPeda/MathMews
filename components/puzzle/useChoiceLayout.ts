import { moderateScale } from '@/utils/scale';
import { useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent, type ViewStyle } from 'react-native';

/** Short answers share a row; long labels and larger text retain full-width buttons. */
export function useChoiceLayout(labels: readonly string[]) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const available = measuredWidth ?? width - moderateScale(44);
  const needed = Math.max(...labels.map(label => label.length), 0) * moderateScale(20) * fontScale * .65 + moderateScale(32) + 4;
  const columns = labels.length >= 2 && labels.length <= 4
    ? labels.length === 3 && needed <= (available - 16) / 3 ? 3
      : needed <= (available - 8) / 2 ? 2 : 1
    : 1;
  return {
    onLayout: (event: LayoutChangeEvent) => setMeasuredWidth(event.nativeEvent.layout.width),
    container: { gap: 8, flexDirection: 'row', flexWrap: 'wrap' } as ViewStyle,
    item: { minHeight: moderateScale(52), paddingVertical: moderateScale(8), width: columns === 3 ? '30%' : columns === 2 ? '48%' : '100%', flexGrow: 1 } as ViewStyle,
  };
}
