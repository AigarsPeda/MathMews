import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** Keep the editor's measured layout at Check, then withdraw its loose input pieces. */
export function ShoppingLane({ position, hidden = false, children }: {
  position?: SharedValue<number>; hidden?: boolean; children: ReactNode;
}) {
  const [height, setHeight] = useState(0);
  const motion = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, position?.value ?? 0));
    return height && position ? { height: height * (1 - p), opacity: 1 - p } : {};
  });
  return <Animated.View style={[{ overflow: 'hidden' }, motion]} accessibilityElementsHidden={hidden}
    importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} pointerEvents={position ? 'none' : 'auto'}>
    <View style={{ flexShrink: 0 }} onLayout={e => setHeight(e.nativeEvent.layout.height)}>{children}</View>
  </Animated.View>;
}
