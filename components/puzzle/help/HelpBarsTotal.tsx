import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useDerivedValue } from 'react-native-reanimated';
import { Quantity } from '@/constants/puzzle-theme';
import { BarColumn } from '../BarChart';
import { RevealSurface } from '../kit/RevealSurface';
import { Digit, ProofLine, useHelpBeats } from './helpKit';

/** The total lane under the bars: reserved from the first frame, so nothing moves when "9" lands. */
const TOTAL_LANE = 60;
const GAP = 4;
const NUMBER_LANE = 36;

/**
 * Read the bars one at a time: the bar being read is teal, bars already counted turn violet, unread bars wait pale.
 * The total is ONE band exactly as wide as the plot, in its own lane under the bars.
 */
export function HelpBarsTotal({ values, height, onSolutionShown }: {
  values: number[]; height: number; onSolutionShown: () => void;
}) {
  const [width, setWidth] = useState(0);
  const beats = useHelpBeats(values.length, onSolutionShown, 720, 320);
  const max = Math.max(...values);
  const stageHeight = Math.max(150, Math.min(320, height));
  const plot = stageHeight - TOTAL_LANE - NUMBER_LANE - 8;
  const drawn = useDerivedValue(() => 1);
  const read = values.slice(0, beats.landed);
  const sum = read.reduce((total, value) => total + value, 0);
  const barWidth = Math.floor((width - GAP * (values.length - 1)) / values.length);
  const plotWidth = barWidth * values.length + GAP * (values.length - 1);
  const everyBarRead = beats.landed >= values.length;
  return <RevealSurface beats={beats}>
    <View onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ height: stageHeight, alignItems: 'center', justifyContent: 'flex-end' }}>
      {width > 0 && <>
        <View style={{ width: plotWidth, flexDirection: 'row', gap: GAP, alignItems: 'flex-end', height: plot + NUMBER_LANE }}>
          {values.map((value, i) => <View key={i} style={{ alignItems: 'center' }}>
            <Digit size={28}>{value}</Digit>
            <BarColumn height={plot * value / max} width={barWidth} progress={drawn} grow={false}
              highlighted={false} compared={i < beats.landed - 1 || (beats.settled && i < beats.landed)} muted={i >= beats.landed} />
          </View>)}
        </View>
        <View style={[styles.lane, { width: plotWidth }]}>
          {everyBarRead && <Animated.View entering={FadeIn.duration(260)} style={[styles.total, { width: plotWidth }]}>
            <Digit size={32}>{sum}</Digit>
          </Animated.View>}
        </View>
      </>}
    </View>
    <ProofLine readout caption={read.join(' + ')} equation={beats.settled ? read.join(' + ') + ' = ' + sum : undefined} />
  </RevealSurface>;
}

const styles = StyleSheet.create({
  lane: { height: TOTAL_LANE, paddingTop: 8 },
  total: { height: TOTAL_LANE - 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Quantity.violet.light },
});
