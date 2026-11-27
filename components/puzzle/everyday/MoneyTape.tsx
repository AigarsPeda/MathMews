import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { layoutTape, saleTiles, MONEY_SEGMENT_GAP, type TapePlan, type TapeTone } from '@/utils/money-tape';
import { MONEY_ZONE_HEIGHT, MoneyLane } from './MoneyStage';

const clamp = (n: number) => { 'worklet'; return Math.max(0, Math.min(1, n)); };
const LIP = 3;

function Segment({ index, left, width, tone, label, at }: {
  index: number; left: number; width: number; tone: TapeTone; label: string; at: SharedValue<number>;
}) {
  const grow = useAnimatedStyle(() => ({ width: width * clamp(at.value - index), opacity: at.value > index ? 1 : 0 }));
  const text = useAnimatedStyle(() => ({ opacity: clamp((at.value - index - 0.45) / 0.4) }));
  return <Animated.View style={[styles.segment, { left, backgroundColor: Quantity[tone].edge }, grow]}>
    <View style={[styles.face, { width, backgroundColor: Quantity[tone].fill }]}>
      <Animated.View style={[styles.labelBox, text]}>
        <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.label}>{label}</Text>
      </Animated.View>
    </View>
  </Animated.View>;
}

/** The tape: one segment per beat, each label inside its segment, every segment at least 56 pt wide. */
export function TapeSegments({ plan, width, at }: { plan: TapePlan; width: number; at: SharedValue<number> }) {
  const places = layoutTape(plan, width);
  return <>{plan.segments.map((segment, i) => <Segment key={i} index={i} left={places[i].left} width={places[i].width}
    tone={segment.tone} label={segment.label} at={at} />)}</>;
}

/** The sale lane: the full price over the whole strip until the discount part lifts away, then the price that is left over the kept parts. */
export function SaleLane({ from, to, at, toWidth }: { from: string; to: string; at: SharedValue<number>; toWidth?: number }) {
  const before = useAnimatedStyle(() => ({ opacity: 1 - clamp(at.value - 1.6) }));
  const after = useAnimatedStyle(() => ({ opacity: clamp(at.value - 2) }));
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

function Tile({ index, tiles, left, width, tone, at, cut, lift }: {
  index: number; tiles: number; left: number; width: number; tone: TapeTone; at: SharedValue<number>; cut: boolean; lift: boolean;
}) {
  const motion = useAnimatedStyle(() => {
    const enter = clamp(at.value * 1.4 - index / tiles * 0.4);
    const away = cut && lift ? clamp(at.value - 1) : 0;
    return { opacity: enter * (1 - away), transform: [{ translateY: -10 * away }] };
  });
  return <Animated.View style={[styles.tile, { left, width, backgroundColor: Quantity[tone].edge }, motion]}>
    <View style={[styles.tileFace, { backgroundColor: Quantity[tone].fill }]} />
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
export function SaleStrip({ percent, width, at, miss }: {
  percent: number; width: number; at: SharedValue<number>; miss?: 'over' | 'under';
}) {
  const { tiles, cut } = saleTiles(percent);
  const kept = tiles - cut;
  const pitch = (width + MONEY_SEGMENT_GAP) / tiles;
  const tone = (i: number): TapeTone => {
    if (miss === 'over') return i === kept ? 'amber' : i < kept ? 'teal' : 'violet';
    if (miss === 'under') return i === kept - 1 ? 'amber' : i < kept ? 'teal' : 'violet';
    return i < kept ? 'teal' : 'violet';
  };
  return <>
    {Array.from({ length: tiles }, (_, i) => <Tile key={i} index={i} tiles={tiles} left={i * pitch} width={pitch - MONEY_SEGMENT_GAP}
      tone={tone(i)} at={at} cut={i >= kept} lift={!miss} />)}
  </>;
}

const styles = StyleSheet.create({
  segment: { position: 'absolute', top: 0, height: MONEY_ZONE_HEIGHT, borderRadius: 10, overflow: 'hidden' },
  face: { height: MONEY_ZONE_HEIGHT - LIP, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  labelBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, maxWidth: '100%' },
  label: { fontSize: 20, fontWeight: '800', color: Ink.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  tile: { position: 'absolute', top: 0, height: MONEY_ZONE_HEIGHT, borderRadius: 8 },
  tileFace: { height: MONEY_ZONE_HEIGHT - LIP, borderRadius: 8 },
});
