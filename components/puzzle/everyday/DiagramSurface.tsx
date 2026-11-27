import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Quantity, Motion, PuzzleColors } from '@/constants/puzzle-theme';
import { JugGrip } from './JugGrip';
import { RevealSurface } from '../kit/RevealSurface';
import type { RevealBeats } from '../kit/useRevealBeats';

/** The same diagram also serves as the static question and as a worked example. */
export function DiagramSurface({ beats, playing, children, replayable }: { replayable?: boolean; beats: RevealBeats; playing: boolean; children: ReactNode }) {
  return playing ? <RevealSurface replayable={replayable} beats={beats} style={styles.surface}>{children}</RevealSurface> : <>{children}</>;
}

/** A learner-controlled pointer. Touching above or below it moves one scale division. */
export function AdjustableTrace({ marks, majors, target, name, contact, height, width, label, style, selectedValue, onMark, hint, jugGrip, bare }: {
  marks: readonly number[]; majors: readonly number[]; target: number; name: string; contact: string;
  hint?: string; jugGrip?: boolean; bare?: boolean; selectedValue?: number; onMark?: (value: number) => void;
  height: number; width: number; label: (value: number) => string; style?: ViewStyle;
}) {
  const { t } = useTranslation();
  const [trace, setTrace] = useState({ index: Math.max(0, marks.indexOf(selectedValue ?? 0)), direction: 1, selection: selectedValue });
  if (trace.selection !== selectedValue) {
    const matching = selectedValue === undefined ? -1 : marks.indexOf(selectedValue);
    const index = matching < 0 ? trace.index : matching;
    setTrace({ index, direction: index >= trace.index ? 1 : -1, selection: selectedValue });
  }
  const top = marks[marks.length - 1];
  const value = marks[trace.index] ?? 0;
  const y = height * (1 - value / top);
  const goTo = (index: number) => {
    if (index === trace.index) { onMark?.(marks[index]); return; }
    setTrace({ index, direction: index > trace.index ? 1 : -1, selection: selectedValue });
    onMark?.(marks[index]);
  };
  const move = (direction: number) => goTo(Math.max(0, Math.min(marks.length - 1, trace.index + direction)));
  const tick = majors.includes(value) ? label(value) : t(trace.direction > 0 ? 'everyday.traceUp' : 'everyday.traceDown');
  const pointerWidth = Math.min(26, width * .48);
  const spoken = [tick, value === target && contact].filter(Boolean).join(', ');
  return <View accessible accessibilityRole="adjustable" accessibilityLabel={name} accessibilityHint={hint} accessibilityValue={{ text: spoken }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={event => {
      if (event.nativeEvent.actionName === 'increment') move(1);
      if (event.nativeEvent.actionName === 'decrement') move(-1);
    }}
    onStartShouldSetResponder={() => true}
    onResponderGrant={event => move(event.nativeEvent.locationY < y + 8 ? 1 : -1)}
    onResponderMove={onMark && (event => {
      const at = top * (1 - (event.nativeEvent.locationY - 8) / height);
      goTo(marks.reduce((best, n, i) => Math.abs(at - n) < Math.abs(at - marks[best]) ? i : best, 0));
    })}
    onResponderTerminationRequest={onMark && (() => false)}
    style={[{ position: 'absolute', height: height + 16, width: Math.max(44, width) }, style]}>
    {bare ? null : jugGrip ? <JugGrip x={width / 2} y={y + 8} /> : <><View pointerEvents="none" style={[styles.halo, { top: y - 6, left: (width - pointerWidth) / 2 - 10, width: pointerWidth + 20, opacity: value === target ? 1 : 0 }]} /><View pointerEvents="none" style={[styles.pointer, { top: y + 4, left: (width - pointerWidth) / 2, width: pointerWidth }]} /></>}
  </View>;
}

/** Land the last unit, hold it, then fade in the written calculation. */
export function DiagramCaption({ settled, children }: { settled: boolean; children: ReactNode }) {
  return settled ? <Animated.View entering={FadeIn.duration(Motion.settle)}>{children}</Animated.View> : <View>{children}</View>;
}

const styles = StyleSheet.create({
  surface: { alignSelf: 'stretch' },
  pointer: { position: 'absolute', height: 8, borderRadius: 4, backgroundColor: PuzzleColors.primary },
  halo: { position: 'absolute', height: 28, borderRadius: 14, backgroundColor: Quantity.violet.soft },
});
