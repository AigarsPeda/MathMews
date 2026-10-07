import { IconText } from "@/components/ui/IconText";
import { GameColors } from "@/constants/game";
import type { PracticeToken } from "@/types/visual-explanation";
import { moderateScale } from "@/utils/scale";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

type PracticeScene = { prompt: string; tokens: PracticeToken[]; result?: string };

function MovingToken({ token, ratio, delay }: { token: PracticeToken; ratio: number; delay: number }) {
  const reducedMotion = useReducedMotion();
  const x = useSharedValue(token.x);
  const y = useSharedValue(token.y);
  const opacity = useSharedValue(token.visible === false ? 0 : 1);
  const scale = useSharedValue(token.scale ?? 1);
  const fill = useSharedValue(token.tone === "muted" ? 0 : 1);
  const lane = useSharedValue(0);
  const previousX = useRef(token.x);
  useEffect(() => {
    const duration = reducedMotion ? 0 : 600;
    const wait = reducedMotion ? 0 : delay;
    x.value = withDelay(wait, withTiming(token.x, { duration }));
    y.value = withDelay(wait, withTiming(token.y, { duration }));
    opacity.value = withDelay(wait, withTiming(token.visible === false ? 0 : 1, { duration }));
    scale.value = withTiming(token.scale ?? 1, { duration });
    fill.value = withDelay(wait, withTiming(token.tone === "muted" ? 0 : 1, { duration }));
    if (token.arc && previousX.current !== token.x) {
      lane.value = withDelay(wait, withSequence(
        withTiming(reducedMotion ? 0 : token.arc, { duration: duration / 2 }),
        withTiming(0, { duration: duration / 2 }),
      ));
    }
    previousX.current = token.x;
  }, [token.x, token.y, token.visible, token.scale, token.tone, token.arc, reducedMotion, delay, x, y, opacity, scale, fill, lane]);
  const movingStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value * ratio }, { translateY: (y.value + lane.value) * ratio }, { scale: scale.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value * (token.shape === "part" ? 1 : .16) }));
  const plain = token.shape === "plain";
  const size = (token.width ?? (plain ? Math.max(40, token.label.length * 14) : 40)) * ratio;
  const color = token.tone === "primary" ? GameColors.primary : GameColors.secondary;
  return (
    <Animated.View
      accessible={token.visible !== false && token.label.length > 0}
      accessibilityLabel={token.label}
      accessibilityElementsHidden={token.visible === false}
      importantForAccessibility={token.visible === false ? "no-hide-descendants" : "auto"}
      style={[
        styles.token,
        { width: size, height: 36 * ratio, marginLeft: -size / 2, marginTop: -18 * ratio },
        movingStyle,
      ]}
    >
      {token.shape && !plain ? (
        <View style={[StyleSheet.absoluteFill, styles.tokenShape, { backgroundColor: GameColors.cardBorder }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.tokenShape, { backgroundColor: color }, fillStyle]} />
        </View>
      ) : null}
      <Animated.View key={token.label} entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)}>
        <IconText style={[
          styles.tokenText,
          { fontSize: (plain ? 21 : 25) * ratio, color: token.tone === "primary" ? GameColors.primary : GameColors.text },
        ]}>
          {token.label}
        </IconText>
      </Animated.View>
    </Animated.View>
  );
}

export function VisualPracticeBoard({ prompt, tokens, result }: PracticeScene) {
  const [width, setWidth] = useState(0);
  const ratio = width / 300;
  return (
    <View style={styles.stage}>
      <Text style={styles.prompt}>{prompt}</Text>
      <View style={styles.board} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? tokens.map((token, i) => (
          <MovingToken key={token.id} token={token} ratio={ratio} delay={Math.min(i, 5) * 55} />
        )) : null}
      </View>
      <View style={styles.resultHost}>
        {result ? (
          <Animated.Text key={result} entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
            style={styles.result} accessibilityLiveRegion="polite">
            {result}
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: "100%", backgroundColor: GameColors.background, borderRadius: moderateScale(16), padding: moderateScale(12) },
  prompt: { fontSize: moderateScale(18), fontWeight: "800", color: GameColors.text, textAlign: "center", minHeight: moderateScale(28) },
  board: { width: "100%", aspectRatio: 300 / 140, overflow: "hidden" },
  token: { position: "absolute", left: 0, top: 0, alignItems: "center", justifyContent: "center" },
  tokenShape: { borderRadius: moderateScale(8) },
  tokenText: { fontWeight: "800", textAlign: "center" },
  resultHost: { minHeight: moderateScale(28), justifyContent: "center" },
  result: { fontSize: moderateScale(18), fontWeight: "800", color: GameColors.primary, textAlign: "center" },
});
