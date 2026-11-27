import { differenceBarWidths } from '../kit/difference-bar';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useQuantityPractice } from '../counting/QuantityPractice';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useStationaryDrawingStyle } from '../PuzzleContentTransition';
import { PuzzleText } from '../PuzzleText';
import { useModelStage } from '../kit/ModelStage';
import { UnitRun } from '../kit/UnitRun';

export function PercentageShareBar({ parts, width: requestedWidth, whole, progress, settled, submitted, helpBeat }: {
  parts: number; width: number; whole: number; helpBeat?: number; progress?: SharedValue<number>; settled?: boolean; submitted?: number;
}) {
  const stationary = useStationaryDrawingStyle();
  const stage = useModelStage();
  const screen = useWindowDimensions();
  const width = Math.min(requestedWidth, stage.width || Infinity, screen.width - 32);
  const amount = whole / parts;
  const practice = useQuantityPractice();
  const anchor = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  // The proof has a different wrapper and XL collapses the question on Check.
  // Measure the fixed outer view so positioning the bar cannot move its anchor.
  const positionKey = `percent-share:${width}:${screen.height}:${screen.fontScale}`;
  const alignBar = useCallback(() => {
    anchor.current?.measureInWindow((_x, y, _w, h) => {
      if (!h) return;
      if (!progress) practice.snapshot.insets.set(positionKey, y);
      else if (submitted != null && submitted !== amount) {
        setOffset((practice.snapshot.insets.get(positionKey) ?? y) - y);
      }
    });
  }, [amount, positionKey, practice, progress, submitted]);
  useLayoutEffect(alignBar, [alignBar, stage.height, settled]);
  const miss = settled && submitted != null && submitted !== amount;
  const gap = Shape.space.seam;
  const short = (submitted ?? amount) < amount;
  const delta = Math.abs(amount - (submitted ?? amount));
  const widths = differenceBarWidths(width, whole, amount, submitted ?? amount);
  const shown = miss ? submitted : settled ? amount : whole;
  const wholePaint = useAnimatedStyle(() => ({ opacity: progress ? 1 - Math.min(1, progress.get()) : 1 }));
  if (helpBeat !== undefined) {
    const count = helpBeat === 0 ? 1 : parts;
    const barHeight = Math.min(144, width * .4);
    return <View accessible accessibilityLabel={helpBeat === 0 ? String(whole) : Array(parts).fill(amount).join(' + ')}
      style={{ width, height: barHeight }}>
      <UnitRun width={width} height={barHeight} count={count} filled={helpBeat < 2 ? count : 1} />
      <View style={styles.labels}>{Array.from({ length: count }, (_, i) =>
        <PuzzleText key={i} style={[styles.label, { fontSize: 36 }]}>{count === 1 ? whole : amount}</PuzzleText>)}</View>
    </View>;
  }
  return <View ref={anchor} collapsable={false} onLayout={alignBar} style={{ width, height: 100 }}>
    <Animated.View style={[{ flex: 1, top: offset }, stationary]} accessible accessibilityRole="image"
    accessibilityLabel={`${100 / parts}% × ${whole} ${miss ? '≠' : '='} ${settled ? shown : '?'}`}>
    {miss ? <View style={[styles.bar, { flexDirection: 'row', gap, backgroundColor: 'white', borderRadius: 10, overflow: 'hidden' }]}>
      <View style={[styles.segment, { width: widths.left, backgroundColor: Quantity.teal.edge }]}>
        <View style={[styles.face, { backgroundColor: Quantity.teal.fill }]}><PuzzleText numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.5} style={styles.label}>{shown}</PuzzleText></View>
      </View>
      <View style={[styles.deltaPiece, { width: widths.delta }]}>
        <PuzzleText numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.deltaText}>{short ? '+' : '−'}{delta}</PuzzleText>
      </View>
      <View style={[styles.segment, { width: widths.right, backgroundColor: Shape.emptyLip }]}>
        <View style={[styles.face, { backgroundColor: Shape.empty }]}><PuzzleText numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.5} style={styles.label}>{100 / parts}%</PuzzleText></View>
      </View>
    </View> : <View style={styles.bar}>
      <UnitRun width={width} height={56} count={parts} filled={1} hue="teal" />
      <Animated.View style={[StyleSheet.absoluteFill, wholePaint]}><UnitRun width={width} height={56} count={parts} hue="teal" /></Animated.View>
      <View style={styles.labels}><PuzzleText numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.5} style={styles.label}>{shown}</PuzzleText>
        <PuzzleText numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.5} style={[styles.label, styles.target]}>{settled ? `${100 / parts}%` : '?'}</PuzzleText></View>
    </View>}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
  labels: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  label: { fontSize: 24, fontWeight: '800' },
  target: { backgroundColor: Quantity.amber.soft, paddingHorizontal: 5, borderRadius: 8 },
  deltaPiece: { backgroundColor: Quantity.amber.fill, alignItems: 'center', justifyContent: 'center' },
  deltaText: { color: Ink.text, fontSize: 24, fontWeight: '800' },
  segment: { paddingBottom: Shape.lip },
  face: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
