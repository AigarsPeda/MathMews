import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import type { FractionRevealPlan } from '@/utils/fraction-reveal';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FractionStrip } from './FractionStrip';
import { StackedEquation } from './StackedEquation';

export function HelpFractionStrips({ plan, height, onSolutionShown }: {
  plan: FractionRevealPlan; height: number; onSolutionShown: () => void;
}) {
  const { t } = useTranslation();
  const [first, second] = plan.diagrams;
  const splitting = plan.mechanic === 'equivalent';
  // Comparing: cut and shade the first strip, cut and shade the second, put the two shaded parts side by side, then the equation.
  const comparing = !!second && !splitting;
  const count = splitting ? first.denominator : comparing ? 3 : second ? 2 : first.numerator + 1;
  const beats = useRevealBeats(count, comparing
    ? { lead: 200, step: i => [320, 900, 900][i] ?? 600, hold: i => i === 3 ? 1100 : 0, minTotal: 0, reducedSteps: true, onDone: onSolutionShown }
    : { lead: 340, step: 440, hold: 230, minTotal: 0, reducedSteps: true, onDone: onSolutionShown });
  const step = beats.landed;
  const single = !comparing && !splitting;
  const barHeight = Math.max(44, Math.min(comparing ? 104 : single ? 168 : 150, Math.floor((height - 16) / (comparing ? 2 : 1))));
  const strip = { height: barHeight, gap: 4, lip: true } as const;
  const shaded = Math.max(0, step - 1);
  const [stripWidth, setStripWidth] = useState(0);
  const equation = plan.equation ?? Array.from({ length: first.numerator }, () => '1/' + first.denominator).join(' + ')
    + ' = ' + first.numerator + '/' + first.denominator;
  return <RevealSurface beats={beats}>
    <View style={[styles.board, { minHeight: height }]}>
      {splitting ? <View style={styles.thirds}>
        {Array.from({ length: first.denominator }, (_, index) => {
          const pieces = index < step ? second.denominator / first.denominator : 1;
          return <View key={index} style={styles.part}><FractionStrip {...strip} tone="teal" parts={pieces}
            shaded={index < first.numerator ? pieces : 0} opening={pieces > 1} key={pieces} /></View>;
        })}
      </View> : comparing ? [first, second].map((fraction, index) => {
        const cut = step > index, compared = step >= 3;
        return <View key={index} style={styles.row}>
          <Text style={styles.label}>{fraction.numerator}/{fraction.denominator}</Text>
          <View style={styles.part} onLayout={index === 0 ? e => setStripWidth(e.nativeEvent.layout.width) : undefined}>
            <FractionStrip {...strip} key={cut ? 'cut' : 'whole'} opening={cut} parts={cut ? fraction.denominator : 1}
              tone={index ? 'violet' : 'teal'} shaded={cut ? fraction.numerator : 0} over={compared && index === 0 ? [0] : undefined} animateChange />
            {compared && index === 0 && stripWidth > 0 && <View pointerEvents="none" style={[styles.bigger, { left: stripWidth / fraction.denominator + 12 }]}>
              <Text style={styles.biggerText}>{t('visualHelp.examples.fraction_compare.bigger')}</Text></View>}
          </View>
        </View>;
      }) : <FractionStrip {...strip} key={step > 0 ? 'cut' : 'whole'} opening={step > 0}
          parts={step ? first.denominator : 1} shaded={shaded} tone="teal" animateChange />}
      <View style={styles.reading}>
        {beats.settled ? <StackedEquation value={equation} textStyle={styles.label} />
          : !second && step > 0 ? <StackedEquation value={shaded + '/' + first.denominator} />
          : splitting ? <StackedEquation value={first.numerator + '/' + first.denominator} /> : null}
      </View>
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  board: { alignSelf: 'stretch', justifyContent: 'center', gap: 12 },
  bigger: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  biggerText: { color: Ink.text, fontSize: 24, fontWeight: '800', backgroundColor: Quantity.amber.light, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 2, overflow: 'hidden' },
  thirds: { flexDirection: 'row', gap: 4 },
  part: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: Ink.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reading: { height: 78, justifyContent: 'center' },
});
