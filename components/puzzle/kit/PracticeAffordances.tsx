import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Ink, PuzzleColors, Quantity } from '@/constants/puzzle-theme';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { PuzzleText } from '../PuzzleText';
import { DiagramIcon } from './DiagramIcon';
import { PressFace } from './PressFace';
import { landTick } from './proofHaptics';

type Point = Readonly<{ x: number; y: number }>;
type Surface = { children?: ReactNode; style?: StyleProp<ViewStyle> };
type AccessiblePress = Pick<PressableProps, 'accessibilityActions' | 'onAccessibilityAction' | 'accessibilityHint' | 'testID' | 'onPressIn' | 'onPressOut'>;

/** Scale the paint only. Its target and the positions of surrounding pieces are live immediately. */
export function EntryBuild({ children, index = 0, ready = true, lead = 0, style }: Surface & { index?: number; ready?: boolean; lead?: number }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0.9);
  const started = useRef(false);
  useEffect(() => {
    if (reduced) {
      scale.set(1);
      if (ready) started.current = true;
    } else if (ready && !started.current) {
      started.current = true;
      scale.set(withDelay(lead + Math.min(360, Math.max(0, index) * 35), withSequence(
        withTiming(1.04, { duration: 140 }), withTiming(1, { duration: 100 }))));
    }
  }, [index, lead, ready, reduced, scale]);
  useEffect(() => () => {
    started.current = false;
    cancelAnimation(scale);
  }, [scale]);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <View style={style}><Animated.View style={motion}>{children}</Animated.View></View>;
}

/** Draw attention to the unknown once, while the learner is still considering the story. */
export function StoryIdleCue({ active, style, children }: Surface & { active: boolean }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    const start = setTimeout(() => pulse.set(reduced ? 1 : withTiming(1, { duration: 240 })), 4000);
    const end = setTimeout(() => pulse.set(reduced ? 0 : withTiming(0, { duration: 240 })), 4700);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
      cancelAnimation(pulse);
      pulse.set(0);
    };
  }, [active, pulse, reduced]);
  const cue = useAnimatedStyle(() => ({
    opacity: 1 - .18 * pulse.get(),
  }));
  return <Animated.View style={[style, cue]}>{children}</Animated.View>;
}

/** Coordinates are relative to the model. Pass interacted as soon as a child touches the model. */
export function IdleHint({ movable, from, to = from, firstEncounter, interacted = false }: {
  movable: boolean; from: Point; to?: Point; firstEncounter: boolean; interacted?: boolean;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'waiting' | 'showing' | 'done'>('waiting');
  if (interacted && phase !== 'done') setPhase('done');
  const eligible = movable && firstEncounter;
  const visible = eligible && phase === 'showing' && !interacted;
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!eligible || phase === 'done') return;
    const timer = phase === 'waiting'
      ? setTimeout(() => setPhase('showing'), 4000)
      : setTimeout(() => setPhase('done'), 1200);
    return () => clearTimeout(timer);
  }, [eligible, phase]);
  useEffect(() => {
    progress.set(visible && !reduced ? withTiming(1, { duration: 1200 }) : 0);
    return () => cancelAnimation(progress);
  }, [visible, reduced, progress]);
  const motion = useAnimatedStyle(() => {
    const t = progress.get();
    const travel = interpolate(t, [0, .22, .7, 1], [0, 0, 1, 1]);
    const scale = interpolate(t, [0, .16, .3, .7, .83, 1], [1, .86, 1, 1, .86, 1]);
    return { transform: [{ translateX: (to.x - from.x) * travel }, { translateY: (to.y - from.y) * travel }, { scale }] };
  });
  if (!visible) return null;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Animated.View style={[styles.indicator, { left: from.x - 19, top: from.y - 19 }, !reduced && motion]}>
      <MaterialCommunityIcons name="gesture-tap" size={27} color={Quantity.berry.edge} />
    </Animated.View>
  </View>;
}

export function DropTargetOutline({ children, style, active = false, filled = false, onPress, accessibilityLabel, ...accessibility }: Surface & AccessiblePress & {
  active?: boolean; filled?: boolean;
} & ({ onPress: () => void; accessibilityLabel: string } | { onPress?: undefined; accessibilityLabel?: string })) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  const awaitingDrop = active && !filled;
  useEffect(() => {
    opacity.set(awaitingDrop && !reduced ? withSequence(withTiming(.65, { duration: 340 }), withTiming(1, { duration: 340 })) : 1);
    return () => cancelAnimation(opacity);
  }, [awaitingDrop, reduced, opacity]);
  const breath = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const content = <><Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.outline, awaitingDrop && styles.active, filled && styles.filled, breath]} />{children}</>;
  if (!onPress) return <View testID={accessibility.testID} style={[styles.target, style]}>{content}</View>;
  return <Pressable {...accessibility} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { landTick(); onPress(); }} style={[styles.target, style]}>{content}</Pressable>;
}

