import { useContext } from 'react';
import { HelpProofContext } from '../kit/HelpProofContext';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { layoutTape, saleTiles, MONEY_SEGMENT_GAP, type TapePlan, type TapeTone } from '@/utils/money-tape';
import { HELP_ZONE_HEIGHT, MONEY_ZONE_HEIGHT, MoneyLane } from './MoneyStage';
import { MoneyCoin } from '../MoneyCoin';

const clamp = (n: number) => { 'worklet'; return Math.max(0, Math.min(1, n)); };
const LIP = 3;

function Segment({ index, left, width, tone, label, value, at }: {
  index: number; left: number; width: number; tone: TapeTone; label: string; value: number; at: SharedValue<number>;
}) {
  const help = useContext(HelpProofContext);
  const hue = help && index === 1 ? Quantity.violet : Quantity[tone];
  const grow = useAnimatedStyle(() => ({ width: width * clamp(at.value - index), opacity: at.value > index ? 1 : 0 }));
  const text = useAnimatedStyle(() => ({ opacity: clamp((at.value - index - 0.45) / 0.4) }));
  // Help: the coin is the segment's label. It drops onto the segment as the segment finishes growing.
  const drop = useAnimatedStyle(() => {
    const p = clamp((at.value - index - 0.3) / 0.7);
    return { opacity: Math.min(1, p * 3), transform: [{ translateY: -28 * (1 - p) }] };
  });
  const zone = help ? HELP_ZONE_HEIGHT : MONEY_ZONE_HEIGHT;
  return <>
    <Animated.View style={[styles.segment, { left, height: zone, backgroundColor: hue.edge }, grow]}>
      <View style={[styles.face, { width, height: zone - LIP, backgroundColor: hue.fill }]}>
        {!help && <Animated.View style={[styles.labelBox, text]}>
          <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.label}>{label}</Text>
        </Animated.View>}
      </View>
    </Animated.View>
    {help && <Animated.View pointerEvents="none" style={[styles.coinSlot, { left, width, height: zone - LIP }, drop]}>
      <MoneyCoin value={value} label={label} />
    </Animated.View>}
  </>;
}

/** The tape: one segment per beat, each label inside its segment, every segment at least 56 pt wide. */
export function TapeSegments({ plan, width, at }: { plan: TapePlan; width: number; at: SharedValue<number> }) {
  const places = layoutTape(plan, width);
  return <>{plan.segments.map((segment, i) => <Segment key={i} index={i} left={places[i].left} width={places[i].width}
    tone={segment.tone} label={segment.label} value={segment.value} at={at} />)}</>;
}

/** The sale lane: the full price over the whole strip until the discount part lifts away, then the price that is left over the kept parts. */
export function SaleLane({ from, to, at, toWidth }: { from: string; to: string; at: SharedValue<number>; toWidth?: number }) {
  const help = useContext(HelpProofContext);
  // Picture help: the full price clears while the removed part lifts, and the sale band lands over the kept parts.
  const before = useAnimatedStyle(() => ({ opacity: help ? 1 - clamp((at.value - 1) * 2.5) : 1 - clamp(at.value - 1.6) }));
  const after = useAnimatedStyle(() => ({ opacity: help ? clamp((at.value - 1.6) * 2.5) : clamp(at.value - 2) }));
  return <View>
    <Animated.View style={before}><MoneyLane label={from} /></Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, after]}><MoneyLane label={to} width={toWidth} /></Animated.View>
  </View>;
}

/** The label lane above the tape's right end appears with the last segment. */
export function TapeLane({ label, tone, at, beats }: { label: string; tone?: 'teal' | 'amber'; at: SharedValue<number>; beats: number }) {
  const fade = useAnimatedStyle(() => ({ opacity: clamp(at.value - beats + 1) }));
  return <Animated.View style={fade}><MoneyLane label={label} tone={tone} /></Animated.View>;
}

