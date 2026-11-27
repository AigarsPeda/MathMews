import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { jugMeasure, type CapacityModel } from '@/utils/puzzle-capacity';
import { PuzzleText as Text } from '../PuzzleText';
import { RevealSurface } from '../kit/RevealSurface';
import { Digit, ProofLine, useHelpBeats } from './helpKit';

const water = Quantity.teal;

/** The capacity key's jug: a pale chamber, a handle, a lip band at the rim and bright water that drains as the cups fill. */
function Jug({ height, position, portions, label }: { height: number; position: SharedValue<number>; portions: number; label: string }) {
  const level = useAnimatedStyle(() => ({ height: height * Math.max(0, Math.min(1, 1 - position.value / portions)) }));
  return <View style={[styles.jug, { height }]}>
    <View style={[styles.handle, { top: height * .17, height: height * .42 }]} />
    <View style={[styles.chamber, { height }]}>
      <Animated.View style={[styles.water, level]} />
      <Digit size={30}>{label}</Digit>
    </View>
    <View style={styles.lip} />
  </View>;
}

/** A cup in the same look, labelled with what it holds. */
function Cup({ height, position, index, label }: { height: number; position: SharedValue<number>; index: number; label: string }) {
  const level = useAnimatedStyle(() => ({ height: height * Math.max(0, Math.min(1, position.value - index)) }));
  return <View style={[styles.cup, { height }]}>
    <Animated.View style={[styles.water, level]} />
    <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.cupLabel}>{label}</Text>
  </View>;
}

export function HelpMeasureShare({ model, height, onSolutionShown }: {
  model: CapacityModel; height: number; onSolutionShown: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { portions, end } = jugMeasure(model);
  const beats = useHelpBeats(portions, onSolutionShown, 640, 260);
  const ml = (value: number) => {
    const text = t('jugSolution.ml', { value });
    return i18n.language === 'en' ? text.replace(/ml/i, 'mL') : text;
  };
  const remaining = end - beats.landed * model.portion;
  return <RevealSurface beats={beats}>
    <View style={[styles.model, { height }]}>
      <Jug height={Math.min(150, height * .46)} position={beats.position} portions={portions} label={ml(remaining)} />
      <View style={styles.row}>
        {Array.from({ length: portions }, (_, i) => <Cup key={i} height={Math.min(104, height * .32)}
          position={beats.position} index={i} label={ml(model.portion)} />)}
      </View>
    </View>
    <ProofLine readout caption={beats.landed > 0 ? `${beats.landed} × ${ml(model.portion)}` : undefined}
      equation={beats.settled ? `${end} ÷ ${model.portion} = ${portions}` : undefined} />
  </RevealSurface>;
}

const styles = StyleSheet.create({
  model: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  row: { alignSelf: 'stretch', flexDirection: 'row', gap: 4, justifyContent: 'center', paddingHorizontal: 8 },
  jug: { width: 232, alignItems: 'flex-start' },
  chamber: { width: 200, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: water.soft },
  handle: { position: 'absolute', left: 188, width: 40, borderRadius: 14, backgroundColor: water.edge },
  lip: { position: 'absolute', top: -2, left: 0, width: 200, height: 12, borderRadius: 6, backgroundColor: water.edge },
  cup: { flex: 1, maxWidth: 88, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: water.soft },
  water: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: water.fill, borderBottomColor: water.edge, borderBottomWidth: 3 },
  cupLabel: { color: Ink.text, fontSize: 20, lineHeight: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
