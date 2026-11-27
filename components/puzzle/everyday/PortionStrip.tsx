import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { DenseLabel } from '../kit/DenseLayout';
import { Quantity, Shape } from '@/constants/puzzle-theme';
import type { CapacityInput, CapacityModel } from '@/utils/puzzle-capacity';
import { DropTargetOutline, IdleHint, MovablePiece } from '../kit/PracticeAffordances';
import { landTick } from '../kit/proofHaptics';
import { PaintedModel } from './PaintedModel';
import type { RevealBeats } from '../kit/useRevealBeats';

const water = Quantity.teal;
const tankHeight = 88;
const rowHeight = tankHeight + 12;
type VesselKind = NonNullable<CapacityModel['portionContainer']>;
let demonstrated = false;

function Portion({ i, fraction, width, progress, vessel, pulse }: {
  i: number; fraction: number; width: number; progress: SharedValue<number>; vessel: VesselKind; pulse: SharedValue<number>;
}) {
  const bottle = vessel === 'bottle';
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: fraction > 0 && fraction < 1 ? pulse.value : 1 }] }));
  const shape = useAnimatedStyle(() => {
    const cut = Math.max(0, Math.min(1, progress.value - i));
    return { width: width - cut * 4, left: cut * 2, borderRadius: cut * 10, borderBottomLeftRadius: cut * (vessel === 'bowl' ? width / 2 : 10), borderBottomRightRadius: cut * (vessel === 'bowl' ? width / 2 : 10),
      backgroundColor: fraction === 1 ? water.fill : cut > 0 ? Shape.empty : water.soft };
  });
  const liquid = useAnimatedStyle(() => {
    const cut = Math.max(0, Math.min(1, progress.value - i));
    const breadth = fraction + (1 - fraction) * cut;
    return { width: (width - cut * 4) * breadth, height: breadth ? tankHeight * fraction / breadth : 0 };
  });
  const taper = useAnimatedStyle(() => ({ transform: [{ perspective: 210 }, { rotateX: `${bottle ? 0 : -30 * Math.max(0, Math.min(1, progress.value - i))}deg` }] }));
  const neck = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, progress.value - i)) }));
  return <Animated.View testID={`jug-tick-portion-${i}`} style={[{ width, height: rowHeight }, motion]}>
    <Animated.View style={[styles.cell, { width }, fraction === 1 && styles.full, shape, taper]}>
      {fraction > 0 && fraction < 1 && <Animated.View style={[styles.water, liquid]} />}
    </Animated.View>
    <Animated.View style={[bottle ? styles.neck : styles.cupLip, neck]} />
  </Animated.View>;
}

