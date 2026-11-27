import { balanceTilt, BalanceScale, type PanAction } from '@/components/puzzle/BalanceScale';
import { DiagramIcon } from './kit/DiagramIcon';
import { useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { Caption, Focus } from '@/components/puzzle/kit/Focus';
import { UnknownWell, ValueChip } from '@/components/puzzle/kit/PuzzleKit';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink, LandSpring, Motion, Quantity, Shape } from '@/constants/puzzle-theme';
import type { BalancePayload } from '@/types/puzzle';
import { balanceLeftValue } from '@/utils/balance-value';
import { moderateScale } from '@/utils/scale';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';

type Props = {
  model: BalancePayload;
  choice: string | null;
  checked: boolean;
  pan?: PanAction;
  onSolutionShown?: () => void;
};

/** "7 × ?" → ['7', '×', '?']; unparsable displays fall back to one token. */
function parse(display: string) {
  const match = /^(-?\d+|\?)\s*([+−×÷-])\s*(-?\d+|\?)$/.exec(display.trim());
  return match ? { a: match[1], op: match[2] === '-' ? '−' : match[2], b: match[3] } : null;
}

const SLOT_GAP = 4;
const pop = ZoomIn.duration(Motion.tap * 2).reduceMotion(ReduceMotion.System);

export function BalanceGroups({ rows, value, dealt, right }: {
  rows: number; value: string | null; dealt?: number; right: number;
}) {
  const quantity = value === null ? 0 : Number(value);
  const [width, setWidth] = useState(0);
  // Roomy slots in reading order: 7 → 4 + 3, 6 → 3 + 3, 4 → one row of 4.
  const columns = rows <= 4 ? rows : Math.min(5, Math.ceil(rows / 2));
  // Tiles stay >= 40 pt with 4 pt gaps; the block is centred on the pan and may reach 8 pt into the pan gap.
  const slot = Math.max(28, Math.min(44, Math.floor(((width || 150) + 20 - (columns - 1) * SLOT_GAP) / columns)));
  const viewport = useProofViewport();
  const compact = dealt !== undefined && !!viewport && viewport.availableModelHeight < moderateScale(250);
  const slotHeight = Math.max(40, slot) + (compact ? 0 : 4);
  return <View style={styles.groups} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <View style={[styles.slots, { width: columns * slot + (columns - 1) * SLOT_GAP }]}>
      {Array.from({ length: rows }, (_, index) => {
        const filled = dealt !== undefined && index < dealt;
        const extra = filled && (index + 1) * quantity > right;
        return <View key={index} style={[styles.row, { width: slot, height: slotHeight }, filled ? styles.rowChecked : styles.rowUnknown, extra && styles.surplus]}>
          {filled && quantity > 0 && quantity <= 2 ? <View style={styles.toysStacked}>{Array.from({ length: quantity }, (_, i) =>
            <Animated.View key={i} entering={pop}><DiagramIcon name="toy" cutout size={quantity === 1 && !compact ? 26 : compact ? 16 : 18} /></Animated.View>)}</View>
            : <Text maxFontSizeMultiplier={1.4} style={styles.sleeveText}>{dealt !== undefined && !filled ? '?' : value ?? '?'}</Text>}
        </View>;
      })}
    </View>
  </View>;
}

export function BalanceWeight({ value }: { value: number }) {
  return <View style={styles.weight}><Text maxFontSizeMultiplier={1.4} style={styles.sleeveText}>{value}</Text></View>;
}

/**
 * Both trays carry the two sides of one equation, and every load rests on its
 * tray. Choosing a value puts it on the left tray (the tray dips and springs
 * back). After Check the chosen value is weighed: equal sides dip once and
 * settle level; unequal sides tip toward the heavier tray by an angle that
 * grows with the difference, landing with the shared spring. The comparison is
 * written only once the beam has settled.
 */
