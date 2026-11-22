import { glide } from '@/utils/puzzle-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { PuzzleObjectImage } from './PuzzleObjectImage';
import { AppIcon } from '@/components/ui/AppIcon';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { barAnswer, groupLetter, type BarModel } from '@/utils/puzzle-bars';
import { PuzzleText as Text } from './PuzzleText';

const finishes = [
  { face: '#D9518A', edge: '#A82D64' },
  { face: '#59B7A9', edge: '#277D74' },
  { face: '#A385D1', edge: '#70509D' },
];

function Column({ index, count, height, progress, grow, highlighted, muted, children }: {
  index: number; count: number; height: number; progress: SharedValue<number>; grow: boolean; highlighted: boolean; muted: boolean; children?: ReactNode;
}) {
  const finish = finishes[index % finishes.length];
  const motion = useAnimatedStyle(() => {
    // Stagger the starts in time so each column eases onto its own mark.
    const span = count > 1 ? .42 : 0;
    const start = count > 1 ? index / (count - 1) * span : 0;
    const fraction = grow ? glide((progress.value - start) / (1 - span)) : 1;
    return { transform: [{ translateY: height * (1 - fraction) }] };
  });
  return <View style={[styles.clip, { height }]}>
    <Animated.View style={[styles.fill, motion, { backgroundColor: muted ? C.progressTrack : finish.face,
      borderColor: highlighted ? C.text : muted ? C.cardBorder : finish.edge, borderWidth: highlighted ? 2 : 1, borderBottomWidth: 0 }]}>
      <View style={styles.gloss} />
      {children}
    </Animated.View>
  </View>;
}

function ExtraInterval({ bottom, height, value, start, end, progress, showLabel }: {
  bottom: number; height: number; value: number; start: number; end: number; progress: SharedValue<number>; showLabel: boolean;
}) {
  const reveal = useAnimatedStyle(() => ({ opacity: glide((progress.get() - start) / (end - start)) }));
  return <Animated.View style={[styles.interval, { bottom, height }, reveal]}>
    {showLabel && <Text style={styles.increment}>+{value}</Text>}
  </Animated.View>;
}

