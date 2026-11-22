import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as Ink, PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import type { RatioTablePuzzle } from '@/types/puzzle';
import { ratioGroups } from '@/utils/bridge-models';
import { Canvas, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { cancelAnimation, useAnimatedReaction, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const bottle = 'M8 6 H16 V12 C16 16 22 16 22 23 V43 Q22 47 18 47 H6 Q2 47 2 43 V23 C2 16 8 16 8 12 Z';
const water = 'M4 24 Q8 22 12 24 T20 24 V42 Q20 45 17 45 H7 Q4 45 4 42 Z';

function BottleGroup({ index, bottles, litres, slot, tileCols, tile, height, progress }: {
  index: number; bottles: number; litres: number; slot: number; tileCols: number; tile: number; height: number; progress: SharedValue<number>;
}) {
  const opacity = useDerivedValue(() => Math.min(1, Math.max(0, progress.get() - index)));
  const slide = useDerivedValue(() => [{ translateY: 7 * (1 - opacity.get()) }]);
  const width = slot - 6;
  const cols = Math.min(bottles, width >= 80 ? 5 : width >= 54 ? 3 : 2);
  const rows = Math.ceil(bottles / cols);
  const scale = Math.min(1.15, (width - 4) / (cols * 26), 79 / (rows * 50));
  return <Group transform={[{ translateX: index * slot + 3 }]}>
    <RoundedRect x={0} y={height - 4} width={width} height={4} r={2} color={Ink.empty} />
    <Group opacity={opacity} transform={slide}>
      {Array.from({ length: bottles }, (_, i) => {
        const row = Math.floor(i / cols);
        const count = Math.min(cols, bottles - row * cols);
        const x = width / 2 + (i % cols - count / 2) * 26 * scale;
        const y = 83 - (rows - row) * 50 * scale;
        return <Group key={i} transform={[{ translateX: x }, { translateY: y }, { scale }]}>
          <Path path={bottle} color={Ink.glass} />
          <Path path={water} color={Ink.waterTop} />
          <Path path={bottle} style="stroke" strokeWidth={1.6} color={Ink.geometryEdge} />
          <RoundedRect x={6.5} y={2} width={11} height={6} r={1.8} color={Colors.primary} />
          <RoundedRect x={5.7} y={26} width={2.3} height={11} r={1.1} color={Ink.glass} />
        </Group>;
      })}
      {Array.from({ length: litres }, (_, i) => {
        const row = Math.floor(i / tileCols);
        const count = Math.min(tileCols, litres - row * tileCols);
        const x = width / 2 + (i % tileCols - count / 2) * tile + 1;
        return <RoundedRect key={i} x={x} y={94 + row * tile} width={tile - 2} height={tile - 2} r={2} color={Ink.geometryEdge} />;
      })}
    </Group>
  </Group>;
}

export function RatioReveal({ puzzle, onSolutionShown }: { puzzle: RatioTablePuzzle; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const { active, reduceMotion } = useAnimationActivity();
  const { bottles, litres, start, end } = ratioGroups(puzzle.payload);
  const slots = Math.max(start, end);
  const slot = Math.min(108, (measured || width - 56) / slots);
  const progress = useSharedValue(start);
  const [count, setCount] = useState(start);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (reduceMotion || !active || start === end) {
      progress.set(end);
      setCount(end);
      setFinished(true);
    } else {
      // Linger on each whole pair. Both quantities enter or leave in the same beat.
      progress.set(withDelay(700, withTiming(end, {
        duration: Math.min(3600, Math.max(1250, Math.abs(end - start) * 900)),
        easing: value => {
          'worklet';
          const steps = Math.abs(end - start);
          const beat = value * steps;
          const phase = Math.min(1, Math.max(0, (beat % 1 - .16) / .60));
          return (Math.floor(beat) + phase * phase * (3 - 2 * phase)) / steps;
        },
      }, completed => { if (completed) scheduleOnRN(setFinished, true); })));
    }
    return () => cancelAnimation(progress);
  }, [progress, start, end, reduceMotion, active]);
  useAnimatedReaction(() => Math.round(progress.get()), (next, previous) => {
    if (next !== previous) scheduleOnRN(setCount, next);
  });
  useEffect(() => { if (finished && count === end) onSolutionShown(); }, [finished, count, end, onSolutionShown]);
  const { a, b } = puzzle.payload;
  const left = count * bottles, right = count * litres;
  const given = `${a} : ${b}`;
  const equation = count === start ? given : `${given} = ${left} : ${right}`;
  const widthPerGroup = slot - 6;
  const tileCols = Math.min(litres, Math.max(2, Math.floor((widthPerGroup - 4) / 11)), 6);
  const tile = Math.min(18, (widthPerGroup - 4) / tileCols);
  const height = 104 + Math.ceil(litres / tileCols) * tile;
  return <View style={styles.board} onLayout={event => setMeasured(event.nativeEvent.layout.width)}>
    <View style={styles.totals}>
      <View style={styles.total}><Text style={styles.label}>{t('bridge.bottles')}</Text><Text style={styles.number}>{left}</Text></View>
      <View style={styles.total}><Text style={styles.label}>{t('bridge.totalLitres')}</Text><Text style={styles.number}>{right}</Text></View>
    </View>
    <Canvas accessible={false} style={{ width: slots * slot, height }}>
      {Array.from({ length: slots }, (_, index) =>
        <BottleGroup key={index} {...{ index, bottles, litres, slot, tileCols, tile, height, progress }} />)}
    </Canvas>
    <Text style={styles.key}>{t('bridge.litreSquare')}</Text>
    <Text testID="ratio-equation" accessibilityLiveRegion="polite" style={styles.equation}>{equation}</Text>
  </View>;
}

const styles = StyleSheet.create({
  board: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12, gap: 10 },
  totals: { flexDirection: 'row', justifyContent: 'center', gap: 26 },
  total: { alignItems: 'center', flexShrink: 1 },
  label: { color: Colors.textMuted, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  number: { color: Colors.text, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  key: { color: Ink.geometryEdge, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  equation: { color: Colors.primaryDark, fontSize: 26, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
});
