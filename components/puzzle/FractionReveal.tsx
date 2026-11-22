import { glide } from '@/utils/puzzle-motion';
import { createWedgePath } from '@/components/puzzle/FractionPieChart';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as Ink, PuzzleColors } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { getFractionGridSize } from '@/utils/fraction-match';
import type { FractionDiagram, FractionRevealPlan } from '@/utils/fraction-reveal';
import { Canvas, Group, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const inset = 5;

// Hold briefly at each piece boundary so the filled part and the count can be read together.
function filledPieces(phase: number, numerator: number) {
  'worklet';
  const pieces = Math.max(0, Math.min(1, phase)) * numerator;
  const complete = Math.floor(pieces);
  return complete + glide((pieces - complete) / 0.72);
}

function FractionModel({ part, width, phase, finished, paired, beats }: {
  part: FractionDiagram; width: number; phase: SharedValue<number>; finished: boolean; paired: boolean; beats: number;
}) {
  const { numerator, denominator, shape, selected, groupSize = 1 } = part;
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const value = useDerivedValue(() => filledPieces(phase.get(), beats) * numerator / beats);
  useAnimatedReaction(() => Math.floor(value.get()), (next, last) => {
    if (next !== last) scheduleOnRN(setCount, next);
  });
  const { cols, rows } = getFractionGridSize(denominator);
  const square = (width - inset * 2) / cols;
  const height = shape === 'pie' ? width : shape === 'grid' ? square * rows + inset * 2
    : shape === 'set' ? 86 : 44;
  const span = width - inset * 2;
  const cell = span / denominator;
  const center = width / 2;
  const radius = center - inset;
  const grid = useMemo(() => {
    const path = Skia.Path.Make();
    for (let i = 0; i < denominator; i++) {
      if (shape === 'pie') {
        path.addPath(createWedgePath(center, center, radius, -90 + i * 360 / denominator, 360 / denominator));
      } else if (shape === 'grid') {
        path.addRect(Skia.XYWHRect(inset + i % cols * square, inset + Math.floor(i / cols) * square, square, square));
      } else {
        path.addRect(Skia.XYWHRect(inset + i * cell, inset, cell, height - inset * 2));
      }
    }
    return path;
  }, [shape, denominator, center, radius, square, cols, height, cell]);
  const fill = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const pieces = value.get();
    if (shape === 'pie' || shape === 'grid') {
      for (let i = 0; i < Math.ceil(pieces); i++) {
        const index = selected?.[i] ?? i;
        const amount = Math.min(1, pieces - i);
        if (shape === 'pie') {
          path.addPath(createWedgePath(center, center, radius, -90 + index * 360 / denominator, amount * 360 / denominator));
        } else {
          path.addRect(Skia.XYWHRect(inset + index % cols * square, inset + Math.floor(index / cols) * square, square * amount, square));
        }
      }
    } else {
      path.addRect(Skia.XYWHRect(inset, inset, cell * pieces, height - inset * 2));
    }
    return path;
  });
  const dots = useMemo(() => {
    const path = Skia.Path.Make();
    if (shape !== 'set') return path;
    const columns = groupSize > 3 ? 2 : 1;
    const spacing = Math.min(cell / (columns + 1), (height - inset * 2) / (Math.ceil(groupSize / columns) + 1), 13);
    for (let i = 0; i < denominator; i++) {
      for (let j = 0; j < groupSize; j++) {
        path.addCircle(inset + (i + .5) * cell + (j % columns - (columns - 1) / 2) * spacing,
          height / 2 + (Math.floor(j / columns) - (Math.ceil(groupSize / columns) - 1) / 2) * spacing, spacing * .27);
      }
    }
    return path;
  }, [cell, denominator, groupSize, height, shape]);
  const shown = finished ? numerator : count;
  const label = `${shown}/${denominator}`;
  return <View style={styles.model}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Canvas style={{ width, height }} accessible={false}>
        <Group transform={[{ translateY: 2 }]}>
          <Path path={grid} color={Ink.fractionEdge} />
        </Group>
        <Path path={grid} color={Ink.fractionSurface} />
        <Path path={fill}>
          <LinearGradient start={vec(0, inset)} end={vec(width * .6, height)} colors={['#BEA1E5', Ink.fractionFill, '#8860BE']} />
        </Path>
        <Path path={grid} style="stroke" strokeWidth={shape === 'pie' ? 1.8 : denominator > 20 ? .8 : 1.4}
          strokeJoin="round" color={Ink.fractionEdge} />
        {shape === 'set' && <Path path={dots} color={Ink.fractionEdge} />}
      </Canvas>
      {shape === 'pie' && denominator <= 12 && width >= 110 && Array.from({ length: shown }, (_, i) => {
        const index = selected?.[i] ?? i;
        const angle = ((index + .5) / denominator * 2 - .5) * Math.PI;
        const distance = denominator === 1 ? 0 : radius * .66;
        return <Text key={index} allowFontScaling={false} style={[styles.sliceNumber, {
          left: center + Math.cos(angle) * distance - 12, top: center + Math.sin(angle) * distance - 12,
        }]}>{i + 1}</Text>;
      })}
    </View>
    <Text testID={paired ? undefined : 'fraction-solution-count'} style={paired ? styles.partCount : styles.count}>
      {finished && part.equivalents?.length ? [label, ...part.equivalents].join(' = ') : label}
    </Text>
    {!paired && <Text style={styles.caption}>{t('fractionModels.piecesCounted', { count: shown, total: denominator })}</Text>}
  </View>;
}