/** One length of water, partitioned in place by the child's proposed number of vessels. */
export function PortionStrip({ amount, unit, count, progress, available, vessel, input, label, unitLabel, beats, ready, landed }: {
  amount: number; unit: number; count: number; progress: SharedValue<number>; available: number; vessel: VesselKind;
  input?: CapacityInput; label: string; unitLabel: string; beats?: RevealBeats; ready: boolean; landed: boolean;
}) {
  const bottle = vessel === 'bottle';
  const [touched, setTouched] = useState(false);
  const [first] = useState(() => !demonstrated);
  const reduced = useReducedMotion();
  const demo = useSharedValue(0);
  const pulse = useSharedValue(1);
  const idle = first && !!input && !touched && input.selectedIndex == null;
  useEffect(() => {
    if (!idle || reduced) return;
    const timer = setTimeout(() => {
      demonstrated = true;
      demo.value = withSequence(withTiming(1, { duration: 520 }), withDelay(240, withTiming(0, { duration: 260 })));
    }, 4000);
    return () => { clearTimeout(timer); cancelAnimation(demo); demo.value = 0; };
  }, [idle, demo, reduced]);
  useEffect(() => {
    pulse.value = landed && bottle && !reduced ? withSequence(withTiming(1.1, { duration: 150 }), withTiming(1, { duration: 190 })) : 1;
    return () => cancelAnimation(pulse);
  }, [landed, bottle, reduced, pulse]);
  const [drag, setDrag] = useState<number | null>(null);
  const lastDrag = useRef<number | null>(null);
  const cuts = useDerivedValue(() => drag ?? Math.max(progress.value, demo.value));
  const tankLip = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - cuts.value) }));
  const choices = input?.choices.map((choice, index) => ({ count: Number(choice), index })) ?? [];
  const selected = input?.selectedIndex == null ? 0 : choices[input.selectedIndex].count;
  const total = Math.max(1, count, ...choices.map(choice => choice.count));
  const columns = Math.min(total, Math.max(1, Math.floor(available / 26)));
  const width = Math.min(52, available / columns);
  const modelWidth = columns * width;
  const rows = Math.ceil(total / columns);
  const choose = (index: number) => {
    demonstrated = true;
    setTouched(true);
    if (input && input.selectedIndex !== index) { input.onSelect(index); landTick(); }
  };
  const previewAt = (event: GestureResponderEvent) => {
    if (!choices.length) return;
    const { locationX, locationY } = event.nativeEvent;
    const row = Math.max(0, Math.min(rows - 1, Math.floor(locationY / rowHeight)));
    const at = row * columns + Math.max(0, Math.min(columns, locationX / width));
    const next = Math.min(total, Math.max(0, Math.round(at)));
    demonstrated = true;
    setTouched(true);
    if (lastDrag.current !== next) { lastDrag.current = next; setDrag(next); }
  };
  const submitDrag = () => {
    const at = lastDrag.current;
    if (at !== null && choices.length) choose(choices.reduce((best, option) => Math.abs(option.count - at) < Math.abs(best.count - at) ? option : best).index);
    lastDrag.current = null;
    setDrag(null);
  };
  const gripIndex = Math.max(0, (drag ?? selected) - 1);
  const x = Math.max(24, Math.min(modelWidth - 24, (gripIndex % columns + .5) * width));
  const y = Math.floor(gripIndex / columns) * rowHeight + rowHeight / 2;
  const atStart = drag === null && selected === 0;
  const gripY = atStart ? 24 : y;
  const targetX = Math.min(modelWidth - 24, atStart ? Math.max(24, width) : x + width);
  const gripMotion = useAnimatedStyle(() => ({ transform: [{ translateX: demo.value * (targetX - x) }, { translateY: demo.value * (y - gripY) }] }));
  const id = beats ? 'play-proof-model' : 'play-entry-model';
  return <PaintedModel testID={id} nativeID={id} ready={ready} beats={beats} accessible={!input} accessibilityRole="image" accessibilityLabel={!input ? label : undefined}
    style={{ width: modelWidth, height: rows * rowHeight }}>
    <View pointerEvents="none" style={styles.rows}>{Array.from({ length: total }, (_, i) => <Portion key={i} i={i} vessel={vessel} width={width}
      fraction={Math.min(1, Math.max(0, amount / unit - i))} progress={cuts} pulse={pulse} />)}</View>
    <Animated.View pointerEvents="none" style={[styles.tankLip, { width: modelWidth }, tankLip]} />
    {input && <View testID="jug-portion-input" accessible accessibilityRole="adjustable" accessibilityLabel={`${label}, ${unitLabel}`}
      accessibilityValue={input.selectedIndex == null ? undefined : { text: input.choices[input.selectedIndex] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => {
        const byCount = [...choices].sort((a, b) => a.count - b.count);
        const action = e.nativeEvent.actionName;
        const next = action === 'increment' ? byCount.find(c => c.count > selected) : action === 'decrement' ? byCount.reverse().find(c => c.count < selected) : undefined;
        if (next) choose(next.index);
      }} onStartShouldSetResponder={() => true} onResponderGrant={previewAt} onResponderMove={previewAt} onResponderRelease={submitDrag} onResponderTerminate={() => { lastDrag.current = null; setDrag(null); }} onResponderTerminationRequest={() => false}
      style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {atStart && <DropTargetOutline active style={{ position: 'absolute', width: 46, height: 50, left: targetX - 23, top: y - 25 }} />}
        {selected === 0 && drag === null && <View style={[styles.unitLabel, { left: Math.min(modelWidth - 100, targetX + 27), top: y - 18 }]}><DenseLabel role="axis">{unitLabel}</DenseLabel></View>}
        <Animated.View style={[{ position: 'absolute', left: x - 24, top: gripY - 28 }, gripMotion]}>
          <MovablePiece paintOnly borderless style={styles.piece}>
            {bottle ? <View style={styles.bottle}><View style={styles.bottleTop} /></View>
              : vessel === 'bowl' ? <View style={styles.bowl}><View style={styles.bowlLip} /></View>
              : <View style={styles.cup}><View style={styles.mouth} /></View>}
          </MovablePiece>
        </Animated.View>
      </View>
      <IdleHint movable firstEncounter={first} interacted={touched || input.selectedIndex != null} from={{ x, y: gripY }} to={{ x: targetX, y }} />
    </View>}
  </PaintedModel>;
}
const styles = StyleSheet.create({
  rows: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 13, overflow: 'hidden' },
  cell: { top: 6, height: tankHeight, overflow: 'hidden' },
  full: { backgroundColor: water.fill, borderBottomWidth: 4, borderColor: water.edge },
  water: { position: 'absolute', bottom: 0, backgroundColor: water.fill, borderBottomWidth: 4, borderColor: water.edge },
  neck: { position: 'absolute', top: 1, left: '30%', width: '40%', height: 9, backgroundColor: water.edge, borderRadius: 4 },
  tankLip: { position: 'absolute', top: 4, height: 6, borderRadius: 3, backgroundColor: water.edge },
  unitLabel: { position: 'absolute', paddingHorizontal: 4, borderRadius: 5, backgroundColor: water.soft },
  cupLip: { position: 'absolute', height: 6, left: 1, right: 1, top: 6, borderRadius: 3, backgroundColor: water.edge },
  piece: { width: 48, height: 56 },
  bottle: { width: 24, height: 32, marginTop: 6, borderRadius: 8, backgroundColor: Quantity.amber.fill, borderBottomWidth: 4, borderColor: Quantity.amber.edge },
  bottleTop: { position: 'absolute', top: -7, left: 5, width: 14, height: 10, borderRadius: 3, backgroundColor: Quantity.amber.edge },
  cup: { width: 31, height: 30, borderTopWidth: 30, borderLeftWidth: 4, borderRightWidth: 4, borderColor: 'transparent', borderTopColor: Quantity.amber.fill },
  bowl: { width: 36, height: 22, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, backgroundColor: Quantity.amber.fill },
  bowlLip: { height: 5, borderRadius: 3, backgroundColor: Quantity.amber.edge },
  mouth: { position: 'absolute', top: -32, left: -6, width: 35, height: 8, borderRadius: 4, backgroundColor: Quantity.amber.edge },
});
