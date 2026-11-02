import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleGradient } from "@/components/puzzle/PuzzleGradient";
import { getPathProgress, isPathAvailable } from "@/constants/puzzle-path";
import { useLocale } from "@/contexts/LocaleProvider";
import { TopicPathColors } from "@/constants/puzzle-theme";
import type { LearningLesson } from "@/types/curriculum";
import type { Progress } from "@/types/game";
import { getTopicPathConnection, getTopicPathLayout, getTopicPathCallout } from "@/utils/topic-path-layout";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { Feather } from "@expo/vector-icons";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedReaction, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

export function TopicLevelPath({ lessons, progress, currentLessonId, onPlay, scrollOffset, viewportHeight }: {
  scrollOffset: SharedValue<number>; viewportHeight: SharedValue<number>;
  lessons: LearningLesson[]; progress: Progress; currentLessonId?: string; onPlay: (lesson: LearningLesson) => void;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { active, reduceMotion } = useAnimationActivity();
  const [width, setWidth] = useState(0);
  const currentIndex = lessons.findIndex(lesson => lesson.id === currentLessonId);
  const { points, height, finish, connections } = useMemo(() => {
    const layout = getTopicPathLayout(width, lessons.length, currentIndex);
    const destinations = [...layout.points.slice(1), ...(layout.finish ? [layout.finish] : [])];
    const connections = destinations.map((point, index) => {
      return Skia.Path.MakeFromSVGString(getTopicPathConnection(width, layout.points[index], point))!;
    });
    return { ...layout, connections };
  }, [width, lessons.length, currentIndex]);
  return <View style={styles.container} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {width > 0 ? <View style={{ height }}>
      <Canvas pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        {connections.map((path, index) => <Path key={lessons[index].id} path={path} style="stroke" strokeWidth={4}
          color={getPathProgress(lessons[index], progress).complete ? TopicPathColors.completedConnection : TopicPathColors.connection} strokeCap="round" />)}
      </Canvas>
      {currentIndex >= 0 ? <View pointerEvents="none">
        <View style={[styles.startTag, { left: points[currentIndex].x - 68, top: points[currentIndex].y - points[currentIndex].radius - 36 }]}>
          <Text style={styles.startText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9} maxFontSizeMultiplier={1.2}>{t(getPathProgress(lessons[currentIndex], progress).complete ? "puzzlePathDesign.replay"
            : getPathProgress(lessons[currentIndex], progress).solved > 0 ? "puzzlePathDesign.continueHere" : "puzzlePathDesign.startHere")}</Text>
          <Feather name="corner-right-down" size={17} color={TopicPathColors.calloutText} />
        </View>
        <View style={[styles.lessonCallout, getTopicPathCallout(width, points[currentIndex])]}>
          <Text style={styles.lessonTitle} numberOfLines={4} maxFontSizeMultiplier={1.4}>{lessons[currentIndex].title[locale]}</Text>
        </View>
      </View> : null}
      {finish ? <View accessible accessibilityRole="text" testID="topic-trail-finish"
        accessibilityLabel={t(lessons.every(lesson => getPathProgress(lesson, progress).complete)
          ? "puzzlePathDesign.topicComplete" : "puzzlePathDesign.finishLine")}
        style={[styles.finish, { left: finish.x - 100, top: finish.y + 12 }]}>
        <Text style={styles.finishLabel} numberOfLines={2} maxFontSizeMultiplier={1.3}>{t(lessons.every(lesson => getPathProgress(lesson, progress).complete)
          ? "puzzlePathDesign.topicComplete" : "puzzlePathDesign.finishLine")}</Text>
      </View> : null}
      {lessons.map((lesson, index) => {
        const count = getPathProgress(lesson, progress);
        const state = count.complete ? "completed" : isPathAvailable(lesson, progress) ? "current" : "locked";
        const isCurrent = index === currentIndex;
        const palette = isCurrent ? TopicPathColors.current : state === "locked" ? TopicPathColors.locked : TopicPathColors.completed;
        const point = points[index];
        return <Pressable key={lesson.id} disabled={state === "locked"} onPress={() => onPlay(lesson)}
          accessibilityRole="button" accessibilityState={{ disabled: state === "locked", selected: isCurrent }}
          accessibilityLabel={t("puzzlePathDesign.level", { number: index + 1 })}
          accessibilityHint={`${lesson.title[locale]}. ${t(`puzzlePathDesign.level_${state}`)}`}
          accessibilityValue={{ text: t("puzzlePathDesign.progress", { count: count.solved, total: count.total }) }}
          style={({ pressed }) => [styles.node, { width: point.diameter, height: point.diameter,
            left: point.x - point.diameter / 2, top: point.y - point.diameter / 2,
            backgroundColor: palette.edge }, pressed && styles.pressed]}>
          {isCurrent ? <CurrentLevelHalo point={point} scrollOffset={scrollOffset} viewportHeight={viewportHeight}
            active={active} reduceMotion={reduceMotion} /> : null}
          <View pointerEvents="none" style={[styles.face, { backgroundColor: palette.face, borderColor: palette.border }]}>
            <PuzzleGradient colors={[palette.top, palette.face]} />
            <View style={[styles.inset, { borderColor: palette.inset }]} />
            {state === "locked" ? <View style={styles.lock} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Feather name="lock" size={13} color={palette.text} />
            </View> : null}
            <Text style={[styles.number, isCurrent && styles.currentNumber, { color: palette.text }]}>{index + 1}</Text>
          </View>
          {state === "completed" ? <View style={styles.completedBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Feather name="check" size={18} color="#FFFFFF" />
          </View> : null}
        </Pressable>;
      })}
    </View> : null}
  </View>;
}
function CurrentLevelHalo({ point, scrollOffset, viewportHeight, active, reduceMotion }: {
  point: ReturnType<typeof getTopicPathLayout>["points"][number];
  scrollOffset: SharedValue<number>; viewportHeight: SharedValue<number>; active: boolean; reduceMotion: boolean;
}) {
  const breath = useSharedValue(0);
  useAnimatedReaction(() => {
    const top = scrollOffset.get();
    const height = viewportHeight.get();
    return active && !reduceMotion && height > 0
      && point.y + point.radius >= top && point.y - point.radius <= top + height;
  }, (visible, previouslyVisible) => {
    if (visible === previouslyVisible) return;
    cancelAnimation(breath);
    breath.set(0);
    if (visible) breath.set(withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }),
      -1, true, undefined, ReduceMotion.System,
    ));
  }, [active, reduceMotion, point.y, point.radius]);
  useEffect(() => () => cancelAnimation(breath), [breath]);
  const pulse = useAnimatedStyle(() => ({
    opacity: active && !reduceMotion ? 0.12 + breath.get() * 0.28 : 0,
    transform: [{ scale: 0.94 + breath.get() * 0.06 }],
  }));
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <View style={styles.ring} />
    <Animated.View style={[styles.ring, styles.pulseRing, pulse]} />
  </View>;
}
const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 460, alignSelf: "center" },
  node: { position: "absolute", borderRadius: 25, paddingBottom: 5,
    shadowColor: "#665C50", shadowOpacity: 0.17, shadowRadius: 9, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  face: { flex: 1, borderRadius: 25, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  inset: { position: "absolute", top: 7, right: 7, bottom: 7, left: 7, borderRadius: 19, borderWidth: 1 },
  ring: { position: "absolute", top: -8, right: -8, bottom: -8, left: -8, borderRadius: 33, borderWidth: 6, borderColor: TopicPathColors.halo },
  pulseRing: { borderWidth: 3, borderColor: TopicPathColors.current.face },
  startTag: { position: "absolute", minHeight: 28, width: 136, flexDirection: "row", gap: 5,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 14, backgroundColor: TopicPathColors.calloutSurface },
  startText: { fontSize: 14, fontWeight: "800", color: TopicPathColors.calloutText, flexShrink: 1 },
  lessonCallout: { position: "absolute", justifyContent: "center" },
  lessonTitle: { fontSize: 17, lineHeight: 22, fontWeight: "900", color: TopicPathColors.text },
  completedBadge: { position: "absolute", top: -7, right: -5, width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", backgroundColor: TopicPathColors.check,
    borderWidth: 2, borderColor: TopicPathColors.checkBorder,
    shadowColor: "#3D6651", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  finish: { position: "absolute", width: 200, alignItems: "center", gap: 4 },
  finishLabel: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: TopicPathColors.textMuted, textAlign: "center" },
  lock: { position: "absolute", right: 8, top: 8 },
  number: { fontSize: 34, fontWeight: "800" },
  currentNumber: { fontSize: 40 },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
});