export function BarChart({ model, onSolutionShown }: { model: BarModel; onSolutionShown?: () => void }) {
  const { height, fontScale } = useWindowDimensions();
  const { t } = useTranslation();
  const { active, reduceMotion } = useAnimationActivity();
  const solving = !!onSolutionShown;
  const comparing = solving && (model.task === 'difference' || model.task === 'range');
  const solution = useMemo(() => barAnswer(model), [model]);
  const [low, high] = solution.marks;
  const gap = comparing ? high - low : 0;
  const intervals = Math.ceil(gap / model.step);
  const duration = comparing ? Math.min(2000, 220 + intervals * 240) : 1450;
  const progress = useSharedValue(solving ? 0 : 1);
  const [settled, setSettled] = useState(false);
  useAnimatedReaction(() => solving && progress.value >= 1, (done, previous) => {
    if (done && !previous) scheduleOnRN(setSettled, true);
  });
  useEffect(() => {
    if (!solving || progress.get() >= 1) return;
    if (!active || reduceMotion || (comparing && !intervals)) { progress.set(1); return; }
    progress.set(withTiming(1, { duration, easing: Easing.linear }));
    return () => cancelAnimation(progress);
  }, [active, reduceMotion, progress, solving, duration, comparing, intervals]);
  useEffect(() => { if (settled) onSolutionShown?.(); }, [settled, onSolutionShown]);

  const missing = model.task === 'missing';
  const known = model.values.filter((_, i) => !missing || i !== model.index);
  const questionMax = Math.max(...known) + (missing ? model.step : 0);
  const max = Math.max(model.step, questionMax, solving ? Math.max(...model.values) : 0);
  const ticks = Array.from({ length: Math.floor(max / model.step) + 1 }, (_, i) => i * model.step);
  const plotHeight = Math.max(Math.min(180, Math.max(120, Math.round(height * .16))), (ticks.length - 1) * 20 * fontScale);
  const y = (value: number) => value / max * plotHeight;
  const headroom = 29 * fontScale;
  const result = settled || comparing ? solution : undefined;
  const marks = result?.marks ?? [];
  const labelHeight = Math.max(28, 24 * fontScale + 4);
  const axisWidth = Math.max(42, 10 * String(max).length * fontScale + 10);
  const title = t(model.subject === 'cats' ? 'everyday.catCount' : 'everyday.toyCount');
  const description = settled ? [title, ...model.values.map((v, i) => `${groupLetter(i)} = ${v}`)].join(', ') : model.label;
  return <View style={styles.wrap}>
    <View accessible accessibilityRole="image" accessibilityLabel={description} style={styles.chart}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.subject}>
          {model.subject === 'cats' ? <AppIcon name="cat" size={32} /> : <View style={styles.toy}><PuzzleObjectImage object="mouse" /></View>}
          <Text style={styles.title}>{title}</Text></View>
        <View style={{ height: plotHeight + labelHeight + headroom, marginTop: 6 }}>
          {ticks.map(value => <View key={value} style={[styles.gridline, { bottom: y(value) + labelHeight }]}>
            <Text style={[styles.axisLabel, { width: axisWidth, top: -10 * fontScale, height: 20 * fontScale }, marks.includes(value) && styles.focusLetter]}>{value}</Text>
            <View style={[styles.rule, { marginLeft: axisWidth }, marks.includes(value) && styles.markedRule]} />
          </View>)}
          <View style={[styles.bars, { left: axisWidth + 8 }]}>{model.values.map((value, i) => {
            const focused = result?.columns.includes(i) ?? false;
            return <View key={i} style={styles.column}>
              {(focused || model.task === 'mean' && !solving) && <Text style={styles.value}>{value}</Text>}
              {missing && i === model.index && !solving
                ? <View style={styles.missing}><Text style={styles.unknown}>?</Text></View>
                : <Column index={i} count={missing ? 1 : model.values.length} height={y(value)} progress={progress} grow={solving && !comparing && (!missing || i === model.index)}
                    highlighted={focused} muted={!!result && !focused}>
                    {comparing && focused && value === high && Array.from({ length: intervals }, (_, n) => {
                      const offset = n * model.step;
                      const units = Math.min(model.step, gap - offset);
                      return <ExtraInterval key={n} value={units} height={y(units)} bottom={y(low + offset)}
                        start={n / intervals} end={(n + 1) / intervals} progress={progress} showLabel={y(units) >= 16 * fontScale} />;
                    })}
                  </Column>}
              <Text style={[styles.letter, { height: labelHeight }, focused && styles.focusLetter]}>{groupLetter(i)}</Text>
            </View>;
          })}</View>
          {marks.length === 1 && <View style={[styles.guide, { left: axisWidth, bottom: y(marks[0]) + labelHeight }]} />}
          {comparing && <View style={[styles.guide, { left: axisWidth, bottom: y(low) + labelHeight }]} />}
        </View>
      </View>
    </View>
    {solving && <View style={{ minHeight: 29 * fontScale + 2 }}>
      {settled && <Text testID="bar-solution-caption" accessibilityLiveRegion="polite" style={styles.answer}>{solution.caption}</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8 },
  chart: { width: '100%', maxWidth: 360 },
  subject: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  toy: { width: 50, height: 34 },
  title: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
  gridline: { position: 'absolute', left: 0, right: 8, height: 1 },
  axisLabel: { position: 'absolute', left: 0, paddingRight: 8, lineHeight: 20, textAlign: 'right', color: C.textMuted, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rule: { height: 1, backgroundColor: C.cardBorder },
  markedRule: { backgroundColor: C.primaryDark },
  bars: { position: 'absolute', right: 16, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  clip: { width: '75%', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden', borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  gloss: { height: 4, backgroundColor: D.highlight },
  value: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
  letter: { paddingTop: 4, lineHeight: 24, fontSize: 17, fontWeight: '800', color: C.text },
  focusLetter: { color: C.primaryDark },
  missing: { height: 100, width: '75%', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: C.textMuted, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: C.progressTrack },
  unknown: { fontSize: 26, fontWeight: '900', color: C.text },
  guide: { position: 'absolute', right: 8, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: C.primaryDark },
  interval: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primaryDark, borderBottomWidth: 1, borderBottomColor: C.selectedStrong },
  increment: { color: C.card, fontSize: 12, lineHeight: 16, fontWeight: '800', fontVariant: ['tabular-nums'], includeFontPadding: false },
  answer: { textAlign: 'center', fontSize: 21, lineHeight: 29, fontWeight: '900', color: C.primaryDark, marginTop: 2, fontVariant: ['tabular-nums'] },
});