export function BalanceModel({ model, choice, checked, onSolutionShown, pan }: Props) {
  const reduce = useReducedMotion();
  const parts = parse(model.leftDisplay);
  const total = balanceLeftValue(model.leftDisplay, choice);
  const weigh = checked && total !== null;
  const direction = total === null ? 0 : Math.sign(model.rightValue - total);
  const relation = direction === 0 ? '=' : direction > 0 ? '<' : '>';
  const beats = useRevealBeats(weigh ? 2 : 0, { onDone: () => { if (weigh) onSolutionShown?.(); } });
  const { replay } = beats;
  // A new choice weighed after a rejected attempt is weighed again from level.
  const weighKey = weigh ? choice : null;
  const firstKey = useRef(weighKey);
  useEffect(() => {
    if (weighKey !== null && weighKey !== firstKey.current) replay();
    firstKey.current = weighKey;
  }, [weighKey, replay]);

  const target = total === null ? 0 : balanceTilt(total, model.rightValue);
  const tilt = useSharedValue(0);
  const starting = weigh && beats.landed === 0 && !beats.done;
  useEffect(() => {
    if (!weigh) { tilt.set(withSpring(0, LandSpring)); return; }
    if (reduce || !starting) { tilt.set(reduce ? target : withSpring(target, LandSpring)); return; }
    tilt.set(0);
    // Weighing starts after the lead: equal loads dip once and settle; unequal loads tip and land.
    tilt.set(withDelay(Motion.lead, target === 0
      ? withSequence(withTiming(-4, { duration: Motion.step / 2 }), withSpring(0, LandSpring))
      : withSpring(target, LandSpring)));
  }, [weigh, starting, target, reduce, tilt]);

  const filled = choice !== null;
  const unknown = (size: 'sm' | 'md') => filled
    ? <Animated.View key={choice} entering={pop}><UnknownWell size={size} filled active={!checked} label={choice!} /></Animated.View>
    : <UnknownWell size={size} style={styles.emptyWell} />;
  const operand = (token: string) => token === '?' ? unknown('md') : <ValueChip label={token} tone="teal" />;

  // "n × ?" asks for the size of each of n equal rows: show the n rows. The single weight needs a narrow right tray, so the
  // left tray gets the rest of the width and 44 pt rows never overhang it.
  const groups = parts && parts.op === '×' && parts.b === '?' && /^\d+$/.test(parts.a) && Number(parts.a) >= 2 && Number(parts.a) <= 10 ? Number(parts.a) : 0;
  const left = !parts ? <Text style={styles.expression}>{model.leftDisplay}</Text>
    : groups ? <BalanceGroups rows={groups} value={choice} right={model.rightValue} />
    : <View style={styles.expressionLoad}>
      {operand(parts.a)}<Text style={styles.operator}>{parts.op}</Text>{operand(parts.b)}
    </View>;

  const right = <BalanceWeight value={model.rightValue} />;
  const leftText = parts ? `${parts.a} ${parts.op} ${parts.b}` : model.leftDisplay;
  const substituted = parts ? leftText.replace('?', choice ?? '?') : model.leftDisplay;
  return <View style={styles.stage}>
    <RevealSurface beats={beats} replayable={weigh}>
      <BalanceScale wide rightWidth={groups ? 96 : undefined} tilt={tilt} leftAction={pan} accessibilityLabel={pan ? undefined : `${leftText} = ${model.rightValue}`} leftBump={choice}
        left={<Focus active={weigh && beats.landed === 1} dimmed={weigh && !beats.settled && beats.landed >= 2}>{left}</Focus>}
        right={<Focus active={weigh && beats.landed === 2} dimmed={weigh && !beats.settled && beats.landed < 2}>
          {right}</Focus>} />
    </RevealSurface>
    {/* Beat 1 weighs the left side (its value is written), beat 2 compares it with the right; the relation lands once settled. */}
    {weigh && <View style={styles.result}>
      {weigh && beats.landed >= 1 && direction !== 0 ? <Animated.View entering={FadeIn.duration(Motion.settle).reduceMotion(ReduceMotion.System)}>
        <Caption>{`${substituted} = ${total}`}</Caption>
      </Animated.View> : null}
      {weigh && beats.settled ? <Animated.View entering={FadeIn.duration(Motion.settle).reduceMotion(ReduceMotion.System)}>
        <Text testID="balance-comparison" accessibilityLiveRegion="polite" style={styles.comparison}>
          {direction === 0 ? `${substituted} = ${model.rightValue}` : `${total} ${relation} ${model.rightValue}`}
        </Text>
      </Animated.View> : null}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  stage: { gap: moderateScale(4), paddingTop: moderateScale(4) },
  expressionLoad: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: moderateScale(6), paddingBottom: moderateScale(2) },
  expression: { color: Ink.text, fontWeight: '800', fontSize: moderateScale(22), textAlign: 'center' },
  operator: { color: Ink.text, fontWeight: '800', fontSize: moderateScale(22) },
  groups: { alignSelf: 'stretch', alignItems: 'center', overflow: 'visible' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SLOT_GAP, flexShrink: 0 },
  row: { borderRadius: 12, borderBottomWidth: Shape.lip, alignItems: 'center', justifyContent: 'center' },
  toysStacked: { alignItems: 'center', gap: 0 },
  emptyWell: { backgroundColor: Shape.empty, borderBottomWidth: Shape.lip, borderBottomColor: Shape.emptyLip },
  rowUnknown: { backgroundColor: Quantity.amber.light, borderBottomWidth: 0 },
  rowChecked: { borderBottomColor: Quantity.teal.edge, backgroundColor: Quantity.teal.light },
  surplus: { borderBottomColor: Quantity.amber.edge, backgroundColor: Quantity.amber.fill },
  weight: { minWidth: 60, minHeight: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: Quantity.violet.fill },
  sleeveText: { color: Ink.text, fontWeight: '800', fontSize: 21, fontVariant: ['tabular-nums'] },
  // Two reserved lines: the left side's value, then the comparison.
  result: { minHeight: moderateScale(56), alignItems: 'center', justifyContent: 'flex-start', gap: moderateScale(2) },
  comparison: { color: Ink.text, fontWeight: '800', textAlign: 'center', fontSize: moderateScale(24), lineHeight: moderateScale(30), fontVariant: ['tabular-nums'] },
});
