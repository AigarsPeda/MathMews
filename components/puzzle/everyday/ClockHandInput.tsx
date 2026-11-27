import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Quantity } from '@/constants/puzzle-theme';
import type { ClockInput } from '@/utils/puzzle-clock';
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import { Path } from '@shopify/react-native-skia';
import { ProofCanvas } from './PaintedModel';
import { IdleHint } from '../kit/PracticeAffordances';
import { landTick } from '../kit/proofHaptics';

let encounteredHand = false;
type Props = {
  size: number;
  hourRadius: number;
  minuteRadius: number;
  time: number;
  dialTime: SharedValue<number>;
  backward: boolean;
  showDirection: boolean;
  givenLabel: string;
  input: ClockInput;
  times: number[];
  onPreview(time: number | null): void;
};

export function ClockHandInput({ size, hourRadius, minuteRadius, time, dialTime, backward, showDirection, givenLabel, input, times, onPreview }: Props) {
  const { t } = useTranslation();
  const [firstEncounter] = useState(() => !encounteredHand);
  const [touched, setTouched] = useState(false);
  const [pressed, setPressed] = useState(false);
  const drag = useRef<{ angle: number; start: number; time: number; moved: boolean } | null>(null);
  useEffect(() => {
    encounteredHand = true;
  }, []);
  const hourHand = Math.max(...times) - Math.min(...times) >= 60;
  const revolution = hourHand ? 720 : 60;
  const radius = (size * (hourHand ? hourRadius : minuteRadius)) / 240;
  const reduced = useReducedMotion();
  const angle = (time / revolution) * 2 * Math.PI;
  const tip = (a: number) => ({ x: size / 2 + radius * Math.sin(a), y: size / 2 - radius * Math.cos(a) });
  const handle = tip(angle);
  const handleMotion = useAnimatedStyle(() => {
    const a = (dialTime.value / revolution) * 2 * Math.PI;
    return { transform: [{ translateX: radius * Math.sin(a) }, { translateY: -radius * Math.cos(a) }] };
  });
  const cueRotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${dialTime.value * 360 / revolution}deg` }, { scaleX: backward ? -1 : 1 }],
  }));
  const hintDirection = backward ? -1 : 1;
  const ordered = times.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  function step(forward: boolean, wrap = false) {
    const choices = forward ? ordered : [...ordered].reverse();
    const next =
      choices.find((entry) => (forward ? entry.value > time : entry.value < time)) ??
      (wrap ? choices[0] : choices[choices.length - 1]);
    if (next) choose(next.index);
  }
  function choose(index: number) {
    setTouched(true);
    if (index !== input.selectedIndex) {
      input.onSelect(index);
      landTick();
    }
  }
  function fingerAngle(e: GestureResponderEvent) {
    return Math.atan2(e.nativeEvent.locationX - size / 2, size / 2 - e.nativeEvent.locationY);
  }
  function move(e: GestureResponderEvent) {
    const gesture = drag.current;
    if (!gesture) return;
    const next = fingerAngle(e);
    const delta = Math.atan2(Math.sin(next - gesture.angle), Math.cos(next - gesture.angle));
    gesture.angle = next;
    gesture.time += (delta * revolution) / (2 * Math.PI);
    gesture.moved ||= Math.abs(gesture.time - gesture.start) >= 0.5;
    if (gesture.moved) {
      const nearest = times.reduce((best, value, i) =>
        Math.abs(value - gesture.time) < Math.abs(times[best] - gesture.time) ? i : best, 0);
      onPreview(times[nearest]);
      choose(nearest);
    }
  }
  function release() {
    const gesture = drag.current;
    if (gesture && !gesture.moved) {
      step(true, true);
    }
    drag.current = null;
    setPressed(false);
    onPreview(null);
  }
  return (
    <View
      style={StyleSheet.absoluteFill}
      testID="clock-hand-input"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={givenLabel}
      accessibilityHint={t('clockSolution.moveHand')}
      accessibilityValue={
        input.selectedIndex == null ? undefined : { text: input.choices[input.selectedIndex] }
      }
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const action = event.nativeEvent.actionName;
        if (action !== 'increment' && action !== 'decrement') return;
        step(action === 'increment');
      }}
      onStartShouldSetResponder={(e) =>
        Math.hypot(e.nativeEvent.locationX - handle.x, e.nativeEvent.locationY - handle.y) <= 26
      }
      onResponderGrant={(e) => {
        setTouched(true);
        setPressed(true);
        drag.current = { angle: fingerAngle(e), start: time, time, moved: false };
      }}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminationRequest={() => false}
      onResponderTerminate={() => {
        drag.current = null;
        setPressed(false);
        onPreview(null);
      }}
    >
      <Animated.View pointerEvents="none" style={[styles.handleSlot, { left: size / 2 - 12, top: size / 2 - 12 }, handleMotion]}>
        <View style={[styles.handle, pressed && styles.pressed]} />
        {showDirection && <Animated.View style={[styles.direction, cueRotation]}>
          <ProofCanvas style={StyleSheet.absoluteFill}>
            <Path path="M 32 18 L 34 15 Q 39 17 42 21 L 42 18 L 46 18 L 46 28 L 36 27 L 37 23 L 40 24 Q 37 20 32 18 Z" color={Quantity.teal.onFill} />
          </ProofCanvas>
        </Animated.View>}
        {!showDirection && reduced && !touched && input.selectedIndex == null && <View style={[styles.arrow, { transform: [{ rotate: `${angle + (backward ? Math.PI : 0)}rad` }] }]}><ProofCanvas style={StyleSheet.absoluteFill}><Path path="M 3 0 L 10 6 L 3 12 L 0 9 L 4 6 L 0 3 Z" color="white" /></ProofCanvas></View>}
      </Animated.View>
      <IdleHint movable firstEncounter={firstEncounter} interacted={touched || input.selectedIndex != null}
        from={handle} to={tip(angle + hintDirection * Math.PI / 3)} />

    </View>
  );
}
const styles = StyleSheet.create({
  direction: { position: 'absolute', width: 48, height: 48, left: -12, top: -12 },
  handleSlot: { position: 'absolute', width: 24, height: 24 },
  arrow: { position: 'absolute', top: 7, left: 7, width: 12, height: 12 },
  handle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderBottomWidth: 4,
    backgroundColor: Quantity.teal.edge,
    borderColor: Quantity.teal.onFill,
    shadowColor: Quantity.teal.edge,
    shadowOpacity: 0.16,
    // friendly-ok: this shadow belongs to the draggable clock hand.
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
  pressed: { transform: [{ scale: 0.92 }], shadowOpacity: 0 },
});
