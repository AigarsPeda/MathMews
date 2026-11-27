import { PuzzleText as Text } from './PuzzleText';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import type { PatternNextPuzzle } from '@/types/puzzle';
import { patternPlan, stepLabel } from '@/utils/operations-reveal';
import { StyleSheet, View } from 'react-native';

const { teal, amber, violet } = Quantity;

export function HelpTileProof({ puzzle, onSolutionShown }: { puzzle: PatternNextPuzzle; onSolutionShown: () => void }) {
  const count = puzzle.payload.sequence.length;
  const beats = useRevealBeats(count, { step: 740, lead: 160, hold: 100, minTotal: 0, reducedSteps: true, onDone: onSolutionShown });
  let model;
  let equation;
  if (puzzle.type === 'pattern_next') {
    const plan = patternPlan(puzzle, puzzle.correctIndex);
    const values = [...plan.sequence, plan.next];
    model = <>
      <View style={styles.hops}>{values.slice(1).map((v, i) =>
        <Text key={i} style={[styles.hop, { opacity: beats.landed >= i ? 1 : 0 }]}>{stepLabel(values[i], v, plan.rule)} ›</Text>)}</View>
      <View style={styles.row}>{values.map((v, i) => <View key={i} style={[styles.tile, { aspectRatio: 0.86, backgroundColor: i === count ? amber.fill : teal.fill }]}>
        <Text style={styles.number}>{i === count && !beats.done ? '?' : v}</Text></View>)}</View>
    </>;
    equation = plan.final;
  }
  return <RevealSurface beats={beats}><View style={styles.model}>{model}
    <Text style={[styles.equation, { opacity: beats.done ? 1 : 0 }]}>{equation}</Text>
  </View></RevealSurface>;
}

const styles = StyleSheet.create({
  model: { alignSelf: 'stretch', gap: 8, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minHeight: 68, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  number: { color: Ink.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hops: { flexDirection: 'row', marginHorizontal: '12.5%', gap: 4 },
  hop: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '800', color: Ink.text, backgroundColor: violet.fill, borderRadius: 12, overflow: 'hidden' },
  equation: { textAlign: 'center', color: Ink.text, fontWeight: '800', fontSize: 28 },
});
