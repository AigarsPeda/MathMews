import { glide } from '@/utils/puzzle-motion';
import { Canvas, Group, Line, Path, Rect } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { useLocale } from '@/contexts/LocaleProvider';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { jugMeasure, type CapacityModel } from '@/utils/puzzle-capacity';
import { PuzzleText as Text } from './PuzzleText';

const W = 320, H = 224, bottom = 213, scaleHeight = 116;
const receiver = 'M94 87 L101 94 H189 V202 Q189 215 177 215 H113 Q101 215 101 202 V103 Z';
const pitcher = 'M0 0 L13 5 H58 V43 Q58 53 48 53 H23 Q14 53 14 44 L10 12 Z';
const spout = { x: 156, y: 82 };
const portionShapes = {
  cup: 'M3 6 H16 L15 19 Q15 22 12 22 H7 Q4 22 4 18 Z',
  bottle: 'M8 1 H13 V5 Q13 7 16 9 V20 Q16 22 14 22 H7 Q5 22 5 20 V10 Q5 8 8 5 Z',
  bowl: 'M1 11 H20 Q18 21 12 21 H9 Q3 20 1 11 Z',
};

export function JugPour({ model, onSolutionShown }: {
  model: CapacityModel; onSolutionShown: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { width } = useWindowDimensions();
  const size = Math.min(W, width - 48);
  const { active, reduceMotion } = useAnimationActivity();
  const { start, end, capacity, portions, remainder } = jugMeasure(model);
  const phase = useSharedValue(0);
  const [reading, setReading] = useState(start);
  const targetY = bottom - scaleHeight * end / capacity;
  const ml = (value: number) => t('jugSolution.ml', { value });
  const kind = model.portionContainer ?? (model.task === 'containers' ? 'bottle' : 'cup');
  useEffect(() => {
    if (!active || reduceMotion) { phase.value = 1; onSolutionShown(); return; }
    phase.value = withTiming(1, { duration: 3000, easing: Easing.linear }, done => {
      if (done) scheduleOnRN(onSolutionShown);
    });
    return () => cancelAnimation(phase);
  }, [active, reduceMotion, phase, onSolutionShown]);

  const poured = useDerivedValue(() => glide((phase.value - .22) / .56));
  const surface = useDerivedValue(() => bottom - scaleHeight * (start + (end - start) * poured.value) / capacity);
  const streamEnd = useDerivedValue(() => ({ x: spout.x, y: surface.value }));
  const stream = useDerivedValue(() => Math.max(0, Math.min(1, (phase.value - .22) * 60, (.79 - phase.value) * 65)));
  const tilt = useDerivedValue(() => {
    const tip = glide((phase.value - .10) / .12);
    const release = glide((phase.value - .79) / .12);
    return (-22 * tip - 54 * poured.value) * (1 - release) * Math.PI / 180;
  });
  const turn = useDerivedValue(() => [{ rotate: tilt.value }]);
  const level = useDerivedValue(() => [{ rotate: -tilt.value }]);
  const sourceY = useDerivedValue(() => 13 * glide((.22 - phase.value) / .12));
  const sourceOpacity = useDerivedValue(() => poured.value < 1 ? 1 : 0);
  const offset = useDerivedValue(() => {
    const approaching = glide((.22 - phase.value) / .12);
    const leaving = glide((phase.value - .79) / .21);
    return { x: 62 * approaching + 210 * leaving, y: -32 * approaching - 38 * leaving };
  });
  const position = useDerivedValue(() => [{ translateX: spout.x + offset.value.x }, { translateY: spout.y + offset.value.y }]);
  // The scale moves continuously. Update the text only at readable increments.
  useAnimatedReaction(() => poured.value === 1 ? end : start + Math.floor(poured.value * 20) * (end - start) / 20,
    (value, prior) => { if (value !== prior) scheduleOnRN(setReading, Math.round(value)); });

  let caption = ml(reading);
  if (model.task === 'space' || model.task === 'total') caption = `${start} + ${reading - start} = ${ml(reading)}`;
  if (model.task === 'litres' && reading === end) {
    const litres = String(end / 1000).replace('.', locale === 'en' ? '.' : ',');
    caption += ' = ' + t('jugSolution.litres', { value: litres });
  }
  const filled = model.task === 'containers' ? Math.ceil(reading / model.portion) : Math.floor(reading / model.portion);
  const portionLabel = portions ? t(`jugSolution.${kind}`, { value: filled }) : '';
  const left = model.task === 'servings' && remainder && reading === end ? t('jugSolution.left', { volume: ml(remainder) }) : '';
  return <View style={styles.wrap}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: H * size / W }}>
      <View style={[styles.scene, { left: (size - W) / 2, top: (H * size / W - H) / 2, transform: [{ scale: size / W }] }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path="M189 112 H201 Q215 112 212 128 L208 149 Q207 158 189 157" color={D.glassEdge} style="stroke" strokeWidth={7} />
          <Path path={receiver} color={D.glass} />
          <Group clip={receiver}>
            <Rect x={99} y={surface} width={93} height={scaleHeight + 3} color={D.waterTop} />
            <Rect x={99} y={surface} width={93} height={2.5} color={D.waterLine} />
            <Line p1={{ x: 177, y: 106 }} p2={{ x: 177, y: 193 }} color={D.highlight} strokeWidth={6} strokeCap="round" />
          </Group>
          <Path path={receiver} color={D.glassEdge} style="stroke" strokeJoin="round" strokeWidth={3} />
          {Array.from({ length: 9 }, (_, i) => {
            const y = bottom - scaleHeight * i / 8;
            return <Line key={i} p1={{ x: 102, y }} p2={{ x: i % 2 ? 109 : 115, y }} color={D.geometryEdge} strokeWidth={1.5} />;
          })}
          <Line p1={{ x: 84, y: targetY }} p2={{ x: 124, y: targetY }} color={C.primary} strokeWidth={3} strokeCap="round" />
          <Line p1={spout} p2={streamEnd} color={D.waterTop} strokeWidth={5} opacity={stream} strokeCap="round" />
          <Group transform={position}>
            <Group transform={turn}>
              <Path path="M57 12 H66 Q75 12 73 20 L69 32 Q67 38 57 38" color={D.goldEdge} style="stroke" strokeWidth={6} />
              <Path path={pitcher} color={D.glass} />
              <Group clip={pitcher} opacity={sourceOpacity}>
                <Group transform={level}><Rect x={-70} y={sourceY} width={190} height={120} color={D.waterTop} /></Group>
              </Group>
              <Path path={pitcher} color={D.geometryEdge} style="stroke" strokeWidth={2.5} strokeJoin="round" />
              <Path path="M0 0 L13 5 H58" color={D.gold} style="stroke" strokeWidth={4} strokeCap="round" />
            </Group>
          </Group>

        </Canvas>
        <Text allowFontScaling={false} style={[styles.mark, { top: targetY - 11 }]}>{ml(end)}</Text>
      </View>
    </View>
    {!!portions && <Canvas accessible={false} style={{ width: Math.min(size, portions * 21), height: 25 }}>
      <Group transform={[{ scaleX: Math.min(1, size / (portions * 21)) }]}>
        {Array.from({ length: portions }, (_, i) => {
          const fraction = Math.max(0, Math.min(1, reading / model.portion - i));
          const top = kind === 'bowl' ? 11 : kind === 'bottle' ? 1 : 6;
          return <Group key={i} transform={[{ translateX: i * 21 }]}>
            {kind === 'cup' && <Path path="M16 8 Q24 8 16 15" color={D.glassEdge} style="stroke" strokeWidth={2} />}
            <Path path={portionShapes[kind]} color={D.glass} />
            <Group clip={portionShapes[kind]}><Rect x={0} y={22 - fraction * (22 - top)} width={21} height={22} color={D.waterTop} /></Group>
            <Path path={portionShapes[kind]} color={D.geometryEdge} style="stroke" strokeWidth={1.5} />
          </Group>;
        })}
      </Group>
    </Canvas>}
    <View accessible testID="jug-solution-caption" accessibilityLabel={[caption, portionLabel, left].filter(Boolean).join(', ')} style={styles.caption}>
      <Text style={styles.readout}>{caption}</Text>
      {!!portions && <Text style={styles.count}>{[portionLabel, left].filter(Boolean).join(' · ')}</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 6 },
  scene: { width: W, height: H, position: 'absolute' },
  mark: { position: 'absolute', left: 0, width: 78, textAlign: 'right', fontSize: 15, lineHeight: 22, fontWeight: '800', color: C.primaryDark },
  caption: { alignItems: 'center', paddingHorizontal: 6 },
  readout: { color: C.text, fontSize: 21, lineHeight: 29, fontWeight: '900', textAlign: 'center', fontVariant: ['tabular-nums'] },
  count: { color: D.geometryEdge, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
});
