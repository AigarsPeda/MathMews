import { LineDot, placeLineLabels } from './LineMarks';
import { useFirstQuantityEncounter } from '../counting/QuantityPractice';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { lineValue } from '@/utils/number-line-reveal';
import { Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { ProofCanvas, type TrackProofCanvas } from '../ProofCanvas';
import { PuzzleText } from '../PuzzleText';
import { EntryBuild, IdleHint } from '../kit/PracticeAffordances';

export type LineScale = { min: number; max: number; labels: number[]; labelRows?: number };

const maxLandmarkFontScale = 1.65;

export function focusedScale(start: number, end: number, min: number, max: number, current = start): LineScale {
  const low = Math.min(start, end, current), high = Math.max(start, end, current);
  const left = Math.max(min, low - (low < 0 && high > 0 ? 2 : 1));
  const right = Math.min(max, high + (low < 0 && high > 0 ? 2 : 1));
  return { min: left, max: right, labels: [...new Set([left, right, start, end, current, ...(left < 0 && right > 0 ? [0] : [])])] };
}

export function estimateScale(a: number, total: number, chosen?: number): LineScale {
  const nearest = Math.round(total / 10) * 10;
  const roundingMarks = [nearest - 10, nearest, nearest + 10];
  const labels = [...new Set([a, ...roundingMarks, ...(chosen == null ? [] : [chosen])])];
  const min = Math.floor(Math.min(a, nearest - 10, chosen ?? a) / 10) * 10 - 10;
  return { min, max: Math.max(a, nearest + 10, chosen ?? a), labels, labelRows: 1 };
}

export function LandmarkLine({ scale, start, goal, value = start, unknown = false, onSelect, route,
  position, landed = 0, submitted, settled, missLastHop = false, annotate = false, trackCanvas }: {
  scale: LineScale; start: number; goal: number; value?: number; unknown?: boolean; onSelect?: (n: number) => void;
  route?: readonly number[]; position?: SharedValue<number>; landed?: number; submitted?: number;
  settled?: boolean; missLastHop?: boolean; annotate?: boolean | 'total'; trackCanvas?: TrackProofCanvas;
}) {
  const { width: screen, fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(340, screen - 48));
  const firstEncounter = useFirstQuantityEncounter('landmark-line', !!onSelect);
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const editPosition = useSharedValue(value);
  const [touched, setTouched] = useState(false);
  useEffect(() => { editPosition.set(reduced ? value : withTiming(value, { duration: 350 })); }, [editPosition, value, reduced]);
  const { min, max, labels } = scale;
  const landmarkFontScale = Math.min(fontScale, maxLandmarkFontScale);
  const labelText = (n: number) => unknown && n === goal && n !== value ? '?' : lineValue(n);
  const labelWidth = (n: number) => 4 + 13 * landmarkFontScale * labelText(n).length;
  const widestLabel = Math.max(...labels.map(labelWidth));
  const inset = Math.max(18, widestLabel / 2);
  const unit = (width - 2 * inset) / Math.max(1, max - min);
  const x = (n: number) => inset + (n - min) * unit;
  const ticks = unit >= 12 ? Array.from({ length: max - min + 1 }, (_, index) => min + index) : labels;
  const annotationHeight = Math.ceil(28 * landmarkFontScale);
  const arcLimit = fontScale >= maxLandmarkFontScale ? 23 : 45;
  const baseline = annotationHeight + arcLimit + 10;
  const frame = useDerivedValue(() => {
    const beat = Math.min(reduced ? landed : position?.get() ?? 0, Math.max(0, (route?.length ?? 1) - 1));
    const i = Math.floor(beat), phase = beat - i;
    const from = route?.[i] ?? editPosition.get(), to = route?.[i + 1] ?? from;
    const lift = Math.min(arcLimit, Math.abs(to - from) * unit * .65);
    return { n: from + (to - from) * phase, dy: -4 * lift * phase * (1 - phase), beat };
  });
  const mover = useAnimatedStyle(() => ({ transform: [
    { translateX: inset + (frame.get().n - min) * unit - 14 }, { translateY: baseline + frame.get().dy - 14 },
  ] }));
  const arcs = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const miss = Skia.Path.Make();
    if (!route) return { path, miss };
    const beat = frame.get().beat;
    for (let i = 0; i < beat && i + 1 < route.length; i++) {
      const phase = Math.min(1, beat - i);
      const from = inset + (route[i] - min) * unit, distance = (route[i + 1] - route[i]) * unit;
      const h = Math.min(arcLimit, Math.abs(distance) * .65);
      const hop = missLastHop && i === route.length - 2 ? miss : path;
      hop.moveTo(from, baseline);
      hop.quadTo(from + distance * phase / 2, baseline - 2 * h * phase, from + distance * phase, baseline - 4 * h * phase * (1 - phase));
    }
    return { path, miss };
  });
  const travelled = useDerivedValue(() => arcs.get().path);
  const missed = useDerivedValue(() => arcs.get().miss);
  const select = (pixel: number) => {
    if (onSelect) { setTouched(true); onSelect(Math.max(min, Math.min(max, min + Math.round((pixel - inset) / unit)))); }
  };
  const index = Math.max(0, Math.min(landed, (route?.length ?? 1) - 2));
  const next = route?.[index + 1];
  const delta = next === undefined ? 0 : next - route![index];
  // Place nearby numerals on two rows when their text would overlap.
  const sorted = [...labels].sort((a, b) => {
    const priority = (n: number) => n === start || n === goal || n === submitted || n === value ? 0 : 1;
    return priority(a) - priority(b) || a - b;
  });
  const landmarks = placeLineLabels(sorted.map(n => ({ n, center: x(n), width: labelWidth(n) })), width, scale.labelRows);
  const rowHeight = 31 * landmarkFontScale;
  const content = <View pointerEvents="none" style={{ height: baseline + 18 + rowHeight * (landmarks.some(label => label.row === 1) ? 2 : 1) }}>
    <View style={[styles.rail, { left: inset, right: inset, top: baseline - 6 }]} />
    {ticks.map(n => <View key={n} style={[styles.tick, { left: x(n) - 5, top: baseline - 9 }]} />)}
    {[...new Set([start, goal])].map(n => <View key={n} style={[styles.stop, { left: x(n) - 14, top: baseline - 14 }]}>
      <LineDot />
    </View>)}
    {landmarks.map(({ n, left, row, width: numeralWidth }) => <PuzzleText key={n} maxFontSizeMultiplier={maxLandmarkFontScale} numberOfLines={1}
      style={[styles.number, { left, top: baseline + 18 + rowHeight * row, width: numeralWidth }]}>{labelText(n)}</PuzzleText>)}
    {route && <ProofCanvas trackCanvas={trackCanvas} style={StyleSheet.absoluteFill}>
      {/* friendly-ok: the violet arc is the travelled hop */}
      <Path path={travelled} color={Quantity.violet.fill} style="stroke" strokeWidth={10} strokeCap="round" />
      {/* friendly-ok: the final hop changes color for a missed judgment */}
      {missLastHop && <Path path={missed} color={Quantity.amber.fill} style="stroke" strokeWidth={10} strokeCap="round" />}
    </ProofCanvas>}
    {annotate && delta !== 0 && (!settled || annotate === 'total') && <PuzzleText numberOfLines={1} maxFontSizeMultiplier={maxLandmarkFontScale} style={[styles.number, { left: Math.max(0, Math.min(width - 90, (x(route![index]) + x(next!)) / 2 - 45)), width: Math.min(90, width), top: 0 }]}>
      {delta > 0 ? '+' : ''}{lineValue(delta)}</PuzzleText>}
    {submitted != null ? <View style={[styles.stop, { left: x(submitted) - 14, top: baseline - 14 }]}>
      <LineDot palette={submitted === goal ? Quantity.teal : Quantity.amber} /></View>
      : <Animated.View style={[styles.stop, mover]}><LineDot /></Animated.View>}
    {onSelect ? <IdleHint movable={!!onSelect} firstEncounter={firstEncounter} from={{ x: x(start), y: baseline }} interacted={touched || value !== start} /> : null}
  </View>;
  return <View testID={route ? 'play-proof-model' : 'play-entry-model'} nativeID={route ? 'play-proof-model' : 'play-entry-model'}
    style={styles.stage} onLayout={e => setWidth(e.nativeEvent.layout.width)} accessible
    accessibilityRole={onSelect ? 'adjustable' : 'image'} accessibilityLabel={t('puzzleTypes.numberLineTickA11y', { value: lineValue(route?.[landed] ?? value) })}
    accessibilityValue={{ min, max, now: route?.[landed] ?? value }} accessibilityActions={onSelect ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
    onAccessibilityAction={e => onSelect?.(Math.max(min, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
    onStartShouldSetResponder={() => !!onSelect} onResponderRelease={e => select(e.nativeEvent.locationX)}>
    {route ? content : <EntryBuild>{content}</EntryBuild>}
  </View>;
}

const styles = StyleSheet.create({
  stage: { width: '100%', alignSelf: 'center' },
  rail: { position: 'absolute', height: 12, borderRadius: 6, backgroundColor: Quantity.teal.fill },
  tick: { position: 'absolute', width: 10, height: 18, borderRadius: 5, backgroundColor: Quantity.teal.fill },
  stop: { position: 'absolute', top: 0, left: 0, width: 28, height: 28, borderRadius: 14 },
  number: { position: 'absolute', fontWeight: '800', fontSize: 20, color: Ink.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
