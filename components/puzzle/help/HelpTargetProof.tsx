import { HelpProofContext } from '../kit/HelpProofContext';
import { RevealSurface } from '../kit/RevealSurface';
import type { RevealBeats } from '../kit/useRevealBeats';
import { Digit, Piece, ProofLine, Slot, amber, beatProgress, teal, useHelpBeats, violet, type Hue } from './helpKit';
import { Motion } from '@/constants/puzzle-theme';
import type { PairSumPuzzle } from '@/types/puzzle';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

const TOTAL = 56;
const GAP = 8;
const LANE = 36;
const SEAM = 4;

/**
 * Make a target from two tiles: pick one, work out what is missing, find that tile, put it in.
 * The goal is a band; its two parts are the picked tile and the missing one, drawn to scale.
 */
export function HelpTargetProof({ puzzle, onSolutionShown }: { puzzle: PairSumPuzzle; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const help = useContext(HelpProofContext);
  const beats = useHelpBeats(4, onSolutionShown, 600, 380);
  const [width, setWidth] = useState(0);
  const { numbers, target, correctIndices: [ia, ib] } = puzzle.payload;
  const a = numbers[ia], b = numbers[ib];
  const h = Math.max(56, Math.min(72, Math.floor(((help ? help.height : 300) - 44 - TOTAL - GAP - LANE) / 2)));
  const yBar = TOTAL + GAP, yTiles = yBar + h + LANE;
  const tile = (width - 2 * GAP) / numbers.length;
  const wa = Math.round((width - SEAM) * a / target), wb = width - SEAM - wa;
  const x = (i: number) => i * (tile + GAP);
  const caption = t(`visualHelp.examples.target.${['pick', 'missing', 'find', 'place'][Math.min(beats.landed, 3)]}`, { a, b, target });
  const hole = useAnimatedStyle(() => ({ opacity: beatProgress(beats.position.value, 2) }), [beats]);
  const others = useAnimatedStyle(() => ({ opacity: interpolate(beatProgress(beats.position.value, 3), [0, 1], [1, Motion.dimOpacity]) }), [beats]);
  // Once the 5 is in, the tile row has done its job: it fades, and the band with its two parts glides down into the freed room.
  const row = useAnimatedStyle(() => ({ opacity: interpolate(beatProgress(beats.position.value, 4), [0.2, 0.8], [1, 0], Extrapolation.CLAMP) }), [beats]);
  const glide = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(beatProgress(beats.position.value, 4), [0.6, 1], [0, (h + LANE) / 2], Extrapolation.CLAMP) }] }), [beats, h]);
  return <RevealSurface beats={beats}>
    <View style={styles.model} accessible accessibilityLabel={puzzle.question}>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: yTiles + h }}>
        {width > 0 && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, row]}>
          {numbers.map((n, i) => <Slot key={i} width={tile} height={h} style={[styles.at(yTiles), { left: x(i) }]} />)}
          {numbers.map((n, i) => i !== ia && i !== ib && <Animated.View key={i} style={[styles.at(yTiles), { left: x(i), width: tile }, others]}>
            <Piece hue={teal} width={tile} height={h}><Digit>{n}</Digit></Piece></Animated.View>)}
        </Animated.View>}
        <Animated.View style={[StyleSheet.absoluteFill, glide]}>
          <Piece hue={amber} width="100%" height={TOTAL} style={styles.at(0)}><Digit>{target}</Digit></Piece>
          {width > 0 && <>
            <Slot width={wa} height={h} style={styles.at(yBar)} />
            <Slot width={wb} height={h} style={[styles.at(yBar), { left: wa + SEAM }]} />
            <Animated.View style={[styles.at(yBar), { left: wa + SEAM, width: wb }, hole]}>
              <Piece hue={{ fill: amber.soft, edge: amber.light }} width={wb} height={h}><Digit>?</Digit></Piece>
            </Animated.View>
            <Mover beats={beats} beat={1} n={a} hue={violet} from={x(ia)} fromWidth={tile} to={0} toWidth={wa} dy={yBar - yTiles} top={yTiles} height={h} />
            <Mover beats={beats} beat={4} n={b} hue={amber} from={x(ib)} fromWidth={tile} to={wa + SEAM} toWidth={wb} dy={yBar - yTiles} top={yTiles} height={h} pulseBeat={3} />
          </>}
        </Animated.View>
      </View>
      <ProofLine caption={beats.settled ? undefined : caption} equation={beats.settled ? `${a} + ${b} = ${target}` : undefined} />
    </View>
  </RevealSurface>;
}

/** A tile that travels up into its part of the band and widens to fill it. */
function Mover({ beats, beat, n, hue, from, fromWidth, to, toWidth, dy, top, height, pulseBeat }: {
  beats: RevealBeats; beat: number; n: number; hue: Hue; from: number; fromWidth: number; to: number; toWidth: number; dy: number; top: number; height: number;
  /** The beat in which this tile is found: it grows a little and settles back. */
  pulseBeat?: number;
}) {
  const move = useAnimatedStyle(() => {
    const p = beatProgress(beats.position.value, beat);
    const found = pulseBeat ? Math.sin(beatProgress(beats.position.value, pulseBeat) * Math.PI) : 0;
    return { width: fromWidth + (toWidth - fromWidth) * p, transform: [{ translateX: (to - from) * p }, { translateY: dy * p }, { scale: 1 + 0.12 * found }] };
  }, [beats, beat, from, fromWidth, to, toWidth, dy, pulseBeat]);
  // A tile takes its part's colour as it leaves the row, so it never shows a blend of the two on its way in.
  const tint = useAnimatedStyle(() => ({ opacity: beatProgress(beats.position.value, beat) > 0.02 ? 1 : 0 }), [beats, beat]);
  return <Animated.View style={[styles.at(top), { left: from, zIndex: 2 }, move]}>
    <Piece hue={teal} width="100%" height={height}><Digit>{n}</Digit></Piece>
    <Animated.View style={[StyleSheet.absoluteFill, tint]}><Piece hue={hue} width="100%" height={height}><Digit>{n}</Digit></Piece></Animated.View>
  </Animated.View>;
}

const styles = {
  model: { alignSelf: 'stretch', gap: 8, paddingVertical: 8 } as const,
  at: (top: number) => ({ position: 'absolute', top } as const),
};
