import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import type { SortBucketsPuzzle } from '@/types/puzzle';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

type Fraction = [number, number];
type Payload = Extract<SortBucketsPuzzle['payload'], { rule: 'fractions' }>;
const ROW = 56;

function Strip({ fraction, moved = false, offset }: { fraction: Fraction; moved?: boolean; offset?: ReturnType<typeof useAnimatedStyle<{ transform: { translateY: number }[] }>> }) {
  const [n, d] = fraction;
  return <View style={styles.row}>
    <Text style={styles.label}>{fraction.join('/')}</Text>
    <Animated.View style={[styles.strip, offset]}>{Array.from({ length: d }, (_, i) =>
      <View key={i} style={[styles.part, { backgroundColor: i >= n ? Shape.empty : moved ? Quantity.violet.fill : Quantity.teal.fill }]} />
    )}</Animated.View>
  </View>;
}

function Tile({ fraction, position, start, dock, index }: {
  fraction: Fraction; position: SharedValue<number>; start: number; dock: number; index: number;
}) {
  const style = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(1, position.value - 2 * index));
    return { opacity: index === 0 || position.value >= 2 * index ? 1 : 0,
      transform: [{ translateY: start + (dock - start) * progress }] };
  });
  // Slide straight in beside the bucket: the shaded ends line up without the two colours overlapping.
  return <Animated.View style={[styles.tile, style]}><Strip moved fraction={fraction} /></Animated.View>;
}

export function HelpFractionSort({ payload, height }: { payload: Payload; height: number }) {
  const beats = useRevealBeats(4, { lead: 580, step: i => i % 2 ? 440 : 880, hold: 350, minTotal: 0, easing: 'inOut' });
  const board = Math.max(ROW * 4 + 20, Math.min(height - 44, 360));
  const start = (board - ROW) / 2;
  const tiles = payload.fractions.map(fraction => {
    const bucket = payload.targets.findIndex(([n, d]) => n * fraction[1] === d * fraction[0]);
    return { fraction, bucket, dock: bucket === 0 ? ROW + 4 : board - 2 * ROW - 4 };
  });
  const last = tiles[tiles.length - 1];
  return <RevealSurface beats={beats}>
    <View style={{ height: board, justifyContent: 'space-between' }}>
      {payload.targets.map(target => <Strip key={target.join('/')} fraction={target} />)}
      {tiles.map(({ fraction, dock }, i) => <Tile key={i} index={i} fraction={fraction} position={beats.position} start={i === 0 ? start : (dock < tiles[0].dock ? Math.min(start, tiles[0].dock - ROW - 4) : Math.max(start, tiles[0].dock + ROW + 4))} dock={dock} />)}
    </View>
    <View style={styles.reading}>{beats.settled && <Text style={styles.equation}>
      {last.fraction.join('/')} = {payload.targets[last.bucket].join('/')}
    </Text>}</View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  row: { height: ROW, flexDirection: 'row', alignItems: 'center' },
  label: { width: 94, paddingHorizontal: 12, textAlign: 'center', fontSize: 28, fontWeight: '800', color: Ink.text },
  strip: { flex: 1, height: ROW, flexDirection: 'row', gap: 4 },
  part: { flex: 1, borderRadius: 5 },
  tile: { position: 'absolute', top: 0, left: 0, right: 0 },
  reading: { height: 48, justifyContent: 'center' },
  equation: { textAlign: 'center', color: Ink.text, fontSize: 28, fontWeight: '800' },
});
