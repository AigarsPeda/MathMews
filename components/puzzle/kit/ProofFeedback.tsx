import { ProofMotion } from '@/constants/puzzle-theme';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import Animated, { LinearTransition, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

export const ProofPlaybackContext = createContext<{
  playback: boolean; settled: boolean; skipped: boolean; landingHaptics: boolean; onLanding?: () => void;
}>({ playback: false, settled: false, skipped: false, landingHaptics: false });

/** A loose piece compresses on contact. A result chip has its own final beat. */
function Feedback({ kind, active, children }: { kind: 'land' | 'finale'; active: boolean; children: ReactNode }) {
  const { skipped, landingHaptics, onLanding } = useContext(ProofPlaybackContext);
  const reduced = useReducedMotion();
  const amount = useSharedValue(0), fade = useSharedValue(1);
  const last = useRef(false);
  useEffect(() => {
    const contact = active && !last.current;
    last.current = active;
    if (!active || skipped) { amount.set(0); fade.set(1); return; }
    if (!contact) return;
    if (kind === 'land' && landingHaptics) onLanding?.();
    if (reduced) {
      fade.set(0); fade.set(withTiming(1, { duration: ProofMotion.fade, reduceMotion: ReduceMotion.Never }));
    } else if (kind === 'land') {
      amount.set(withSequence(withTiming(1, { duration: ProofMotion.land / 2 }), withTiming(0, { duration: ProofMotion.land / 2 })));
    } else {
      amount.set(-.06);
      amount.set(withSequence(withTiming(.04, { duration: ProofMotion.finale / 2 }), withTiming(0, { duration: ProofMotion.finale / 2 })));
    }
  }, [active, amount, fade, kind, landingHaptics, onLanding, reduced, skipped]);
  const style = useAnimatedStyle(() => {
    const a = amount.get();
    return { opacity: fade.get(), transform: [{ scaleX: 1 + (kind === 'land' ? .06 * a : a) }, { scaleY: 1 + (kind === 'land' ? -.06 * a : a) }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function ProofLanding({ landed, children }: { landed: boolean; children: ReactNode }) {
  return <Feedback kind="land" active={landed}>{children}</Feedback>;
}

export function ProofFinale({ settled, children }: { settled: boolean; children: ReactNode }) {
  return <Feedback kind="finale" active={settled}>{children}</Feedback>;
}

const geometryTransition = LinearTransition.duration(ProofMotion.fade).reduceMotion(ReduceMotion.System);

/** For an existing part whose position or dimensions change without a mathematical landing. */
export function ProofGeometry({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { skipped } = useContext(ProofPlaybackContext);
  const reduced = useReducedMotion();
  return <Animated.View style={style} layout={skipped || reduced ? undefined : geometryTransition}>{children}</Animated.View>;
}
