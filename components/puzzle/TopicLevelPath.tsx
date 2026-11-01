import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { getPathProgress, isPathAvailable } from "@/constants/puzzle-path";
import { PuzzleColors } from "@/constants/puzzle-theme";
import type { LearningLesson } from "@/types/curriculum";
import type { Progress } from "@/types/game";
import { getTopicPathLayout } from "@/utils/topic-path-layout";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

const colors = {
  completed: { face: "#DDF4C8", edge: "#BED9A4", text: "#347322" },
  locked: { face: "#EFF0F6", edge: "#D8DDE7", text: "#6B7285" },
  current: { face: PuzzleColors.primary, edge: PuzzleColors.primaryDark, text: "#FFFFFF" },
};

export function TopicLevelPath({ lessons, progress, currentLessonId, onPlay }: {
  lessons: LearningLesson[]; progress: Progress; currentLessonId?: string; onPlay: (lesson: LearningLesson) => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const currentIndex = lessons.findIndex(lesson => lesson.id === currentLessonId);
  const { points, height, connections } = useMemo(() => {
    const layout = getTopicPathLayout(width, lessons.length, currentIndex);
    const connections = layout.points.slice(1).map((point, index) => {
      const previous = layout.points[index];
      const middleY = (previous.y + point.y) / 2;
      const path = Skia.Path.Make();
      path.moveTo(previous.x, previous.y);
      path.cubicTo(previous.x, middleY, point.x, middleY, point.x, point.y);
      return path;
    });
    return { ...layout, connections };
  }, [width, lessons.length, currentIndex]);
  return <View style={styles.container} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {width > 0 ? <View style={{ height }}>
      <Canvas pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        {connections.map((path, index) => <Path key={lessons[index].id} path={path} style="stroke" strokeWidth={4}
          color={getPathProgress(lessons[index], progress).complete ? "#BED9A4" : "#DDE6E2"} strokeCap="round" />)}
      </Canvas>
      {lessons.map((lesson, index) => {
        const count = getPathProgress(lesson, progress);
        const state = count.complete ? "completed" : isPathAvailable(lesson, progress) ? "current" : "locked";
        const isCurrent = index === currentIndex;
        const palette = count.complete ? colors.completed : isCurrent ? colors.current : colors.locked;
        const point = points[index];
        return <Pressable key={lesson.id} disabled={state === "locked"} onPress={() => onPlay(lesson)}
          accessibilityRole="button" accessibilityState={{ disabled: state === "locked", selected: isCurrent }}
          accessibilityLabel={t("puzzlePathDesign.level", { number: index + 1 })}
          accessibilityHint={t(`puzzlePathDesign.level_${state}`)}
          accessibilityValue={{ text: t("puzzlePathDesign.progress", { count: count.solved, total: count.total }) }}
          style={({ pressed }) => [styles.node, { width: point.diameter, height: point.diameter, borderRadius: point.diameter / 2,
            left: point.x - point.diameter / 2, top: point.y - point.diameter / 2,
            backgroundColor: palette.face, borderBottomColor: palette.edge }, pressed && styles.pressed]}>
          {isCurrent ? <View pointerEvents="none" style={[styles.ring, { borderRadius: point.diameter }]} /> : null}
          <Text style={[styles.number, isCurrent && styles.currentNumber, { color: palette.text }]}>{index + 1}</Text>
        </Pressable>;
      })}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 460, alignSelf: "center" },
  node: { position: "absolute", alignItems: "center", justifyContent: "center", borderBottomWidth: 6 },
  ring: { position: "absolute", top: -12, right: -12, bottom: -18, left: -12, borderWidth: 4, borderColor: "#FFF0F6" },
  number: { fontSize: 26, fontWeight: "900" },
  currentNumber: { fontSize: 32 },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
});