type MovablePieceProps = Surface & { disabled?: boolean; selected?: boolean; borderless?: boolean } & (
  | (AccessiblePress & { static?: false; paintOnly?: false; onPress: () => void; accessibilityLabel: string })
  | { static?: false; paintOnly: true; testID?: string; onPress?: never; accessibilityLabel?: never }
  | { static: true; paintOnly?: boolean; testID?: string; onPress?: never; accessibilityLabel?: string }
);

export function MovablePiece({ children, style, disabled = false, selected = false, borderless: _borderless, ...input }: MovablePieceProps) {
  if (input.static) return <View testID={input.testID} accessibilityLabel={input.accessibilityLabel}
    style={[styles.piece, styles.staticPiece, style]}>{children}</View>;
  const face = (pressed: boolean) => <><PressFace fill={selected ? Quantity.berry.soft : PuzzleColors.card} edge={selected ? Quantity.berry.edge : Ink.line}
    radius={9} raised={!disabled && !input.paintOnly} pressed={pressed} />{children}</>;
  if (input.paintOnly) return <View testID={input.testID} pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={[styles.piece, style]}>{face(false)}</View>;
  const { onPress, accessibilityLabel, paintOnly: _paintOnly, ...accessibility } = input;
  return <Pressable {...accessibility} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected, disabled }}
    disabled={disabled} onPress={() => { landTick(); onPress(); }} style={[styles.piece, style]}>
    {({ pressed }) => face(pressed)}
  </Pressable>;
}

/** Keep the illustrated bubble compact. Long questions use the full-width heading. */
export function StoryHost({ text, testID, onPromptLayout }: {
  text: string;
  testID?: string;
  /** Bottom of the native question text in points from the top of StoryHost. */
  onPromptLayout?: (bottom: number) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const layoutKey = `${width}:${fontScale}:${text}`;
  const [plainFor, setPlainFor] = useState('');
  const bubbleLayout = useRef<{ top?: number; textBottom?: number }>({});
  function reportBubbleLayout(change: { top?: number; textBottom?: number }) {
    const measurement = Object.assign(bubbleLayout.current, change);
    if (measurement.top !== undefined && measurement.textBottom !== undefined) {
      onPromptLayout?.(measurement.top + measurement.textBottom);
    }
  }
  if (plainFor === layoutKey) return <PuzzleText testID={testID} accessibilityRole="header" style={styles.question}
    onLayout={onPromptLayout && (event => onPromptLayout(event.nativeEvent.layout.height))}>{text}</PuzzleText>;
  return <View testID={testID} style={styles.host}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><DiagramIcon name="cat" size={40} /></View>
    <View style={styles.bubble} onLayout={onPromptLayout && (event => reportBubbleLayout({ top: event.nativeEvent.layout.y }))}>
      <View style={styles.tail} />
      <PuzzleText accessibilityRole="header" style={styles.question} onLayout={event => {
        const { y, height } = event.nativeEvent.layout;
        if (height > 52) setPlainFor(layoutKey);
        else reportBubbleLayout({ textBottom: y + height });
      }}>{text}</PuzzleText>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  indicator: { position: 'absolute', width: 38, height: 38, borderRadius: 19,
    backgroundColor: Quantity.berry.light, alignItems: 'center', justifyContent: 'center' },
  target: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  outline: { borderRadius: 10, backgroundColor: Ink.tray },
  // friendly-ok: Only the active, empty drop destination has a dashed boundary.
  active: { borderStyle: 'dashed', borderWidth: 3, borderColor: Ink.line, backgroundColor: Quantity.berry.soft },
  filled: { borderColor: PuzzleColors.success, backgroundColor: PuzzleColors.successSurface },
  piece: { minHeight: 44, minWidth: 44, padding: 6, alignItems: 'center', justifyContent: 'center' },
  staticPiece: { borderRadius: 9, backgroundColor: Quantity.teal.soft },
  host: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bubble: { flex: 1, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, borderBottomWidth: 3, borderColor: Ink.trayEdge, backgroundColor: Ink.tray },
  tail: { width: 9, height: 9, left: -5, top: '45%', transform: [{ rotate: '45deg' }], position: 'absolute', backgroundColor: Ink.tray },
  question: { fontSize: 17, fontWeight: '800', color: Ink.text },
});
