import { glide } from '@/utils/puzzle-motion';
import { Canvas, Circle, Line } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { clockTime, clockTravel, type ClockModel } from '@/utils/puzzle-clock';
import { PuzzleText as Text } from './PuzzleText';

const polar = (angle: number, radius: number) => ({ x: 120 + Math.sin(angle) * radius, y: 120 - Math.cos(angle) * radius });
const ticks = Array.from({ length: 60 }, (_, i) => {
  const angle = i * Math.PI / 30;
  return <Line key={i} p1={polar(angle, i % 5 ? 96 : 91)} p2={polar(angle, 99)}
    color={i % 5 ? C.cardBorder : C.textMuted} strokeWidth={i % 5 ? 1 : 3} strokeCap="round" />;
});
function ClockCaption({ start, delta, elapsed }: { start: number; delta: number; elapsed: SharedValue<number> }) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  // Only the caption crosses to JS, once per clock minute.
  useAnimatedReaction(() => Math.trunc(elapsed.value), (n, prior) => {
    if (n !== prior) scheduleOnRN(setOffset, n);
  });
  const current = start + offset;
  const day = Math.floor(current / 1440);
  const dayLabel = day > 0 ? t('clockSolution.nextDay') : day < 0 ? t('clockSolution.previousDay') : '';
  const timeLabel = delta ? `${clockTime(start)} → ${clockTime(current)}` : clockTime(start);
  const sign = delta < 0 ? '−' : '+';
  const minutes = Math.abs(offset);
  const amount = sign + t('clockSolution.minutes', { value: minutes });
  const showHours = minutes > 0 && minutes % 60 === 0;
  const durationLabel = showHours ? `${amount} (${t('clockSolution.hours', { value: minutes / 60 })})` : amount;
  return <View testID="clock-solution-caption" accessible accessibilityLabel={[timeLabel, dayLabel, delta && durationLabel].filter(Boolean).join(', ')} style={styles.caption}>
    <Text testID="clock-solution-time" style={styles.readout}>{timeLabel}{dayLabel ? ` · ${dayLabel}` : ''}</Text>
    {delta !== 0 && <Text testID="clock-solution-duration" style={styles.duration}>{durationLabel}</Text>}
  </View>;
}

type Props = { model: ClockModel; onSolutionShown?: () => void };

function ClockDial({ model, onSolutionShown }: Props) {
  const { width, height, fontScale } = useWindowDimensions();
  const size = Math.min(width - 48, Math.max(200, Math.min(240, Math.round(height * .245))) * fontScale);
  const { active, reduceMotion } = useAnimationActivity();
  const phase = useSharedValue(0);
  const delta = clockTravel(model);
  const start = model.minutes;
  useEffect(() => {
    if (!onSolutionShown) { phase.value = 0; return; }
    if (!active || reduceMotion || delta === 0) { phase.value = 1; onSolutionShown(); return; }
    const duration = 1000 + Math.abs(delta) * 16;
    phase.value = withTiming(1, { duration, easing: glide }, finished => {
      if (finished) scheduleOnRN(onSolutionShown);
    });
    return () => cancelAnimation(phase);
  }, [phase, delta, active, reduceMotion, onSolutionShown]);

  const elapsed = useDerivedValue(() => delta * phase.value);
  const hourHand = useAnimatedStyle(() => ({ transform: [{ rotate: `${(start + elapsed.value) / 2}deg` }] }));
  const minuteHand = useAnimatedStyle(() => ({ transform: [{ rotate: `${(start + elapsed.value) * 6}deg` }] }));
  return <View style={styles.wrap}>
    <View accessible={!onSolutionShown} accessibilityLabel={model.label} accessibilityRole="image" style={{ width: size, height: size }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.dial, { left: (size - 240) / 2, top: (size - 240) / 2, transform: [{ scale: size / 240 }] }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Circle cx={120} cy={124} r={115} color={D.goldEdge} /><Circle cx={120} cy={120} r={115} color={D.gold} />
          <Circle cx={120} cy={120} r={101} color={C.card} />{ticks}
        </Canvas>
        {numerals}
        <Animated.View style={[StyleSheet.absoluteFill, hourHand]}><View style={styles.hourHand} /></Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, minuteHand]}><View style={styles.minuteHand} /></Animated.View>
        <View style={styles.pivot} />
      </View>
    </View>
    {!!onSolutionShown && <ClockCaption start={start} delta={delta} elapsed={elapsed} />}
  </View>;
}

export function ClockDiagram(props: Props) {
  const { model, onSolutionShown } = props;
  if (model.analog || onSolutionShown) return <ClockDial {...props} />;
  return <View accessible accessibilityRole="image" accessibilityLabel={model.label} style={[styles.wrap, styles.times]}>
    <Text style={styles.time}>{clockTime(model.minutes)}</Text>
    {model.end !== undefined && <><Text style={styles.arrow}>→</Text><Text style={styles.time}>{clockTime(model.end)}</Text></>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8 },
  dial: { position: 'absolute', width: 240, height: 240 },
  number: { position: 'absolute', width: 30, textAlign: 'center', fontSize: 19, fontWeight: '900', color: C.text },
  hourHand: { position: 'absolute', top: 58, left: 116, width: 8, height: 66, borderRadius: 4, backgroundColor: D.geometryEdge },
  minuteHand: { position: 'absolute', top: 45, left: 117, width: 6, height: 78, borderRadius: 3, backgroundColor: C.primary },
  pivot: { position: 'absolute', top: 114, left: 114, width: 12, height: 12, borderRadius: 6, backgroundColor: C.primary },
  caption: { alignItems: 'center', marginTop: 6 },
  readout: { fontSize: 22, lineHeight: 30, fontWeight: '900', fontVariant: ['tabular-nums'], color: C.text, textAlign: 'center' },
  duration: { fontSize: 17, lineHeight: 24, fontWeight: '800', fontVariant: ['tabular-nums'], color: C.primaryDark },
  times: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  time: { fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'], color: C.text, backgroundColor: D.glass, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 2, borderColor: C.cardBorder },
  arrow: { fontSize: 24, color: C.textMuted },
});

const numerals = Array.from({ length: 12 }, (_, i) => {
  const p = polar((i + 1) * Math.PI / 6, 80);
  return <Text key={i} allowFontScaling={false} style={[styles.number, { left: p.x - 15, top: p.y - 13 }]}>{i + 1}</Text>;
});
