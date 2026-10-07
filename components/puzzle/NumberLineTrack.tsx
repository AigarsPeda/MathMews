import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

type NumberLineTrackProps = {
  min: number;
  max: number;
  start: number;
  value: number;
  onSelect?: (value: number) => void;
  disabled?: boolean;
  correctValue?: number;
  wrongValue?: number;
  /** Practice examples fit on screen and draw each completed one-number hop. */
  fit?: boolean;
  hops?: number;
  direction?: number;
};

const LINE_Y = moderateScale(74);
const HEIGHT = moderateScale(152);
const DOT_SIZE = moderateScale(26);
const BOUNCE_HEIGHT = moderateScale(22);

export function NumberLineTrack({
  min, max, start, value, onSelect, disabled = false,
  correctValue, wrongValue, fit = false, hops = 0, direction = 1,
}: NumberLineTrackProps) {
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const centered = useRef(false);
  const count = max - min + 1;
  const available = Math.max(1, Math.floor(viewport / moderateScale(44)));
  const visibleCount = Math.min(count, available % 2 === 0 ? available - 1 : available);
  const spacing = viewport > 0 ? viewport / (fit ? count : visibleCount) : moderateScale(56);
  const width = spacing * count;
  const targetX = (value - min + 0.5) * spacing - DOT_SIZE / 2;
  const position = useSharedValue(targetX);
  const bounce = useSharedValue(1);
  const previousValue = useRef(value);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const oneStep = Math.abs(value - previousValue.current) === 1;
    previousValue.current = value;
    if (reducedMotion || !oneStep) {
      position.value = targetX;
      bounce.value = 1;
    } else {
      bounce.value = 0;
      bounce.value = withTiming(1, { duration: 600 });
      position.value = withTiming(targetX, { duration: 600 });
    }
  }, [value, targetX, position, bounce, reducedMotion]);

  const markerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value },
      { translateY: -Math.sin(bounce.value * Math.PI) * BOUNCE_HEIGHT },
    ],
  }));

  useEffect(() => {
    if (fit || viewport === 0 || contentWidth === 0) return;
    const x = Math.max(0, Math.min(width - viewport, targetX + DOT_SIZE / 2 - viewport / 2));
    scroll.current?.scrollTo({ x, animated: centered.current && !reducedMotion });
    centered.current = true;
  }, [contentWidth, fit, reducedMotion, targetX, viewport, width]);

  const paths = useMemo(() => {
    const line = Skia.Path.Make();
    line.moveTo(spacing / 2, LINE_Y);
    line.lineTo(width - spacing / 2, LINE_Y);
    for (let index = 0; index < count; index++) {
      const x = (index + 0.5) * spacing;
      line.moveTo(x, LINE_Y - moderateScale(6));
      line.lineTo(x, LINE_Y + moderateScale(8));
    }
    const jumps = Array.from({ length: hops }, (_, index) => {
      const from = (start - min + direction * index + 0.5) * spacing;
      const to = from + direction * spacing;
      const y = LINE_Y - moderateScale(10);
      const arc = Skia.Path.Make();
      arc.moveTo(from, y);
      arc.quadTo((from + to) / 2, y - moderateScale(48), to, y);
      const head = Skia.Path.Make();
      head.moveTo(to, y);
      head.lineTo(to - direction * moderateScale(10), y - moderateScale(6));
      head.lineTo(to - direction * moderateScale(2), y - moderateScale(13));
      head.close();
      return { arc, head, midpoint: (from + to) / 2 };
    });
    return { line, jumps };
  }, [count, direction, hops, min, spacing, start, width]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      scrollEnabled={!fit}
      showsHorizontalScrollIndicator={!fit}
      onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
      onContentSizeChange={(nextWidth) => setContentWidth(nextWidth)}
      style={styles.viewport}
    >
      <View style={{ width, height: HEIGHT }}>
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Path path={paths.line} color={GameColors.textMuted} style="stroke" strokeWidth={2} />
          {paths.jumps.map(({ arc }, index) => (
            <Path key={`arc-${index}`} path={arc} color={GameColors.primary} style="stroke" strokeWidth={3} />
          ))}
          {paths.jumps.map(({ head }, index) => (
            <Path key={`head-${index}`} path={head} color={GameColors.primary} />
          ))}
        </Canvas>
        {paths.jumps.map(({ midpoint }, index) => (
          <Text key={index} style={[styles.hopNumber, { left: midpoint - moderateScale(12) }]}>
            {index + 1}
          </Text>
        ))}
        <Animated.View pointerEvents="none" style={[styles.marker, markerStyle]}>
          <View style={styles.markerDot} />
        </Animated.View>
        <View style={styles.numbers}>
          {Array.from({ length: count }, (_, index) => {
            const number = min + index;
            const isCurrent = number === value;
            return (
              <Pressable
                key={number}
                disabled={disabled || !onSelect}
                accessible={Boolean(onSelect)}
                accessibilityRole="button"
                accessibilityLabel={t("puzzleTypes.numberLineTickA11y", { value: number })}
                accessibilityState={{ selected: isCurrent }}
                onPress={() => onSelect?.(number)}
                style={[styles.numberTarget, { width: spacing }]}
              >
                <Text style={[
                  styles.number,
                  isCurrent && styles.currentNumber,
                  number === correctValue && styles.correctNumber,
                  number === wrongValue && styles.wrongNumber,
                ]}>{number}</Text>
                {number === start ? <Text style={styles.start}>{t("puzzleTypes.startAt")}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: { width: "100%", height: HEIGHT, flexGrow: 0 },
  marker: {
    position: "absolute", top: LINE_Y - DOT_SIZE / 2, left: 0,
    width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2,
    backgroundColor: "#FFFFFF", borderColor: GameColors.primary, borderWidth: 3,
    alignItems: "center", justifyContent: "center",
  },
  markerDot: { width: moderateScale(12), height: moderateScale(12), borderRadius: moderateScale(6), backgroundColor: GameColors.primary },
  hopNumber: {
    position: "absolute", top: moderateScale(18), width: moderateScale(24),
    textAlign: "center", fontSize: moderateScale(18), fontWeight: "800", color: GameColors.primary,
  },
  numbers: { position: "absolute", top: LINE_Y + moderateScale(12), flexDirection: "row" },
  numberTarget: { minHeight: moderateScale(54), alignItems: "center", justifyContent: "flex-start" },
  number: { fontSize: moderateScale(19), lineHeight: moderateScale(28), fontWeight: "700", color: GameColors.text },
  currentNumber: { color: GameColors.primary, backgroundColor: GameColors.background, borderRadius: moderateScale(8), paddingHorizontal: moderateScale(6) },
  correctNumber: { color: GameColors.success },
  wrongNumber: { color: GameColors.primaryDark },
  start: { fontSize: moderateScale(9), lineHeight: moderateScale(14), fontWeight: "800", color: GameColors.textMuted, textTransform: "uppercase" },
});
