import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleGradient } from "@/components/puzzle/PuzzleGradient";
import { getPathProgress, isPathAvailable } from "@/constants/puzzle-path";
import { TopicPathColors } from "@/constants/puzzle-theme";
import type { LearningLesson } from "@/types/curriculum";
import type { Progress } from "@/types/game";
import { getTopicPathDecorations, getTopicPathLayout, getTopicSceneryOffset, getTopicSceneryShapes, getTopicSceneryOutline } from "@/utils/topic-path-layout";
import { Canvas, Group, Path, RoundedRect, Skia } from "@shopify/react-native-skia";
import { Feather } from "@expo/vector-icons";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

export function TopicLevelPath({ lessons, progress, currentLessonId, onPlay, scrollOffset, viewportHeight }: {
  scrollOffset: SharedValue<number>; viewportHeight: SharedValue<number>;
  lessons: LearningLesson[]; progress: Progress; currentLessonId?: string; onPlay: (lesson: LearningLesson) => void;
}) {
  const { t } = useTranslation();
  const { active, reduceMotion } = useAnimationActivity();
  const [width, setWidth] = useState(0);
  const currentIndex = lessons.findIndex(lesson => lesson.id === currentLessonId);
  const { points, height, connections, decorations } = useMemo(() => {
    const layout = getTopicPathLayout(width, lessons.length, currentIndex);
    const connections = layout.points.slice(1).map((point, index) => {
      const previous = layout.points[index];
      const middleY = (previous.y + point.y) / 2;
      const path = Skia.Path.Make();
      path.moveTo(previous.x, previous.y);
      path.cubicTo(previous.x, middleY, point.x, middleY, point.x, point.y);
      return path;
    });
    return { ...layout, connections, decorations: getTopicPathDecorations(width, layout.points, layout.height) };
  }, [width, lessons.length, currentIndex]);
  return <View style={styles.container} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {width > 0 ? <View style={{ height }}>
      <Canvas pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        {decorations.map(placement => <TrailMotif key={placement.index} placement={placement}
          scrollOffset={scrollOffset} viewportHeight={viewportHeight} reduceMotion={reduceMotion} />)}
        {connections.map((path, index) => <Path key={lessons[index].id} path={path} style="stroke" strokeWidth={2.5}
          color={getPathProgress(lessons[index], progress).complete ? TopicPathColors.completedConnection : TopicPathColors.connection} strokeCap="round" />)}
      </Canvas>
      {lessons.map((lesson, index) => {
        const count = getPathProgress(lesson, progress);
        const state = count.complete ? "completed" : isPathAvailable(lesson, progress) ? "current" : "locked";
        const isCurrent = index === currentIndex;
        const palette = isCurrent ? TopicPathColors.current : state === "locked" ? TopicPathColors.locked : TopicPathColors.completed;
        const point = points[index];
        return <Pressable key={lesson.id} disabled={state === "locked"} onPress={() => onPlay(lesson)}
          accessibilityRole="button" accessibilityState={{ disabled: state === "locked", selected: isCurrent }}
          accessibilityLabel={t("puzzlePathDesign.level", { number: index + 1 })}
          accessibilityHint={t(`puzzlePathDesign.level_${state}`)}
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
function TrailMotif({ placement, scrollOffset, viewportHeight, reduceMotion }: {
  placement: ReturnType<typeof getTopicPathDecorations>[number];
  scrollOffset: SharedValue<number>; viewportHeight: SharedValue<number>; reduceMotion: boolean;
}) {
  const shapes = useMemo(() => getTopicSceneryShapes(placement.index).map(shape => {
    const outline = getTopicSceneryOutline(shape);
    return { ...shape, path: outline ? Skia.Path.MakeFromSVGString(outline) : null };
  }), [placement.index]);
  const transform = useDerivedValue(() => [
    { translateX: placement.left },
    { translateY: placement.top + getTopicSceneryOffset(scrollOffset.get(), viewportHeight.get(),
      placement.top + placement.size / 2, reduceMotion) },
    { scale: placement.size / 100 },
  ]);
  return <Group transform={transform}>
    {shapes.map((shape, index) => shape.path
      ? <Path key={index} path={shape.path} style="stroke" strokeWidth={1.5} strokeJoin="round"
          color={TopicPathColors.scenery[shape.tone]} />
      : <RoundedRect key={index} x={shape.x} y={shape.y} width={shape.width} height={shape.height} r={shape.radius}
          style="stroke" strokeWidth={1.5} color={TopicPathColors.scenery[shape.tone]} />)}
  </Group>;
}
const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 460, alignSelf: "center" },
  node: { position: "absolute", borderRadius: 23, paddingBottom: 5 },
  face: { flex: 1, borderRadius: 23, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  inset: { position: "absolute", top: 6, right: 6, bottom: 6, left: 6, borderRadius: 17, borderWidth: 1 },
  ring: { position: "absolute", top: -8, right: -8, bottom: -8, left: -8, borderRadius: 31, borderWidth: 6, borderColor: TopicPathColors.halo },
  pulseRing: { borderWidth: 3, borderColor: TopicPathColors.current.face },
  lock: { position: "absolute", right: 8, top: 8 },
  number: { fontSize: 34, fontWeight: "800" },
  currentNumber: { fontSize: 40 },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
});