export function FractionReveal({ plan, onSolutionShown }: { plan: FractionRevealPlan; onSolutionShown: () => void }) {
  const { active, reduceMotion } = useAnimationActivity();
  const phase = useSharedValue(0);
  const [finished, setFinished] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const availableWidth = layoutWidth || Math.max(100, screenWidth - 64);
  const { diagrams, equation } = plan;
  const paired = diagrams.length > 1;
  const compact = paired && diagrams.every(p => p.shape === 'pie' || p.shape === 'grid');
  const steps = Math.max(1, ...diagrams.map(p => p.numerator));
  const [first, second] = diagrams;
  // Equivalent strips share a moving boundary, even while a larger piece is only partly filled.
  const aligned = first.shape === 'strip' && second?.shape === 'strip'
    && first.numerator * second.denominator === second.numerator * first.denominator;
  useEffect(() => {
    if (!active || reduceMotion) phase.set(1);
    else if (phase.get() < 1) phase.set(withDelay(240, withTiming(1, {
      duration: Math.min(5200, Math.max(1450, steps * 640)), easing: Easing.linear,
    })));
    return () => cancelAnimation(phase);
  }, [active, reduceMotion, phase, steps]);
  useAnimatedReaction(() => phase.get() >= 1, (done, previous) => {
    if (done && !previous) scheduleOnRN(setFinished, true);
  });
  useEffect(() => { if (finished) onSolutionShown(); }, [finished, onSolutionShown]);
  const single = diagrams[0];
  const final = equation ?? (!paired && single.numerator === single.denominator ? `${single.numerator}/${single.denominator} = 1` : undefined);
  return <View style={styles.wrap} onLayout={e => setLayoutWidth(e.nativeEvent.layout.width)}>
    <View style={[styles.models, compact && styles.sideBySide]}>
      {diagrams.map((part, i) => <FractionModel key={i} part={part} paired={paired} beats={aligned ? steps : Math.max(1, part.numerator)} phase={phase} finished={finished}
        width={part.shape === 'pie' || part.shape === 'grid'
          ? Math.min(compact ? 118 : 162, compact ? (availableWidth - 24) / 2 : availableWidth)
          : Math.min(304, availableWidth * .76)} />)}
    </View>
    {final && <Text style={styles.equation} testID="fraction-solution-equation" accessibilityLiveRegion="polite">{finished ? final : ' '}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch', paddingVertical: 10, gap: 10 },
  models: { alignItems: 'center', gap: 14 },
  sideBySide: { flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
  model: { alignItems: 'center', gap: 3 },
  sliceNumber: { position: 'absolute', width: 24, height: 24, lineHeight: 24, fontSize: 16, fontWeight: '800', textAlign: 'center', color: '#312044' },
  count: { fontSize: 32, fontWeight: '800', color: Ink.fractionEdge, fontVariant: ['tabular-nums'] },
  partCount: { fontSize: 21, fontWeight: '800', color: Ink.fractionEdge, textAlign: 'center', fontVariant: ['tabular-nums'] },
  caption: { fontSize: 16, fontWeight: '600', color: PuzzleColors.textMuted, textAlign: 'center' },
  equation: { fontSize: 23, fontWeight: '800', color: PuzzleColors.primaryDark, textAlign: 'center' },
});
