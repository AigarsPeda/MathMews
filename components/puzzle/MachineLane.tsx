import { PuzzleText } from './PuzzleText';
import type { RevealBeats } from './kit/useRevealBeats';
import { HelpProofContext } from './kit/HelpProofContext';
import { Land } from './tiles/TileMotion';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import type { MachinePlan } from '@/utils/operations-reveal';
import { useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

type Props = {
  input: number; output: number; socket: ReactNode;
  proof?: { beats: RevealBeats; plan: MachinePlan };
};

export function MachineLane({ input, output, socket, proof }: Props) {
  const [width, setWidth] = useState(0);
  // Picture help draws the lane bigger: tiles with 34 pt digits, a taller track.
  const help = useContext(HelpProofContext);
  const S = help ? 1.6 : 1;
  const maxTile = Math.round(54 * S), pieceHeight = Math.round(48 * S);
  const big = help ? { fontSize: 34, lineHeight: 42 } : null;
  const forming = Math.max(0, Math.floor(((proof?.beats.landed ?? 0) - 1) / 2));
  const operation = proof?.plan.ops[Math.min(forming, proof.plan.ops.length - 1)];
  const finished = !!proof?.beats.settled;
  const count = !finished && operation?.op === '×' && operation.n <= 8 ? operation.n : 1;
  const tracks = proof?.beats.position;
  const tile = Math.min(maxTile, Math.max(28, (width - 8 - (count - 1) * 4) / count));
  const travel = Math.max(0, width - tile);
  const stages = proof?.plan.ops.length ?? 1;
  const destination = proof && !proof.plan.ok ? Math.max(0, travel - tile - 14) : travel;
  const growing = useAnimatedStyle(() => {
    if (finished) return { width: tile, transform: [{ translateX: destination }] };
    const p = tracks?.value ?? 0;
    const open = Math.max(0, Math.min(1, p - (1 + forming * 2)));
    const close = Math.max(0, Math.min(1, p - (2 + forming * 2)));
    const x = destination * (forming + close) / stages;
    const expansion = (count - 1) * (tile + 4) * open * (1 - close);
    return { width: tile + Math.min(expansion, Math.max(0, travel - x)), transform: [{ translateX: x }] };
  }, [tracks, count, forming, tile, travel, stages, destination, finished]);
  const landed = proof?.beats.landed ?? 0;
  const amount = finished ? proof.plan.result : operation && landed >= 3 + forming * 2 ? operation.to : operation?.from ?? input;
  // A correct settle keeps the inputs, the rule and the output on screen together: the input tiles return at the left.
  // A miss keeps the very same lane: the child's rule applied to the same input tiles, its output beside the target.
  const settledRight = finished;
  const missed = finished && !proof?.plan.ok;
  const firstOp = proof?.plan.ops[0];
  const inputCount = firstOp?.op === '×' && firstOp.n <= 8 ? firstOp.n : 1;
  const inputTile = Math.min(maxTile, Math.max(28, (width - maxTile * 2 - 4 - 16 - (inputCount - 1) * 4) / inputCount));
  return <View style={[styles.machine, help && { gap: 10, paddingVertical: 14 }]}>
    <View style={[styles.rule, help && { minHeight: 64 }]}>{socket}</View>
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={[styles.track, help && { height: Math.round(60 * S) }]}>
      <View style={[styles.goal, help && { minWidth: maxTile, minHeight: pieceHeight }]}><PuzzleText maxFontSizeMultiplier={1.4} style={[styles.number, big]}>{output}</PuzzleText></View>
      {missed && <View style={styles.output}>
        <PuzzleText maxFontSizeMultiplier={1.4} adjustsFontSizeToFit numberOfLines={1} style={[styles.number, big]}>{proof?.plan.result}</PuzzleText>
      </View>}
      {settledRight && width > 0 && <Land style={styles.runner}>
        {Array.from({ length: inputCount }, (_, i) => <View key={i} style={[styles.piece, { width: inputTile, height: pieceHeight }]}>
          <PuzzleText maxFontSizeMultiplier={1.4} adjustsFontSizeToFit numberOfLines={1} style={[styles.number, big]}>{input}</PuzzleText>
        </View>)}
      </Land>}
      {!settledRight && <Animated.View style={[styles.runner, { width: tile }, growing]}>
        {Array.from({ length: count }, (_, i) => <View key={i} style={[styles.piece, { width: tile, height: pieceHeight }, i % 2 === 1 && !finished && styles.alternate, finished && proof?.plan.ok && styles.merged]}>
          <PuzzleText maxFontSizeMultiplier={1.4} adjustsFontSizeToFit numberOfLines={1} style={[styles.number, big]}>{amount}</PuzzleText>
        </View>)}
      </Animated.View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  machine: { alignSelf: 'stretch', gap: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 18, backgroundColor: Ink.tray },
  rule: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  track: { height: 60, justifyContent: 'center' },
  runner: { position: 'absolute', left: 0, top: 6, flexDirection: 'row', gap: 4, overflow: 'hidden' },
  piece: { height: 48, borderRadius: 12, backgroundColor: Quantity.teal.fill, borderBottomWidth: Shape.lip, borderColor: Quantity.teal.edge, alignItems: 'center', justifyContent: 'center' },
  alternate: { backgroundColor: Quantity.violet.fill, borderColor: Quantity.violet.edge },
  merged: { backgroundColor: Quantity.amber.fill, borderColor: Quantity.amber.edge },
  output: { position: 'absolute', right: 58, top: 6, width: 54, height: 48, borderRadius: 12, backgroundColor: Quantity.amber.fill, borderBottomWidth: Shape.lip, borderColor: Quantity.amber.edge, alignItems: 'center', justifyContent: 'center' },
  goal: { alignSelf: 'flex-end', minWidth: 54, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Quantity.amber.fill },
  number: { color: Ink.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
});
