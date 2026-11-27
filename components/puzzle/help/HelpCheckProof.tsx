import { PuzzleText as Text } from '../PuzzleText';
import { HelpProofContext } from '../kit/HelpProofContext';
import { RevealSurface } from '../kit/RevealSurface';
import { Digit, Piece, Slot, amber, beatProgress, teal, useHelpBeats, useHelpCaption, usePop, violet } from './helpKit';
import { Ink, Shape } from '@/constants/puzzle-theme';
import type { TrueFalsePuzzle } from '@/types/puzzle';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

/** The claim "6 + 7 = 12": two numbers added, then a sum. Anything else gets no help-only proof. */
export function parseClaim(statement: string) {
  const m = /^\s*(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)\s*$/.exec(statement);
  return m ? { a: Number(m[1]), b: Number(m[2]), claim: Number(m[3]) } : null;
}

const SEAM = 4;
const APART = 48;
const GAP = 10;
const CHIP = 44;

/**
 * Check work by doing it yourself: the two numbers are joined on a tape of cubes, the sum is read off,
 * and the claimed answer is set against it. One model, one caption at a time, one final line.
 */
export function HelpCheckProof({ puzzle, onSolutionShown }: { puzzle: TrueFalsePuzzle; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const help = useContext(HelpProofContext);
  const [width, setWidth] = useState(0);
  const claim = parseClaim(puzzle.payload.statement);
  const beats = useHelpBeats(3, onSolutionShown, 700, landed => landed < 3 ? 1100 : 900, 1200);
  const vars = claim ? { a: claim.a, b: claim.b, sum: claim.a + claim.b, claim: claim.claim } : null;
  const stage = ['join', 'makes', 'compare', 'differ'][Math.min(beats.landed, 3)];
  const caption = beats.settled || !vars ? null : t(`visualHelp.examples.check_work.${stage}`, vars);
  const sheetCaption = useHelpCaption(caption);
  const bandPop = usePop(beats, 2);
  const claimPop = usePop(beats, 3);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: APART / 2 * beatProgress(beats.position.value, 1) }] }), [beats]);
  const slideBack = useAnimatedStyle(() => ({ transform: [{ translateX: -APART / 2 * beatProgress(beats.position.value, 1) }] }), [beats]);
  if (!vars) return null;
  const { a, b, sum } = vars;
  // Rows share the model area: the tape, the sum band and the claimed answer, with the not-equal sign between the last two.
  const row = Math.max(56, Math.min(72, Math.floor(((help ? help.height : 320) - 3 * GAP - CHIP) / 3)));
  const cubes = row;
  const unit = Math.max(8, Math.floor((width - SEAM - APART) / sum));
  const tape = sum * unit + SEAM;
  const left = Math.round((width - tape - APART) / 2);
  return <RevealSurface beats={beats}>
    <View style={styles.model} accessible accessibilityLabel={puzzle.question}>
      <View onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ height: row, justifyContent: 'center' }}>
        {width > 0 && <>
          <Animated.View style={[at(left, (row - cubes) / 2), slide]}>
            <Piece hue={teal} width={a * unit} height={cubes}><Digit size={40}>{a}</Digit></Piece>
          </Animated.View>
          <Animated.View style={[at(left + a * unit + SEAM + APART, (row - cubes) / 2), slideBack]}>
            <Piece hue={violet} width={b * unit} height={cubes}><Digit size={40}>{b}</Digit></Piece>
          </Animated.View>
        </>}
      </View>
      <View style={{ height: row, marginTop: GAP, alignItems: 'center' }}>
        {width > 0 && <>
          <Slot width={tape} height={row} />
          <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center' }, bandPop]}>
            <Piece hue={amber} width={tape} height={row}><Digit size={40}>{sum}</Digit></Piece>
          </Animated.View>
        </>}
      </View>
      <View style={{ height: CHIP, marginTop: GAP, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={claimPop}><Piece hue={{ fill: amber.light, edge: amber.fill }} width={72} height={CHIP}><Digit size={32}>≠</Digit></Piece></Animated.View>
      </View>
      <View style={{ height: row, marginTop: GAP, alignItems: 'center' }}>
        {width > 0 && <>
          <Slot width={tape} height={row} />
          <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center' }, claimPop]}>
            <Piece hue={{ fill: Shape.empty, edge: Shape.emptyLip }} width={tape} height={row}><Digit size={40}>{vars.claim}</Digit></Piece>
          </Animated.View>
        </>}
      </View>
      <View style={styles.line}>
        {sheetCaption || !caption ? null : <Text style={styles.caption}>{caption}</Text>}
        {beats.settled && <Animated.View entering={FadeIn.duration(260)}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2} style={styles.equation}>{t('visualHelp.examples.check_work.result', vars)}</Text>
        </Animated.View>}
      </View>
    </View>
  </RevealSurface>;
}

const at = (left: number, top = 0) => ({ position: 'absolute' as const, left, top });
const styles = StyleSheet.create({
  model: { alignSelf: 'stretch', paddingVertical: 4 },
  line: { alignSelf: 'stretch', minHeight: 44, marginTop: GAP, alignItems: 'center', justifyContent: 'center' },
  caption: { color: Ink.text, fontWeight: '700', fontSize: 22, lineHeight: 30, textAlign: 'center' },
  equation: { color: Ink.text, fontWeight: '800', fontSize: 32, lineHeight: 40, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
