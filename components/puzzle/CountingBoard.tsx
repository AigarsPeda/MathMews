import { countingCadence } from '@/utils/puzzle-motion';
import { scheduleOnRN } from 'react-native-worklets';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { getCountingLayout, getPiecePosition, type CountingModel, type CountingPiece } from '@/utils/puzzle-counting';
import { moderateScale } from '@/utils/scale';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PuzzleObjectImage } from './PuzzleObjectImage';
import { PuzzleText } from './PuzzleText';
import { PuzzleColors } from '@/constants/puzzle-theme';

function Piece({ piece, time, size, ratio, object }: {
  piece: CountingPiece; time: SharedValue<number>; size: number; ratio: number; object: CountingModel['object'];
}) {
  const position = useAnimatedStyle(() => {
    const { x, y, angle, squash, scale, opacity } = getPiecePosition(piece, time.value);
    return { opacity, transform: [{ translateX: (x - size / 2) * ratio }, { translateY: (y - size / 2) * ratio },
      { rotate: `${angle}deg` }, { scaleX: scale * (1 + squash) }, { scaleY: scale * (1 - squash) }] };
  });
  return <Animated.View style={[styles.sprite, { width: size * ratio, height: size * ratio }, position]}>
    <PuzzleObjectImage object={object} primary={piece.primary} />
  </Animated.View>;
}

export function CountingBoard({ model, joined, prompt, onSolutionShown }: {
  model: CountingModel; joined: boolean; onSolutionShown?: () => void; prompt?: string;
}) {
  const { active, reduceMotion } = useAnimationActivity();
  const [width, setWidth] = useState(0);
  const { pieces, size, height } = useMemo(() => getCountingLayout(model), [model]);
  const time = useSharedValue(0);
  const count = model.right;
  const [settled, setSettled] = useState(false);
  useAnimatedReaction(() => time.value >= count, (done, previous) => {
    if (done !== previous) scheduleOnRN(setSettled, done);
  });
  useEffect(() => {
    if (joined && settled) onSolutionShown?.();
  }, [joined, settled, onSolutionShown]);
  useEffect(() => {
    if (!joined || !active || reduceMotion) time.value = joined ? count : 0;
    else time.value = withTiming(count, { duration: count * Math.max(390, 840 - (count - 1) * 95), easing: count === 1 ? Easing.linear : countingCadence });
    return () => cancelAnimation(time);
  }, [joined, active, reduceMotion, count, time]);

  const ratio = width / 300;
  return <View style={styles.stage}>
    {prompt ? <PuzzleText style={styles.prompt}>{prompt}</PuzzleText> : null}
    <View testID="practice-board" style={[styles.board, { aspectRatio: 300 / height }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && pieces.map((piece, index) =>
        <Piece key={index} piece={piece} size={size} ratio={ratio} time={time} object={model.object} />)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  stage: { padding: moderateScale(6) },
  prompt: { minHeight: moderateScale(28), fontSize: moderateScale(18), fontWeight: '800', color: PuzzleColors.text, textAlign: 'center' },
  board: { width: '100%', overflow: 'hidden' },
  sprite: { position: 'absolute', left: 0, top: 0 },
});