function Tile({ index, tiles, left, width, tone, at, cut, lift, label }: {
  label?: string;
  index: number; tiles: number; left: number; width: number; tone: TapeTone; at: SharedValue<number>; cut: boolean; lift: boolean;
}) {
  // Picture help keeps the removed part on the tape: it turns into one amber "−" part, set apart above the row.
  const keep = !!label && cut && lift;
  const motion = useAnimatedStyle(() => {
    const enter = clamp(at.value * 1.4 - index / tiles * 0.4);
    const away = cut && lift ? clamp(at.value - 1) : 0;
    return keep ? { opacity: enter, transform: [{ translateY: -8 * away }] }
      : { opacity: enter * (1 - away), transform: [{ translateY: -10 * away }] };
  });
  const before = useAnimatedStyle(() => ({ opacity: 1 - clamp((at.value - 1) * 3) }));
  const after = useAnimatedStyle(() => ({ opacity: clamp((at.value - 1) * 3) }));
  return <Animated.View style={[styles.tile, { left, width, height: label ? HELP_ZONE_HEIGHT : MONEY_ZONE_HEIGHT, backgroundColor: Quantity[tone].edge }, motion]}>
    <View style={[styles.tileFace, { backgroundColor: Quantity[tone].fill }, !!label && styles.helpTile]}>
      {label && !keep && <Text style={[styles.label, { fontSize: 28 }]}>{label}</Text>}
      {keep && <>
        <Animated.Text numberOfLines={1} style={[styles.label, styles.swap, { fontSize: 28 }, before]}>{label}</Animated.Text>
        <Animated.Text numberOfLines={1} style={[styles.label, styles.swap, { fontSize: 28 }, after]}>{'−' + label}</Animated.Text>
      </>}
    </View>
  </Animated.View>;
}

/** Width of the kept parts of the sale strip, so the sale-price band measures exactly them. */
export function keptWidth(percent: number, width: number) {
  const { tiles, cut } = saleTiles(percent);
  return (tiles - cut) * (width + MONEY_SEGMENT_GAP) / tiles - MONEY_SEGMENT_GAP;
}

/**
 * The approved ten-part strip, exactly one width wide. Correct: the discount part lifts away and the lane label changes
 * from the full price to the sale price. Miss: nothing lifts; ONE amber part marks the over- or under-part, and the lane keeps the sale-price band over the kept parts.
 */
export function SaleStrip({ percent, width, at, miss, tileLabel }: {
  tileLabel?: string;
  percent: number; width: number; at: SharedValue<number>; miss?: 'over' | 'under';
}) {
  const { tiles, cut } = saleTiles(percent);
  const help = useContext(HelpProofContext);
  const kept = tiles - cut;
  const pitch = (width + MONEY_SEGMENT_GAP) / tiles;
  const tone = (i: number): TapeTone => {
    if (help && tileLabel && !miss) return i < kept ? 'teal' : 'amber';
    if (miss === 'over') return i === kept ? 'amber' : i < kept ? 'teal' : 'violet';
    if (miss === 'under') return i === kept - 1 ? 'amber' : i < kept ? 'teal' : 'violet';
    return i < kept ? 'teal' : 'violet';
  };
  return <>
    {Array.from({ length: tiles }, (_, i) => <Tile key={i} index={i} tiles={tiles} left={i * pitch} width={pitch - MONEY_SEGMENT_GAP}
      tone={tone(i)} at={at} label={tileLabel} cut={i >= kept} lift={!miss} />)}
  </>;
}

const styles = StyleSheet.create({
  segment: { position: 'absolute', top: 0, height: MONEY_ZONE_HEIGHT, borderRadius: 10, overflow: 'hidden' },
  coinSlot: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center' },
  face: { height: MONEY_ZONE_HEIGHT - LIP, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  labelBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, maxWidth: '100%' },
  label: { fontSize: 20, fontWeight: '800', color: Ink.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  tile: { position: 'absolute', top: 0, height: MONEY_ZONE_HEIGHT, borderRadius: 8 },
  swap: { position: 'absolute', alignSelf: 'center' },
  helpTile: { height: HELP_ZONE_HEIGHT - LIP, justifyContent: 'center', alignItems: 'center' },
  tileFace: { height: MONEY_ZONE_HEIGHT - LIP, borderRadius: 8 },
});
