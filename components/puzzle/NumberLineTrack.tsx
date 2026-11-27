import { LineDot, placeLineLabels } from './number-line/LineMarks';
import { focusedScale, LandmarkLine } from './number-line/LandmarkLine';
import { countingCadence } from '@/utils/puzzle-motion';
import { DenseLabel, denseSpacing, useMeasuredLabels } from '@/components/puzzle/kit/DenseLayout';
import { lineValue } from '@/utils/number-line-reveal';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { Ink, Motion, PuzzleColors as GameColors, Quantity, Radius } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { FractionLineMarker, FractionLineRail, fractionLineBaseline, fractionLineLabelOffset, fractionLineGutter, fractionLineSpacing, fractionLineWidth, fractionMarkerSize } from './number-line/FractionLineRail';
import { EntryBuild } from "./kit/PracticeAffordances";

type NumberLineTrackProps = {
  min: number;
  max: number;
  start: number;
  value: number;
  onSelect?: (value: number) => void;
  disabled?: boolean;
  correctValue?: number;
  wrongValue?: number;
  /** Practice examples fit on screen and draw each completed one-number hop. */
  fit?: boolean;
  hops?: number;
  direction?: number;
  focusEnd?: number;
  tone?: 'teal' | 'violet';
  labelEvery?: number;
  showStart?: boolean;
  showMarker?: boolean;
  fractionDivisions?: number;
  distanceRange?: readonly [number, number];
  highlightedTick?: number;
  testID?: string;
  renderMarkerHint?: (geometry: { x: number; y: number; nextX: number }) => ReactNode;
  onTouchModel?: () => void;
};

const LINE_Y = moderateScale(58);
const HEIGHT = moderateScale(132);
const DOT_SIZE = 28;
const BOUNCE_HEIGHT = moderateScale(22);

export function NumberLineTrack(props: NumberLineTrackProps) {
  const { start, value, min, max, focusEnd, fractionDivisions, disabled, onSelect, correctValue, wrongValue } = props;
  if (!fractionDivisions && focusEnd !== undefined) return <LandmarkLine
    scale={focusedScale(start, focusEnd, min, max, value)} start={start} goal={focusEnd} value={value}
    unknown={correctValue === undefined} onSelect={disabled ? undefined : onSelect} submitted={wrongValue} />;
  return <PracticeLineTrack {...props} />;
}

