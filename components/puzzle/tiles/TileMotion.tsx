import { ResultMark } from '@/components/puzzle/kit/PuzzleKit';
import { Motion, ProofMotion, PuzzleColors, Stroke } from '@/constants/puzzle-theme';
import { moderateScale } from '@/utils/scale';
import { landTick } from '../kit/proofHaptics';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeIn, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming,
  type EntryAnimationsValues, type LayoutAnimation,
} from 'react-native-reanimated';

export { landTick, resultTick } from '../kit/proofHaptics';
export type TileResult = 'correct' | 'wrong' | null;

/** A landing tick each time `trigger` changes after mount (a component, so a board can declare it). */
export function HapticTick({ trigger }: { trigger: unknown }) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    landTick();
  }, [trigger]);
  return null;
}

const ease = Easing.out(Easing.cubic);
// Worklets cannot call JS helpers such as moderateScale: sizes are fixed here.
const DROP = moderateScale(10);
const LIFT = moderateScale(18);

/** The submitting Play screen owns result haptics. A tile only paints its evidence. */
export function FeedbackTile({ result = null, selected = false, delay = 0, mark = true, children, style }: {
  result?: TileResult; selected?: boolean; delay?: number; mark?: boolean;
  /** Legacy tile callers may still supply this flag. */
  haptic?: boolean;
  children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>
    {children}
    {selected && !result && <View pointerEvents="none" style={styles.selected} />}
    {result && mark ? <ResultBadge kind={result} delay={delay} /> : null}
  </View>;
}

/** A single result mark in the top-right corner. */
export function ResultBadge({ kind, delay = 0, size = moderateScale(16), style }: { kind: 'correct' | 'wrong'; delay?: number; size?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  return <Animated.View pointerEvents="none" accessible={false} style={[styles.badge, style]}
    entering={reduce ? undefined : FadeIn.delay(delay).duration(ProofMotion.reward).reduceMotion(ReduceMotion.System)}>
    <View style={[styles.badgeDisc, { backgroundColor: kind === 'correct' ? PuzzleColors.successSurface : PuzzleColors.incorrectSurface }]}>
      <ResultMark kind={kind} size={size} />
    </View>
  </Animated.View>;
}

/** The travelling piece reaches its slot once, at the end of the move. */
export function landIn(_values: EntryAnimationsValues): LayoutAnimation {
  'worklet';
  return {
    initialValues: { transform: [{ translateY: -DROP }] },
    animations: { transform: [{ translateY: withTiming(0, { duration: ProofMotion.travel, easing: ease }) }] },
  };
}
export const landFade = FadeIn.duration(ProofMotion.fade);
function landInAfter(delay: number) {
  return (_values: EntryAnimationsValues): LayoutAnimation => {
    'worklet';
    return {
      initialValues: { transform: [{ translateY: -DROP }] },
      animations: { transform: [{ translateY: withDelay(delay, withTiming(0, { duration: ProofMotion.travel, easing: ease })) }] },
    };
  };
}

/** A piece that lands where it is placed (Reduce Motion: fades in). */
export function Land({ children, style, skip = false, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; skip?: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  return <Animated.View style={style} entering={skip ? undefined : reduce ? landFade : delay ? landInAfter(delay) : landIn}>{children}</Animated.View>;
}

/**
 * A piece that flies from a point on screen (window coordinates of where the
 * learner touched it) into this slot, then lands with the spring.
 */
export function FlyIn({ from, to, delay = 0, children, style }: {
  from: { x: number; y: number } | null; to: { x: number; y: number } | null; delay?: number; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const dx = from && to ? from.x - to.x : 0, dy = from && to ? from.y - to.y : 0;
  const travel = useSharedValue(reduce || (!dx && !dy) ? 1 : 0);
  const opacity = useSharedValue(reduce ? 0 : 1);
  useEffect(() => {
    if (reduce) { opacity.set(withTiming(1, { duration: Motion.fade })); return; }
    travel.set(withDelay(delay, withTiming(1, { duration: ProofMotion.travel, easing: ease })));
  }, [reduce, delay, travel, opacity]);
  const motion = useAnimatedStyle(() => {
    const t = travel.get();
    // A gentle arc: the piece rises a little while it travels.
    const lift = Math.sin(t * Math.PI) * LIFT;
    return {
      opacity: opacity.get(),
      transform: [{ translateX: dx * (1 - t) }, { translateY: dy * (1 - t) - lift }],
    };
  });
  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}

/**
 * A strike-through drawn from left to right across a wrong value (it is never
 * swapped out): the mistake stays readable underneath.
 */
export function StrikeThrough({ delay = 0, color = PuzzleColors.incorrect }: { delay?: number; color?: string }) {
  const reduce = useReducedMotion();
  const drawn = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) drawn.set(withDelay(delay, withTiming(1, { duration: Motion.step, easing: ease })));
  }, [reduce, delay, drawn]);
  const line = useAnimatedStyle(() => ({ width: `${drawn.get() * 100}%` }));
  return <View pointerEvents="none" accessible={false} style={styles.strikeBox}>
    <Animated.View style={[styles.strike, { backgroundColor: color }, line]} />
  </View>;
}

/**
 * A one-off attention pulse (rule well, docked output, landed hop) each time
 * `trigger` changes to a non-null value after the first render.
 */
export function usePulse(trigger: unknown, enabled = true) {
  const reduce = useReducedMotion();
  const border = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    const initial = first.current;
    first.current = false;
    if (initial || !enabled || trigger == null || trigger === false) return;
    border.set(reduce ? 0 : withSequence(withTiming(1, { duration: ProofMotion.press }), withTiming(0, { duration: ProofMotion.settle })));
  }, [trigger, enabled, reduce, border]);
  return useAnimatedStyle(() => ({ opacity: border.get() * .16 }));
}

/** Pulses once each time `when` turns true or `trigger` changes (a hop lands, a value updates). */
export function Pulse({ when, trigger, children, style }: { when?: boolean; trigger?: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const pulse = usePulse(trigger !== undefined ? trigger : when || null);
  return <View style={style}>{children}<Animated.View accessible={false} pointerEvents="none" style={[styles.pulse, pulse]} /></View>;
}

const styles = StyleSheet.create({
  selected: { ...StyleSheet.absoluteFill, backgroundColor: PuzzleColors.primary, opacity: .12, borderRadius: 8 },
  pulse: { ...StyleSheet.absoluteFill, borderRadius: 8, backgroundColor: PuzzleColors.primary },
  badge: { position: 'absolute', top: -moderateScale(8), right: -moderateScale(8), zIndex: 2 },
  badgeDisc: { width: moderateScale(24), height: moderateScale(24), borderRadius: moderateScale(12), backgroundColor: PuzzleColors.background,
    alignItems: 'center', justifyContent: 'center' },
  strikeBox: { position: 'absolute', left: -moderateScale(4), right: -moderateScale(4), top: 0, bottom: 0, justifyContent: 'center' },
  strike: { height: Stroke.active + .5, borderRadius: 2, transform: [{ rotate: '-8deg' }] },
});
