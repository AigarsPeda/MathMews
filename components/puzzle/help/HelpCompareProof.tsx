import { PuzzleText as Text } from '../PuzzleText';
import { HelpProofContext } from '../kit/HelpProofContext';
import { RevealSurface } from '../kit/RevealSurface';
import { Digit, Piece, ProofLine, Slot, amber, teal, useHelpBeats, usePop, violet, type Hue } from './helpKit';
import { Ink } from '@/constants/puzzle-theme';
import type { ComparePuzzle } from '@/types/puzzle';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * Compare two numbers place by place: two numbers, each as tens and ones, in two labelled lanes.
 * The tens are compared first (equal), then the ones, then the whole numbers.
 */
export function HelpCompareProof({ puzzle, onSolutionShown }: { puzzle: ComparePuzzle; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const help = useContext(HelpProofContext);
  const beats = useHelpBeats(4, onSolutionShown, 650, 380);
  const values = [Number(puzzle.payload.optionA), Number(puzzle.payload.optionB)];
  const tens = values.map(v => Math.floor(v / 10));
  const ones = values.map(v => v % 10);
  // The sheet leaves room beyond help.height for the Pause row, so the rows can grow a little.
  const row = Math.max(64, Math.min(104, Math.floor(((help ? help.height : 300) + 40) / 3) - 8));
  const relation = values[0] === values[1] ? '=' : values[0] < values[1] ? '<' : '>';
  const tiesTens = tens[0] === tens[1];
  const lanes: { key: 'tens' | 'ones'; digits: number[]; hue: Hue; soft: string; beat: number; sign: string; winner: number }[] = [
    { key: 'tens', digits: tens, hue: teal, soft: teal.soft, beat: 1, sign: tiesTens ? '=' : tens[0] < tens[1] ? '<' : '>', winner: tiesTens ? -1 : tens[0] > tens[1] ? 0 : 1 },
    { key: 'ones', digits: ones, hue: violet, soft: violet.soft, beat: 3, sign: ones[0] === ones[1] ? '=' : ones[0] < ones[1] ? '<' : '>', winner: ones[0] === ones[1] ? -1 : ones[0] > ones[1] ? 0 : 1 },
  ];
  const final = beats.settled ? `${values[0]} ${relation} ${values[1]}` : undefined;
  return <RevealSurface beats={beats}>
    <View style={styles.model} accessible accessibilityLabel={puzzle.question}>
      <View style={styles.row}>
        <View style={{ width: 92 }} />
        <View style={[styles.whole, { height: 64 }]}><Digit size={40}>{values[0]}</Digit></View>
        <View style={styles.gap} />
        <View style={[styles.whole, { height: 64 }]}><Digit size={40}>{values[1]}</Digit></View>
      </View>
      {lanes.map(lane => <Lane key={lane.key} lane={lane} label={t(`visualHelp.examples.compare.${lane.key}`)} row={row} beats={beats}
        ties={lane.winner < 0} />)}
      <ProofLine equation={final} />
    </View>
  </RevealSurface>;
}

function Lane({ lane, label, row, beats, ties }: {
  lane: { key: string; digits: number[]; hue: Hue; soft: string; beat: number; sign: string; winner: number };
  label: string; row: number; beats: ReturnType<typeof useHelpBeats>; ties: boolean;
}) {
  const tile = usePop(beats, lane.beat);
  const sign = usePop(beats, lane.beat + 1);
  // The deciding lane turns the larger digit amber once its sign has landed.
  const won = !ties && beats.landed >= lane.beat + 1;
  return <View style={[styles.lane, { backgroundColor: lane.soft, height: row + 16 }]}>
    <Text numberOfLines={1} adjustsFontSizeToFit style={styles.label}>{label}</Text>
    <Cell side={0} lane={lane} row={row} tile={tile} won={won} />
    <Animated.View style={[styles.gap, sign]}>
      <Piece hue={ties ? { fill: teal.light, edge: teal.fill } : amber} width={44} height={44}><Digit size={32}>{lane.sign}</Digit></Piece>
    </Animated.View>
    <Cell side={1} lane={lane} row={row} tile={tile} won={won} />
  </View>;
}

function Cell({ side, lane, row, tile, won }: { side: number; lane: { digits: number[]; hue: Hue; winner: number }; row: number; tile: object; won: boolean }) {
  return <View style={styles.cell}>
    <Slot height={row} width="100%" style={StyleSheet.absoluteFill} />
    <Animated.View style={[{ width: '100%' }, tile]}>
      <Piece hue={won && lane.winner === side ? amber : lane.hue} height={row} width="100%"><Digit>{lane.digits[side]}</Digit></Piece>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  model: { alignSelf: 'stretch', gap: 8, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  lane: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderRadius: 18 },
  label: { width: 92, color: Ink.text, fontSize: 20, fontWeight: '800' },
  cell: { flex: 1, justifyContent: 'center' },
  gap: { width: 52, alignItems: 'center' },
  whole: { flex: 1, borderRadius: 18, backgroundColor: Ink.tray, alignItems: 'center', justifyContent: 'center' },
});
