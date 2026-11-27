import type { FractionNumberLinePuzzle } from '@/types/puzzle';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { DenseLabel, denseSpacing, useMeasuredLabels } from '../kit/DenseLayout';
import { ProofCaption } from '../kit/Focus';
import { RevealSurface } from '../kit/RevealSurface';
import { useRevealBeats } from '../kit/useRevealBeats';
import { FractionLineMarker, FractionLineRail, FractionLineStage, fractionHopHeight, fractionLineBaseline as baseline, fractionLineLabelOffset, fractionLineSpacing, fractionLineWidth, fractionLineX, fractionMarkerSize } from '../number-line/FractionLineRail';
import { PlayProofCaption } from '../PlayProofCaption';
import { ProofCanvas, useProofCanvasPaint } from '../ProofCanvas';
import { PuzzleText } from '../PuzzleText';

export function FractionNumberLineReveal({ puzzle, submitted, onSolutionShown }: {
  puzzle: FractionNumberLinePuzzle; submitted?: number; onSolutionShown: () => void;
}) {
  const { divisions, numerator, denominator } = puzzle.payload;
  const goal = numerator * divisions / denominator;
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const axis = useMeasuredLabels(['0', String(divisions)], 'readout');
  const endpointWidth = (axis.width || String(divisions).length * 13 * fontScale) + denseSpacing.label;
  const spacing = fractionLineSpacing(width, divisions + 1, endpointWidth);
  const height = baseline + fractionLineLabelOffset + (axis.height || 24 * Math.max(1, fontScale)) + denseSpacing.mark;
  const count = submitted === undefined ? goal : 0;
  const beats = useRevealBeats(width ? count : null, { awaitInitialPaint: true, lead: 120, minTotal: 0, reducedSteps: true,
    step: Math.min(650, 2700 / Math.max(1, count)), hold: i => i === count ? 220 : 0, onDone: onSolutionShown });
  const trackCanvas = useProofCanvasPaint(beats, width > 0 && axis.ready, [0]);
  const { landed, reduced, position } = beats;
  const current = submitted ?? landed;
  useEffect(() => {
    scroll.current?.scrollTo({ x: Math.max(0, fractionLineX(spacing, current) - width / 2), animated: submitted === undefined && !reduced });
  }, [current, reduced, spacing, submitted, width]);
  const progress = useDerivedValue(() => submitted ?? (reduced ? landed : position.get()));
  const marker = useAnimatedStyle(() => {
    const tick = progress.get(), phase = tick % 1;
    return { transform: [{ translateX: fractionLineX(spacing, tick) - fractionMarkerSize / 2 },
      { translateY: baseline - fractionMarkerSize / 2 - 4 * fractionHopHeight * phase * (1 - phase) }] };
  });
  const arcs = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const end = Math.min(count, progress.get());
    for (let i = 0; i < end; i++) {
      const phase = Math.min(1, end - i), x = fractionLineX(spacing, i);
      path.moveTo(x, baseline);
      path.quadTo(x + spacing * phase / 2, baseline - 2 * fractionHopHeight * phase,
        x + spacing * phase, baseline - 4 * fractionHopHeight * phase * (1 - phase));
    }
    return path;
  });
  const fraction = `${goal}/${divisions}`;
  const equation = denominator !== divisions ? `${fraction} = ${numerator}/${denominator}` : goal === divisions ? `${fraction} = 1`
    : goal === 2 ? `1/${divisions} + 1/${divisions} = ${fraction}` : goal > 2 ? `${goal} × 1/${divisions} = ${fraction}` : fraction;
  return <RevealSurface beats={beats} replayable={submitted === undefined}>
    <FractionLineStage><ScrollView ref={scroll} horizontal nativeID="play-proof-model" testID="play-proof-model"
      scrollEnabled={fractionLineWidth(spacing, divisions + 1) > width + 1} showsHorizontalScrollIndicator={false}
      onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height, flexGrow: 0 }}>
      <View style={{ width: fractionLineWidth(spacing, divisions + 1), height }}>
        {axis.probe}
        <FractionLineRail baseline={baseline} spacing={spacing} count={divisions + 1} labels={submitted === undefined ? [landed] : [goal, submitted]} testPrefix="reveal-line-tick-" />
        {[0, divisions].map(i => <View key={i} style={{ position: 'absolute', alignItems: 'center',
          top: baseline + fractionLineLabelOffset, left: fractionLineX(spacing, i) - spacing / 2, width: spacing }}><DenseLabel role="readout">{i ? '1' : '0'}</DenseLabel></View>)}
        {submitted !== undefined && <View style={[styles.gap, { left: fractionLineX(spacing, Math.min(goal, submitted)),
          width: Math.abs(submitted - goal) * spacing }]} />}
        <ProofCanvas trackCanvas={trackCanvas} style={StyleSheet.absoluteFill}>
          {/* friendly-ok: broad bands trace completed fraction hops */}
          <Path path={arcs} color={Quantity.violet.fill} style="stroke" strokeWidth={10} strokeCap="round" />
        </ProofCanvas>
        {Array.from({ length: Math.min(count, landed + 1) }, (_, i) => <View key={i}
          style={[styles.chip, { left: fractionLineX(spacing, i) + spacing / 2 - 22 }]}><PuzzleText numberOfLines={1}
          adjustsFontSizeToFit maxFontSizeMultiplier={1.15} style={styles.text}>{`1/${divisions}`}</PuzzleText></View>)}
        <Animated.View style={[styles.marker, marker]}><FractionLineMarker amber={submitted !== undefined} /></Animated.View>
      </View>
    </ScrollView></FractionLineStage>
    {beats.settled && submitted === undefined && <PlayProofCaption><View nativeID="play-proof-equation" testID="play-proof-equation">
      <View testID="line-solution-equation"><ProofCaption text={equation} /></View>
    </View></PlayProofCaption>}
  </RevealSurface>;
}

const styles = StyleSheet.create({
  marker: { position: 'absolute', top: 0, left: 0 },
  chip: { position: 'absolute', top: 4, width: 44, height: 28, borderRadius: 12, justifyContent: 'center', backgroundColor: Quantity.violet.soft },
  text: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: Ink.text },
  gap: { position: 'absolute', top: baseline - 6, height: 12, borderRadius: 6, backgroundColor: Quantity.amber.fill },
});
