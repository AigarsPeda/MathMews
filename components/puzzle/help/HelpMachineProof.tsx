import { PuzzleText as Text } from '../PuzzleText';
import { HelpProofContext } from '../kit/HelpProofContext';
import { RevealSurface } from '../kit/RevealSurface';
import { Digit, Piece, ProofLine, Slot, amber, beatProgress, teal, useHelpBeats, violet } from './helpKit';
import { Ink } from '@/constants/puzzle-theme';
import type { FunctionMachinePuzzle } from '@/types/puzzle';
import { machinePlan } from '@/utils/operations-reveal';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

const PAD = 12;
const RULE = 92;
const ARROW = 20;
const SEAT = 4;

/**
 * A rule machine in one row: the input goes in, the rule acts and the output comes out.
 * The rule ×2 makes two 5s, which come out of the rule and join as 10. Nothing overlaps: the new 5s are drawn behind the rule as they leave it.
 */
export function HelpMachineProof({ puzzle, onSolutionShown }: { puzzle: FunctionMachinePuzzle; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const help = useContext(HelpProofContext);
  const beats = useHelpBeats(3, onSolutionShown, 700, 420);
  const plan = machinePlan(puzzle, puzzle.correctIndex);
  const [width, setWidth] = useState(0);
  const { input } = puzzle.payload;
  const op = plan?.ops[0];
  const height = Math.max(92, Math.min(132, Math.round(((help ? help.height : 300) + 40) * 0.4)));
  // The input, the rule and the two new 5s share one piece width, so the row reads evenly.
  const tile = Math.max(56, (width - 2 * PAD - RULE - 2 * ARROW - SEAT) / 3);
  const IN = tile;
  const out = 2 * tile + SEAT;
  // Both new 5s leave from behind the rule: the first goes to the right seat, the second to the left seat, so they never cross.
  const start = -(ARROW + RULE / 2) - tile / 2;
  const first = usePath(beats, 1, start - (tile + SEAT), 0);
  const second = usePath(beats, 2, start, 0);
  const nudge = useAnimatedStyle(() => ({ transform: [{ translateX: 14 * Math.sin(beatProgress(beats.position.value, 1) * Math.PI) }] }), [beats]);
  const wake = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.1 * (Math.sin(beatProgress(beats.position.value, 1) * Math.PI) + Math.sin(beatProgress(beats.position.value, 2) * Math.PI)) }] }), [beats]);
  // The two 5s fade out first, then the 10 lands, so no digits overlap.
  const join = useAnimatedStyle(() => ({ opacity: interpolate(beats.position.value, [2, 2.4], [1, 0], Extrapolation.CLAMP) }), [beats]);
  const result = useAnimatedStyle(() => {
    const p = interpolate(beats.position.value, [2.35, 3], [0, 1], Extrapolation.CLAMP);
    return { opacity: Math.min(1, p * 3), transform: [{ scale: 0.85 + 0.15 * p }] };
  }, [beats]);
  if (!plan || !op) return null;
  const rule = plan.rule.replace(/-/g, '−');
  return <RevealSurface beats={beats}>
    <View style={styles.model} accessible accessibilityLabel={puzzle.question}>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.card}>
        <View style={styles.row}>
          <Animated.View style={[styles.col, { width: IN }, nudge]}><Piece hue={teal} width={IN} height={height}><Digit size={40}>{input}</Digit></Piece></Animated.View>
          <Text style={styles.arrow}>›</Text>
          <Animated.View style={[styles.col, styles.top, { width: RULE }, wake]}><Piece hue={violet} width={RULE} height={height}><Digit size={40}>{rule}</Digit></Piece></Animated.View>
          <Text style={styles.arrow}>›</Text>
          <View style={[styles.col, { width: out, height }]}>
            <Slot width={out} height={height} style={StyleSheet.absoluteFill} />
            <Animated.View style={[styles.tile, { left: 0, width: tile }, second, join]}><Piece hue={violet} width={tile} height={height}><Digit size={36}>{input}</Digit></Piece></Animated.View>
            <Animated.View style={[styles.tile, { left: tile + SEAT, width: tile }, first, join]}><Piece hue={teal} width={tile} height={height}><Digit size={36}>{input}</Digit></Piece></Animated.View>
            <Animated.View style={[styles.tile, { left: 0, width: out }, result]}><Piece hue={amber} width={out} height={height}><Digit size={44}>{plan.result}</Digit></Piece></Animated.View>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={[styles.name, { width: IN }]}>{t('visualHelp.examples.machine.inName')}</Text>
          <View style={{ width: ARROW }} />
          <Text style={[styles.name, { width: RULE }]}>{t('visualHelp.examples.machine.ruleName')}</Text>
          <View style={{ width: ARROW }} />
          <Text style={[styles.name, { width: out }]}>{t('visualHelp.examples.machine.outName')}</Text>
        </View>
      </View>
      <ProofLine equation={beats.settled ? plan.final : undefined} />
    </View>
  </RevealSurface>;
}

/** A piece leaves from behind the rule into its seat while beat `k` plays. */
function usePath(beats: ReturnType<typeof useHelpBeats>, k: number, from: number, to: number) {
  return useAnimatedStyle(() => {
    const p = beatProgress(beats.position.value, k);
    return { opacity: p > 0 ? 1 : 0, transform: [{ translateX: from + (to - from) * p }] };
  }, [beats, k, from, to]);
}

const styles = StyleSheet.create({
  model: { alignSelf: 'stretch', gap: 10, paddingVertical: 8 },
  card: { alignSelf: 'stretch', padding: PAD, paddingVertical: 20, gap: 10, borderRadius: 18, backgroundColor: Ink.tray },
  row: { flexDirection: 'row', alignItems: 'center' },
  col: { zIndex: 1 },
  top: { zIndex: 3 },
  tile: { position: 'absolute', top: 0, zIndex: 2 },
  arrow: { width: ARROW, textAlign: 'center', color: Ink.soft, fontSize: 36, fontWeight: '800', lineHeight: 42 },
  name: { textAlign: 'center', color: Ink.soft, fontSize: 22, lineHeight: 28, fontWeight: '700' },
});
