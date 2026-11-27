import { Quantity, Shape } from '@/constants/puzzle-theme';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

export function FractionWholeFace({ size, position, reduced = false, landed = 0, settled = false, demo = false }: {
  size: number;
  position?: SharedValue<number>;
  reduced?: boolean;
  landed?: number;
  settled?: boolean;
  demo?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const demoLift = useSharedValue(0);
  useEffect(() => {
    if (!demo || reduceMotion) return;
    demoLift.set(withDelay(420, withSequence(withTiming(1, { duration: 240 }), withTiming(0, { duration: 300 }))));
    return () => cancelAnimation(demoLift);
  }, [demo, demoLift, reduceMotion]);
  const left = useAnimatedStyle(() => {
    const phase = position?.get() ?? 0;
    const lift = position ? Math.max(0, 1 - Math.abs(phase - 1)) : demoLift.get();
    return { transform: [{ translateY: reduced ? 0 : -9 * lift }] };
  });
  const right = useAnimatedStyle(() => {
    const phase = position?.get() ?? 0;
    return { transform: [{ translateY: reduced ? 0 : -9 * Math.max(0, 1 - Math.abs(phase - 2)) }] };
  });
  const half = size / 2;
  return <View style={[styles.disk, { height: size + 9 }]}>
    {(['left', 'right'] as const).map((side, index) => <Animated.View key={side}
      style={[styles.half, { width: half, height: size }, index === 0 ? left : right]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: half, left: -index * half }]}>
        <View style={[styles.fill, { borderRadius: half }, reduced && !settled && landed === index + 1 && styles.counted]} />
      </View>
    </Animated.View>)}
  </View>;
}

const styles = StyleSheet.create({
  disk: { flexDirection: 'row', alignItems: 'flex-end', gap: Shape.space.seam },
  half: { overflow: 'hidden' },
  circle: { position: 'absolute', overflow: 'hidden', backgroundColor: Quantity.violet.edge },
  fill: { ...StyleSheet.absoluteFill, bottom: Shape.lip, backgroundColor: Quantity.violet.fill },
  counted: { backgroundColor: Quantity.violet.onFill },
});
