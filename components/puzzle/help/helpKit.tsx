import { PuzzleText as Text } from '../PuzzleText';
import { useRevealBeats, type RevealBeats } from '../kit/useRevealBeats';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import { useContext, useEffect, type ReactNode } from 'react';
import { HelpCaptionContext } from '../kit/HelpCaptionContext';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, interpolate, useAnimatedStyle, Extrapolation } from 'react-native-reanimated';

/** Picture-help worked proofs: a few big pieces that move on one clock, one caption at a time, one final equation. */
export const { teal, amber, violet } = Quantity;
export type Hue = typeof teal | typeof amber | typeof violet;

/** Beats that play at a pace a child can follow; the first lands about 0.2 s after the proof mounts. */
export function useHelpBeats(count: number | null, onDone: () => void, step = 650, hold: number | ((landed: number) => number) = 400, lead = 160) {
  return useRevealBeats(count, { step, hold, lead, minTotal: 0, reducedSteps: true, onDone });
}

/**
 * The beat caption a proof narrates: it takes the sheet's rule line while it plays and the rule returns once `caption` is null.
 * Returns true when the sheet carries the caption, so the proof draws none of its own.
 */
export function useHelpCaption(caption: string | null) {
  const setCaption = useContext(HelpCaptionContext);
  useEffect(() => { setCaption?.(caption); }, [setCaption, caption]);
  useEffect(() => () => setCaption?.(null), [setCaption]);
  return !!setCaption;
}

/** 0 before beat `k` (1-based) starts, 1 once it has landed, eased in between. */
export function beatProgress(position: number, k: number) {
  'worklet';
  return interpolate(position, [k - 1, k], [0, 1], Extrapolation.CLAMP);
}

/** A piece pops in while its beat plays. */
export function usePop(beats: RevealBeats, k: number) {
  return useAnimatedStyle(() => {
    const p = beatProgress(beats.position.value, k);
    return { opacity: Math.min(1, p * 3), transform: [{ scale: 0.7 + 0.3 * p }] };
  }, [beats, k]);
}

/** A rounded flat piece with the 3 pt lip. */
export function Piece({ hue, width, height, children, style }: {
  hue: Hue | { fill: string; edge: string }; width?: number | `${number}%`; height: number; children?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.piece, { backgroundColor: hue.fill, borderColor: hue.edge, width, height, borderRadius: Shape.tile(height) + 6 }, style]}>{children}</View>;
}

/** An empty receiving slot, reserved from the first frame. */
export function Slot({ width, height, style }: { width?: number | `${number}%`; height: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.piece, { backgroundColor: Shape.empty, borderColor: Shape.emptyLip, width, height, borderRadius: Shape.tile(height) + 6 }, style]} />;
}

export function Digit({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return <Text maxFontSizeMultiplier={1.2} style={[styles.digit, { fontSize: size, lineHeight: Math.round(size * 1.2) }]}>{children}</Text>;
}

/** The caption lane and the equation slot are one lane: a caption while playing, the final equation once settled. */
/** `readout` sets the caption in the equation's size: a running total or a time the child reads off the model. */
export function ProofLine({ caption, equation, readout = false }: { caption?: string; equation?: string; readout?: boolean }) {
  return <View style={styles.line}>
    {equation ? <Animated.View key="equation" entering={FadeIn.duration(260)}><Text maxFontSizeMultiplier={1.2} style={styles.equation}>{equation}</Text></Animated.View>
      : caption ? <Animated.View key={caption} entering={FadeIn.duration(200)}><Text maxFontSizeMultiplier={1.2} style={readout ? styles.readout : styles.caption}>{caption}</Text></Animated.View> : null}
  </View>;
}

const styles = StyleSheet.create({
  piece: { borderBottomWidth: Shape.lip, alignItems: 'center', justifyContent: 'center' },
  digit: { color: Ink.text, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  line: { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  equation: { color: Ink.text, fontWeight: '800', fontSize: 32, lineHeight: 40, textAlign: 'center', fontVariant: ['tabular-nums'] },
  caption: { color: Ink.text, fontWeight: '700', fontSize: 22, lineHeight: 30, textAlign: 'center' },
  readout: { color: Ink.text, fontWeight: '800', fontSize: 30, lineHeight: 38, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
