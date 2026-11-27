import { ProofMotion, Shape } from '@/constants/puzzle-theme';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

/** Absolute paint inside a stationary host. Content, target and siblings retain their layout. */
export function PressFace({ pressed, fill, edge, radius, borderWidth = 0, raised = true }: {
  pressed: boolean; fill: string; edge: string; radius: number; borderWidth?: number; raised?: boolean;
}) {
  const reduced = useReducedMotion();
  const depth = useSharedValue(0);
  useEffect(() => {
    depth.set(withTiming(pressed ? 1 : 0, { duration: reduced ? 0 : pressed ? ProofMotion.press : ProofMotion.settle }));
  }, [depth, pressed, reduced]);
  const motion = useAnimatedStyle(() => ({
    bottom: raised ? Shape.lip - depth.get() : 0,
    transform: [{ scaleY: reduced ? 1 : 1 - .02 * depth.get() }],
  }));
  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
    {raised && <View style={[StyleSheet.absoluteFill, { top: Shape.lip, backgroundColor: edge, borderRadius: radius }]} />}
    <Animated.View style={[StyleSheet.absoluteFill, {
      transformOrigin: 'bottom', backgroundColor: fill, borderColor: edge, borderRadius: radius, borderWidth,
    }, motion]} />
  </View>;
}
