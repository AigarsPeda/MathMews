import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Motion } from '@/constants/puzzle-theme';
import { DenseLabel, valueToken } from '../kit/DenseLayout';

/** Wrap equations at operations. Keep both digits of a value in one native text node. */
export function CountingEquation({ equation, reserve = equation }: { equation: string; reserve?: string }) {
  const lines = (text: string) => text.split('\n').map((line, index) => <View key={index} style={styles.line}>
    {line.split(' ').map((token, i) => <DenseLabel key={i} role="readout">{valueToken(token)}</DenseLabel>)}
  </View>);
  return <View accessible accessibilityLabel={equation}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ opacity: 0 }}>{lines(reserve)}</View>
    <View style={StyleSheet.absoluteFill}>{lines(equation)}</View>
  </View>;
}

export function LandingFrame({ step, reduced, children }: { step: number; reduced: boolean; children: ReactNode }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reduced || step === 0) return;
    opacity.set(.88);
    opacity.set(withTiming(1, {duration: Motion.fade, reduceMotion: ReduceMotion.Never}));
  }, [opacity, reduced, step]);
  const style = useAnimatedStyle(() => ({opacity: opacity.value}));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: 6 },
});
