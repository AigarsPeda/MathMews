import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { IconText } from "@/components/ui/IconText";
import { PuzzleObjectImage } from "./PuzzleObjectImage";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { PracticeToken } from "@/types/visual-explanation";
import { getPracticeTokenSize, PRACTICE_BOARD_HEIGHT, PRACTICE_BOARD_WIDTH } from "@/utils/practice-token-layout";
import { moderateScale } from "@/utils/scale";
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

type PracticeScene = { prompt?: string; tokens: PracticeToken[]; result?: string; compact?: boolean; boardHeight?: number; durationMs?: number; staggerMs?: number };

function MovingToken({ token, ratio, delay, durationMs, motion }: { token: PracticeToken; ratio: number; delay: number; durationMs: number; motion: boolean }) {
  const x = useSharedValue(token.x);
  const y = useSharedValue(token.y);
  const opacity = useSharedValue(token.visible === false ? 0 : 1);
  const scale = useSharedValue(token.scale ?? 1);
  const fill = useSharedValue(token.tone === "muted" ? 0 : 1);
  const lane = useSharedValue(0);
  const previousX = useRef(token.x);
  useEffect(() => {
    const duration = motion ? durationMs : 0;
    const wait = motion ? delay : 0;
    for (const value of [x, y, opacity, scale, fill, lane]) cancelAnimation(value);
    lane.value = 0;
    x.value = withDelay(wait, withTiming(token.x, { duration }));
    y.value = withDelay(wait, withTiming(token.y, { duration }));
    opacity.value = withDelay(wait, withTiming(token.visible === false ? 0 : 1, { duration }));
    scale.value = withTiming(token.scale ?? 1, { duration });
    fill.value = withDelay(wait, withTiming(token.tone === "muted" ? 0 : 1, { duration }));
    if (token.arc && previousX.current !== token.x) {
      lane.value = withDelay(wait, withSequence(
        withTiming(motion ? token.arc : 0, { duration: duration / 2 }),
        withTiming(0, { duration: duration / 2 }),
      ));
    }
    previousX.current = token.x;
    return () => { for (const value of [x, y, opacity, scale, fill, lane]) cancelAnimation(value); };
  }, [token.x, token.y, token.visible, token.scale, token.tone, token.arc, motion, durationMs, delay, x, y, opacity, scale, fill, lane]);
  const movingStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value * ratio }, { translateY: (y.value + lane.value) * ratio }, { scale: scale.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value * (token.shape === "part" ? 1 : .16) }));
  const plain = token.shape === "plain";
  const dimensions = getPracticeTokenSize(token);
  const size = dimensions.width * ratio;
  const height = dimensions.height * ratio;
  const shapeStyle = token.cornerRadius === undefined ? undefined : { borderRadius: token.cornerRadius * ratio };
  const color = token.tone === "primary" ? GameColors.primary : token.tone === "blue" ? "#246FA8" : GameColors.secondary;
  return (
    <Animated.View
      testID={`practice-token-${token.id}`}
      accessible={token.visible !== false && token.label.length > 0}
      accessibilityLabel={token.label}
      accessibilityElementsHidden={token.visible === false}
      importantForAccessibility={token.visible === false ? "no-hide-descendants" : "auto"}
      style={[
        styles.token,
        { width: size, height, marginLeft: -size / 2, marginTop: -height / 2 },
        movingStyle,
      ]}
    >
      {token.shape && !plain && !token.object ? (
        <View style={[StyleSheet.absoluteFill, styles.tokenShape, shapeStyle, { backgroundColor: GameColors.cardBorder }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.tokenShape, shapeStyle, { backgroundColor: color }, fillStyle]} />
        </View>
      ) : null}
      {token.object ? <PuzzleObjectImage object={token.object} primary={token.tone === "primary"} /> : <Animated.View key={token.label} entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)}>
        <IconText style={[
          styles.tokenText,
          { fontSize: (plain ? 21 : 25) * ratio, color: token.tone === "primary" ? GameColors.primary : GameColors.text },
        ]}>
          {token.label}
        </IconText>
      </Animated.View>}
    </Animated.View>
  );
}

export function VisualPracticeBoard({ prompt, tokens, result, compact = false, boardHeight = PRACTICE_BOARD_HEIGHT, durationMs = 600, staggerMs = 55 }: PracticeScene) {
  const { active, reduceMotion } = useAnimationActivity();
  const [width, setWidth] = useState(0);
  const ratio = width / PRACTICE_BOARD_WIDTH;
  return (
    <View style={styles.stage}>
      {prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
      <View testID="practice-board" style={[styles.board, { aspectRatio: PRACTICE_BOARD_WIDTH / boardHeight }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? tokens.map((token, i) => (
          <MovingToken key={token.id} token={token} ratio={ratio} delay={Math.min(i, 5) * staggerMs} durationMs={durationMs} motion={active && !reduceMotion} />
        )) : null}
      </View>
      {!compact || result ? <View style={styles.resultHost}>
        {result ? (
          <Animated.Text key={result} entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
            style={styles.result} accessibilityLiveRegion="polite">
            {result}
          </Animated.Text>
        ) : null}
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: "100%", backgroundColor: GameColors.background, borderRadius: moderateScale(16), padding: moderateScale(12) },
  prompt: { fontSize: moderateScale(18), fontWeight: "800", color: GameColors.text, textAlign: "center", minHeight: moderateScale(28) },
  board: { width: "100%", overflow: "hidden" },
  token: { position: "absolute", left: 0, top: 0, alignItems: "center", justifyContent: "center" },
  tokenShape: { borderRadius: moderateScale(8) },
  tokenText: { fontWeight: "800", textAlign: "center" },
  resultHost: { minHeight: moderateScale(28), justifyContent: "center" },
  result: { fontSize: moderateScale(18), fontWeight: "800", color: GameColors.primary, textAlign: "center" },
});