function PracticeLineTrack({
  min, max, start, value, onSelect, disabled = false,
  correctValue, wrongValue, fit = false, hops = 0, direction = 1, focusEnd, tone = 'teal',
  renderMarkerHint, onTouchModel, labelEvery = 1, showStart = true, showMarker = true, fractionDivisions, distanceRange, highlightedTick, testID = "number-line-track",
}: NumberLineTrackProps) {
  const { t } = useTranslation();
  const quantity = Quantity[tone];
  const { fontScale } = useWindowDimensions();
  const selectable = Boolean(onSelect) && !disabled;
  const count = max - min + 1;
  const startLabel = t('puzzleTypes.startAt');
  const labels = Array.from({ length: count }, (_, i) => min + i).filter(number => fractionDivisions
    ? number === min || number === max : count <= 6 || number === min || number === max || number === start ||
      number === value && showMarker || number === highlightedTick || number === 0 || labelEvery > 1 && number % labelEvery === 0);
  const axisLabels = useMeasuredLabels(labels.map(number => lineValue(number)), 'readout');
  const markerSize = fractionDivisions ? fractionMarkerSize : DOT_SIZE;
  const annotations = useMeasuredLabels([startLabel, String(hops), ...(distanceRange ?? []).map(bound => String(Math.abs(bound - value)))], 'value');
  const lineY = fractionDivisions ? fractionLineBaseline : Math.max(LINE_Y, hops ? annotations.height + 44 : 0);
  const labelY = lineY + (fractionDivisions ? fractionLineLabelOffset : onSelect ? 31 : 18);
  const numeralHeight = axisLabels.height || 24 * Math.max(1, fontScale);
  const startY = labelY + numeralHeight + denseSpacing.mark;
  const trackHeight = Math.max(fractionDivisions ? 78 : HEIGHT, startY + (showStart || distanceRange ? (annotations.height || numeralHeight) + denseSpacing.label : 0));
  const scroll = useRef<ScrollView>(null);
  const scrolling = useRef(false);
  const dragStart = useRef<{ x: number; position: number } | null>(null);
  const [viewport, setViewport] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const centered = useRef(false);
  const available = Math.max(1, Math.floor(viewport / moderateScale(46)));
  const journey = focusEnd === undefined ? 0 : Math.abs(focusEnd - start) + 1;
  // Never squeeze ticks below a 44 pt touch target; the line scrolls instead.
  const visibleCount = Math.min(count, Math.max(available, Math.min(focusEnd === undefined ? 0 : journey + 4, Math.floor(viewport / 44))));
  const labelWidth = (axisLabels.width || Math.max(lineValue(min).length, lineValue(max).length) * 13 * fontScale) + denseSpacing.label;
  const minSpacing = Math.max(onSelect ? 44 : 12, fractionDivisions ? labelWidth + 10 : labelWidth / labelEvery);
  const spacing = fractionDivisions
    ? fractionLineSpacing(viewport, count, labelWidth)
    : Math.max(minSpacing, viewport > 0 ? viewport / (fit ? count : visibleCount) : moderateScale(56));
  const firstX = fractionDivisions ? fractionLineGutter : spacing / 2;
  const width = fractionDivisions ? fractionLineWidth(spacing, count) : spacing * count;
  const canScroll = !fit || width > viewport + 1;
  const startInRange = start >= min && start <= max;
  const startX = firstX + (start - min) * spacing;
  const startLabelWidth = (annotations.width || startLabel.length * 10 * fontScale) + denseSpacing.label;
  const markAt = (number: number) => firstX + (number - min) * spacing;
  const targetX = markAt(value) - markerSize / 2;
  const position = useSharedValue(targetX);
  const bounce = useSharedValue(1);
  const previousValue = useRef(value);
  const dragLanding = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const distance = Math.abs(value - previousValue.current);
    previousValue.current = value;
    const alreadyPlaced = dragLanding.current === value;
    dragLanding.current = null;
    if (alreadyPlaced || reducedMotion || distance === 0) {
      position.set(targetX);
      bounce.set(0);
    } else {
      const steps = Math.max(1, Math.round(Math.abs(targetX - position.get()) / spacing));
      const duration = steps === 1 ? Motion.step * 4 / 3 : Math.min(Motion.step * 4, steps * Motion.step * 8 / 9);
      const timing = steps === 1 ? { duration } : { duration, easing: countingCadence };
      // Preserve the visible height if another number is tapped mid-hop.
      bounce.set(bounce.get() % 1);
      bounce.set(withTiming(steps, timing));
      position.set(withTiming(targetX, timing));
    }
  }, [value, targetX, spacing, position, bounce, reducedMotion]);

  const markerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.get() },
      { translateY: -Math.abs(Math.sin(bounce.get() * Math.PI)) * BOUNCE_HEIGHT },
      { scale: fractionDivisions ? 1 + .12 * Math.max(0, 1 - Math.abs((bounce.get() % 1) - .88) / .12) : 1 },
    ],
  }));

  useEffect(() => {
    if (!canScroll || viewport === 0 || contentWidth === 0) return;
    const focus = !centered.current && focusEnd !== undefined && journey <= visibleCount ? (start + focusEnd) / 2 : value;
    const x = Math.max(0, Math.min(width - viewport, firstX + (focus - min) * spacing - viewport / 2));
    scroll.current?.scrollTo({ x, animated: centered.current && !reducedMotion });
    centered.current = true;
  }, [canScroll, contentWidth, firstX, focusEnd, journey, min, reducedMotion, spacing, start, value, viewport, visibleCount, width]);

  const paths = useMemo(() => {
    const jumps = Array.from({ length: hops }, (_, index) => {
      const from = firstX + (start - min + direction * index) * spacing;
      const to = from + direction * spacing;
      const y = lineY - moderateScale(10);
      const arc = Skia.Path.Make();
      arc.moveTo(from, y);
      arc.quadTo((from + to) / 2, y - moderateScale(48), to, y);
      const head = Skia.Path.Make();
      head.moveTo(to, y);
      head.lineTo(to - direction * moderateScale(10), y - moderateScale(6));
      head.lineTo(to - direction * moderateScale(2), y - moderateScale(13));
      head.close();
      return { arc, head, midpoint: (from + to) / 2 };
    });
    return jumps;
  }, [direction, firstX, hops, lineY, min, spacing, start]);

  const marks = showMarker ? <>
    {!fractionDivisions && startInRange && value !== start ? <View pointerEvents="none" style={[styles.origin, {
      top: lineY - DOT_SIZE / 2, left: startX - DOT_SIZE / 2,
    }]}><LineDot palette={quantity} /></View> : null}
    <Animated.View pointerEvents="none" style={[styles.marker, { top: lineY - markerSize / 2 }, markerStyle]}>
      {fractionDivisions ? <FractionLineMarker /> : <LineDot palette={value === wrongValue ? Quantity.amber : quantity} />}
    </Animated.View>
  </> : null;

  return (
    <ScrollView
      testID={testID}
      nativeID={fractionDivisions ? "play-entry-model" : undefined}
      ref={scroll}
      horizontal
      scrollEnabled={canScroll}
      showsHorizontalScrollIndicator={canScroll}
      onTouchStart={() => { scrolling.current = false; onTouchModel?.(); }}
      onScrollBeginDrag={() => { scrolling.current = true; }}
      onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
      onContentSizeChange={(nextWidth) => setContentWidth(nextWidth)}
      style={[styles.viewport, { height: trackHeight }]}
    >
      <View style={{ width, height: trackHeight }}>
        {axisLabels.probe}{annotations.probe}
        {fractionDivisions ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <EntryBuild>
            <View style={{ height: trackHeight }}>
              <FractionLineRail baseline={lineY} spacing={spacing} count={count} />
              {marks}
            </View>
          </EntryBuild>
        </View> : <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.rail, { left: firstX, right: firstX, top: lineY - 6, backgroundColor: Quantity.teal.light }]} />
          {Array.from({ length: count }, (_, index) => {
            const number = min + index;
            if (labelEvery > 1 && number % labelEvery !== 0 && number % (labelEvery / 2) !== 0 && number !== highlightedTick) return null;
            return <View key={number} style={[styles.tick, { left: markAt(number) - 5, top: lineY - 9,
              backgroundColor: number === highlightedTick ? GameColors.primary : Quantity.teal.fill }]} />;
          })}
          {paths.length > 0 ? <Canvas style={StyleSheet.absoluteFill}>
          {paths.map(({ arc }, index) => (
            // friendly-ok: directional hop arc
            <Path key={`arc-${index}`} path={arc} color={wrongValue === undefined ? Quantity.violet.fill : Quantity.amber.fill} style="stroke" strokeWidth={8} strokeCap="round" />
          ))}
          {paths.map(({ head }, index) => (
            <Path key={`head-${index}`} path={head} color={wrongValue === undefined ? Quantity.violet.fill : Quantity.amber.fill} />
          ))}
          </Canvas> : null}
        </View>}
        {paths.map(({ midpoint }, index) => (
          <View key={index} pointerEvents="none" style={[styles.annotation, { left: midpoint - annotations.width / 2, top: 0,
            width: annotations.width + 1 }]}><DenseLabel role="value">{index + 1}</DenseLabel></View>
        ))}
        {!fractionDivisions && marks}
        <View style={styles.numbers}>
          {Array.from({ length: count }, (_, index) => {
            const number = min + index;
            const isCurrent = showMarker && number === value;
            const labeled = labels.includes(number);
            const label = fractionDivisions ? (index === 0 ? '0' : index === count - 1 ? '1' : `${index}/${fractionDivisions}`) : lineValue(number);
            const center = markAt(number);
            const left = Math.max(0, center - spacing / 2);
            const targetWidth = Math.min(width, center + spacing / 2) - left;
            return (
              <Pressable
                key={number}
                testID={`line-tick-${number}`}
                disabled={disabled || !onSelect}
                accessible={selectable}
                accessibilityRole="button"
                accessibilityLabel={fractionDivisions ? t('fractionModels.point', { count: index, total: fractionDivisions }) : t("puzzleTypes.numberLineTickA11y", { value: label })}
                accessibilityState={{ selected: isCurrent, disabled: disabled || !onSelect }}
                onPress={() => { if (!scrolling.current) onSelect?.(number); }}
                style={[styles.numberTarget, { left, width: targetWidth, paddingTop: labelY }]}
              >
                {({ pressed }) => <>
                  <View pointerEvents="none" style={[styles.tickLabels, { width: spacing, marginLeft: 2 * (center - left) - targetWidth }]}>
                  {selectable && !fractionDivisions ? <View style={[styles.selectableTick,
                    (pressed || isCurrent && value !== start) && styles.pressedTick]} /> : null}
                  {fractionDivisions && labeled ? <DenseLabel role="readout">{label}</DenseLabel> :
                    (labeled || (fractionDivisions && isCurrent)) && labelEvery === 1 ? <Text numberOfLines={fractionDivisions ? undefined : 1} style={[
                  styles.number,
                  isCurrent && styles.currentNumber,
                  fractionDivisions && isCurrent && !labeled ? styles.currentFraction : undefined,
                  number === correctValue && styles.correctNumber,
                  number === wrongValue && styles.wrongNumber,
                ]}>{label}</Text> : null}
                  </View>
                </>}
              </Pressable>
            );
          })}
        </View>
        {selectable && showMarker ? <View style={[styles.handle, { top: lineY - 22, left: markAt(value) - 22 }]}
          accessible accessibilityRole="adjustable"
          accessibilityLabel={fractionDivisions ? t('fractionModels.lineLabel') : t('puzzleTypes.numberLineTickA11y', { value: lineValue(value) })}
          accessibilityValue={{ min, max, now: value, text: lineValue(value, fractionDivisions) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event => onSelect?.(Math.max(min, Math.min(max, value + (event.nativeEvent.actionName === 'increment' ? 1 : -1))))}
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={event => { onTouchModel?.(); dragStart.current = { x: event.nativeEvent.pageX, position: markAt(value) }; }}
          onResponderMove={event => {
            const drag = dragStart.current;
            if (!drag) return;
            const x = drag.position + event.nativeEvent.pageX - drag.x;
            bounce.set(0);
            position.set(Math.max(firstX, Math.min(width - firstX, x)) - markerSize / 2);
          }}
          onResponderRelease={event => {
            const drag = dragStart.current;
            dragStart.current = null;
            if (!drag) return;
            const tick = Math.max(min, Math.min(max, value + Math.round((event.nativeEvent.pageX - drag.x) / spacing)));
            position.set(markAt(tick) - markerSize / 2);
            if (fractionDivisions || Math.abs(event.nativeEvent.pageX - drag.x) > 4 || tick !== value) {
              if (tick !== value) dragLanding.current = tick;
              onSelect?.(tick);
            }
          }}
          onResponderTerminate={() => { dragStart.current = null; position.set(targetX); }}
        /> : null}
        {selectable && showMarker && viewport > 0 ? renderMarkerHint?.({
          x: markAt(value), y: lineY, nextX: markAt(value < max ? value + 1 : value - 1),
        }) : null}
        {labelEvery > 1 && placeLineLabels([...labels].sort((a, b) => Number(b === start) - Number(a === start))
          .map(n => ({ n, center: markAt(n), width: labelWidth })), width, 1).map(({ n, left, width: boxWidth }) =>
          <Text key={n} numberOfLines={1} style={[styles.number, styles.scaleNumber, {
            top: labelY, width: boxWidth, left, color: n === highlightedTick ? GameColors.primaryDark : Ink.text,
          }]}>{lineValue(n)}</Text>)}
        {showStart && startInRange ? <View pointerEvents="none" style={[styles.annotation, {
          top: startY, width: startLabelWidth, left: Math.max(0, Math.min(width - startLabelWidth, startX - startLabelWidth / 2)),
        }]}><DenseLabel role="value">{startLabel}</DenseLabel></View> : null}
        {distanceRange?.map(bound => {
          const distance = Math.abs(bound - value);
          if (distance === 0) return null;
          const left = markAt(Math.min(bound, value));
          const span = distance * spacing;
          return <View key={bound} pointerEvents="none" style={[styles.distance, { left, width: span, top: startY }]}>
            <View style={styles.distanceBracket} />
            <View style={[styles.distanceLabel, { width: startLabelWidth, marginLeft: (span - startLabelWidth) / 2 }]}>
              <DenseLabel role="value">{distance}</DenseLabel>
            </View>
          </View>;
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', height: 12, borderRadius: 6 },
  tick: { position: 'absolute', width: 10, height: 18, borderRadius: 5 },
  handle: { position: 'absolute', width: 44, height: 44 },
  viewport: { width: "100%", height: HEIGHT, flexGrow: 0 },
  origin: { position: "absolute", width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  marker: { position: 'absolute', left: 0, zIndex: 1 },
  numbers: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  numberTarget: { position: 'absolute', height: "100%", alignItems: "center", justifyContent: "flex-start" },
  tickLabels: { alignItems: 'center' },
  number: { fontSize: 20, fontWeight: "800", color: Ink.text, fontVariant: ["tabular-nums"] },
  selectableTick: { position: 'absolute', top: -16, width: 10, height: 10, borderRadius: 5, backgroundColor: Quantity.teal.fill },
  pressedTick: { backgroundColor: GameColors.primary },
  scaleNumber: { position: "absolute", textAlign: "center" },
  currentFraction: { paddingHorizontal: 5, borderRadius: Radius.piece, backgroundColor: Quantity.violet.soft },
  currentNumber: { fontWeight: "800" },
  correctNumber: { color: GameColors.success },
  wrongNumber: { color: GameColors.primaryDark },
  annotation: { position: "absolute", alignItems: "center" },
  distance: { position: 'absolute' },
  distanceLabel: { alignItems: 'center' },
  distanceBracket: { height: 6, borderRadius: 3, backgroundColor: Quantity.teal.fill },
});
