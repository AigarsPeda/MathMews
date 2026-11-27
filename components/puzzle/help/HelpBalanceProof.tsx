import { BalanceScale } from '../BalanceScale';
import { HelpCaptionContext } from '../kit/HelpCaptionContext';
import { HelpProofContext } from '../kit/HelpProofContext';
import { RevealSurface } from '../kit/RevealSurface';
import { Digit, Piece, ProofLine, amber, beatProgress, teal, useHelpBeats } from './helpKit';
import type { RevealBeats } from '../kit/useRevealBeats';
import type { EquationBoardPuzzle } from '@/types/puzzle';
import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

const GAP = 4;
const X_WIDTH = 60;
const X_GAP = 10;
const RISE = 44;

/**
 * The same amount comes off both sides. One scale, one size, one place: the 4 units on each side lift together and
 * fade, then x stands alone beside the 5 that are left.
 */
export function HelpBalanceProof({ puzzle, onSolutionShown }: { puzzle: EquationBoardPuzzle; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const help = useContext(HelpProofContext);
  const beats = useHelpBeats(3, onSolutionShown, 850, 480);
  const { a, b, c } = puzzle.payload;
  const answer = (c - b) / a;
  // Three columns on the right, so 9 units fill three rows; the 4 that leave are the top ones (row 0 and one more).
  // The sheet leaves room beyond help.height for the Pause row. Left tray: x + two columns; right tray: three columns.
  const unit = Math.max(36, Math.min(46, Math.floor(((help ? help.height : 300) + 20 - RISE - 162 - 8) / 3)));
  const pitch = unit + GAP;
  const rightRows = Math.ceil(c / 3);
  const leftRows = Math.ceil(b / 2);
  const rightHeight = rightRows * pitch - GAP;
  const leftHeight = Math.max(leftRows * pitch - GAP, 0);
  // Units that leave the right tray are the top ones: row 0, then the end of row 1 (for 4: the first three and the sixth).
  const leavingRight = (i: number) => (i < 3 ? i < b : i === 5 && b > 3);
  const left = <View style={{ width: X_WIDTH + X_GAP + 2 * unit + GAP, height: leftHeight }}>
    <XTile height={leftHeight} beats={beats} shift={(X_GAP + 2 * unit + GAP) / 2} value={beats.landed >= 3 || beats.settled ? answer : 'x'} />
    {Array.from({ length: b }, (_, i) => <Unit key={i} beats={beats} unit={unit}
      left={X_WIDTH + X_GAP + (i % 2) * pitch} top={Math.floor(i / 2) * pitch} />)}
  </View>;
  const right = <View style={{ width: 3 * unit + 2 * GAP, height: rightHeight }}>
    {Array.from({ length: c }, (_, i) => <Unit key={i} beats={beats} unit={unit} stays={!leavingRight(i)}
      left={(i % 3) * pitch} top={Math.floor(i / 3) * pitch} />)}
  </View>;
  const caption = beats.landed >= 3 ? t('visualHelp.examples.balance.alone') : t('visualHelp.examples.balance.take', { n: b });
  // One line of text at a time: the sheet's rule line carries the beat caption while it plays and returns when it settles.
  const setCaption = useContext(HelpCaptionContext);
  const shown = beats.settled ? null : caption;
  useEffect(() => { setCaption?.(shown); }, [setCaption, shown]);
  useEffect(() => () => setCaption?.(null), [setCaption]);
  return <RevealSurface beats={beats}>
    <View style={styles.model} accessible accessibilityLabel={puzzle.question}>
      <View style={{ height: RISE }} />
      <BalanceScale wide gap={8} loadHeight={rightHeight + 4} left={left} right={right} />
      <ProofLine caption={setCaption || beats.settled ? undefined : caption} equation={beats.settled ? `x = ${answer}` : undefined} />
    </View>
  </RevealSurface>;
}

/** A unit tile. The ones that leave lift together (beat 1), then rise and fade (beat 2). */
function Unit({ beats, unit, left, top, stays = false }: { beats: RevealBeats; unit: number; left: number; top: number; stays?: boolean }) {
  const motion = useAnimatedStyle(() => {
    if (stays) return {};
    const p = beats.position.value;
    return {
      // The units stay solid while they lift and leave in one quick pop, so no half-faded tile hangs about.
      opacity: interpolate(p, [1, 1.85, 2], [1, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(p, [0, 1, 2], [0, -14, -RISE], Extrapolation.CLAMP) }, { scale: interpolate(p, [0, 1, 2], [1, 1.06, 0.8], Extrapolation.CLAMP) }],
    };
  }, [beats, stays]);
  return <Animated.View style={[{ position: 'absolute', left, top }, motion]}>
    <Piece hue={amber} width={unit} height={unit}><Digit size={26}>1</Digit></Piece>
  </Animated.View>;
}

/** x keeps its tile; it slides to the middle of its tray when its units have gone, and shows its value last. */
function XTile({ height, beats, shift, value }: { height: number; beats: RevealBeats; shift: number; value: number | string }) {
  const motion = useAnimatedStyle(() => {
    const p = beats.position.value;
    const land = beatProgress(p, 3);
    return { transform: [{ translateX: interpolate(p, [1.6, 2.2], [0, shift], Extrapolation.CLAMP) }, { scale: 1 + 0.08 * Math.sin(land * Math.PI) }] };
  }, [beats, shift]);
  return <Animated.View style={[{ position: 'absolute', left: 0, bottom: 0 }, motion]}>
    <Piece hue={teal} width={X_WIDTH} height={height}><Digit size={36}>{value}</Digit></Piece>
  </Animated.View>;
}

const styles = StyleSheet.create({
  model: { alignSelf: 'stretch', paddingVertical: 4 },
});
