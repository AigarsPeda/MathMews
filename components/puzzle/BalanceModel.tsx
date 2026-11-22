import { BalanceScale } from '@/components/puzzle/BalanceScale';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors, PuzzleColors } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import type { BalancePayload } from '@/types/puzzle';
import { balanceLeftValue } from '@/utils/balance-value';
import { moderateScale } from '@/utils/scale';
import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Props = {
  model: BalancePayload;
  choice: string | null;
  checked: boolean;
  origin?: { x: number; y: number };
  onSolutionShown?: () => void;
};

// A new delivery owns its measurement and animations, including rapid changes of choice.
export function BalanceModel(props: Props) {
  const [tilt] = useState(() => new Animated.Value(0));
  return <Delivery key={props.choice ?? 'empty'} {...props} tilt={tilt} />;
}

function Delivery({ model, choice, checked, origin, onSolutionShown, tilt }: Props & { tilt: Animated.Value }) {
  const { active, reduceMotion } = useAnimationActivity();
  const animate = active && !reduceMotion;
  const slot = useRef<View>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [landed, setLanded] = useState(false);
  const [travel] = useState(() => new Animated.Value(0));
  const [before, after] = model.leftDisplay.split('?');
  const total = balanceLeftValue(model.leftDisplay, choice);
  const direction = total === null ? 0 : Math.sign(model.rightValue - total);
  const relation = direction === 0 ? '=' : direction > 0 ? '<' : '>';
  useLayoutEffect(() => {
    if (choice === null || !animate || !offset) return;
    const motion = Animated.timing(travel, { toValue: 1, duration: 460, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    motion.start(({ finished }) => { if (finished) setLanded(true); });
    return () => motion.stop();
  }, [choice, animate, offset, travel]);

  const delivered = landed || !animate;
  useLayoutEffect(() => {
    const weigh = checked && delivered;
    const target = weigh ? direction : 0;
    if (!animate) {
      tilt.setValue(target);
      if (weigh) onSolutionShown?.();
      return;
    }
    const settle = Animated.timing(tilt, {
      toValue: target, duration: weigh ? 440 : 260, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true,
    });
    // An equal load briefly dips the receiving pan before both pans settle level.
    const motion = weigh && direction === 0 ? Animated.sequence([
      Animated.timing(tilt, { toValue: -.24, duration: 145, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      settle,
    ]) : settle;
    motion.start(({ finished }) => { if (finished && weigh) onSolutionShown?.(); });
    return () => motion.stop();
  }, [animate, checked, delivered, direction, tilt, onSolutionShown]);


  const slide = (from: number) => travel.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
  const tile = <Text style={styles.number}>{choice}</Text>;
  return <View style={styles.stage}>
    <BalanceScale numberWeights tilt={tilt} left={<>
      {before.trim() ? <Text style={styles.expression}>{before.trim()}</Text> : null}
      <View ref={slot} collapsable={false} onLayout={() => {
        if (offset || choice === null) return;
        slot.current?.measureInWindow((x, y, w, h) => {
          setOffset(origin && w > 0 ? { x: origin.x - x - w / 2, y: origin.y - y - h / 2 } : { x: moderateScale(90), y: 0 });
        });
      }} style={styles.socket}>
        <Text style={[styles.number, choice !== null && styles.invisible]}>{choice ?? '?'}</Text>
        {choice !== null && (delivered || offset) ? <Animated.View pointerEvents="none" accessible={false}
          style={[styles.tile, !delivered && { transform: [{ translateX: slide(offset!.x) }, { translateY: slide(offset!.y) }] }]}>
          {tile}
        </Animated.View> : null}
      </View>
      {after.trim() ? <Text style={styles.expression}>{after.trim()}</Text> : null}
    </>} right={<Text style={styles.target}>{model.rightValue}</Text>} />
    {checked && delivered && total !== null && <Text testID="balance-comparison" accessibilityLiveRegion="polite" style={styles.comparison}>
      {total} {relation} {model.rightValue}
    </Text>}
  </View>;
}

const styles = StyleSheet.create({
  stage: { paddingTop: moderateScale(6) },
  expression: { color: PuzzleColors.text, fontWeight: '800', fontSize: moderateScale(21) },
  target: { color: PuzzleColors.text, fontWeight: '800', fontSize: moderateScale(26) },
  socket: { minWidth: moderateScale(36), minHeight: moderateScale(30), paddingHorizontal: 4, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', borderColor: DiagramColors.geometryEdge, alignItems: 'center', justifyContent: 'center' },
  tile: { ...StyleSheet.absoluteFill, borderRadius: 7, backgroundColor: PuzzleColors.selectedStrong, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: moderateScale(22), color: PuzzleColors.text, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  invisible: { opacity: 0 },
  comparison: { textAlign: 'center', fontSize: moderateScale(20), fontWeight: '800', color: PuzzleColors.text },
});
