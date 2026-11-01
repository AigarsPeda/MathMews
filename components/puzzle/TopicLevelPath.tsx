import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { getPathProgress, isPathAvailable } from "@/constants/puzzle-path";
import { PuzzleColors } from "@/constants/puzzle-theme";
import type { LearningLesson } from "@/types/curriculum";
import type { Progress } from "@/types/game";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

const cells = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2], [2, 3]];
const colors = {
  completed: { face: "#DDF4C8", edge: "#BED9A4", text: "#347322" },
  locked: { face: "#EFF0F6", edge: "#D8DDE7", text: "#6B7285" },
  finish: { face: "#FFF1B7", edge: "#E6CE7E", text: "#765207" },
  current: { face: PuzzleColors.primary, edge: PuzzleColors.primaryDark, text: "#FFFFFF" },
};

export function TopicLevelPath({ lessons, progress, currentLessonId, onPlay }: {
  lessons: LearningLesson[]; progress: Progress; currentLessonId?: string; onPlay: (lesson: LearningLesson) => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const diameter = Math.min(82, width * 0.24);
  const inset = diameter / 2 + 10;
  const column = (width - inset * 2) / 2;
  const row = diameter + 28;
  const points = lessons.map((_, index) => cells[index]).map(([x, y]) => ({ x: inset + x * column, y: diameter / 2 + 12 + y * row }));
  return <View style={styles.container} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {width > 0 ? <View style={{ height: row * 3 + diameter + 28 }}>
      {points.slice(1).map((point, index) => {
        const previous = points[index];
        return <View key={`line-${index}`} pointerEvents="none" style={[styles.line, {
          left: Math.min(point.x, previous.x) - 2, top: Math.min(point.y, previous.y) - 2,
          width: Math.max(4, Math.abs(point.x - previous.x) + 4), height: Math.max(4, Math.abs(point.y - previous.y) + 4),
        }]} />;
      })}
      {lessons.map((lesson, index) => {
        const count = getPathProgress(lesson, progress);
        const state = count.complete ? "completed" : isPathAvailable(lesson, progress) ? "current" : "locked";
        const isCurrent = lesson.id === currentLessonId;
        const palette = state === "completed" ? colors.completed : isCurrent ? colors.current
          : index === lessons.length - 1 ? colors.finish : colors.locked;
        return <Pressable key={lesson.id} disabled={state === "locked"} onPress={() => onPlay(lesson)}
          accessibilityRole="button" accessibilityState={{ disabled: state === "locked", selected: isCurrent }}
          accessibilityLabel={t("puzzlePathDesign.level", { number: index + 1 })}
          accessibilityHint={t(`puzzlePathDesign.level_${state}`)}
          accessibilityValue={{ text: t("puzzlePathDesign.progress", { count: count.solved, total: count.total }) }}
          style={({ pressed }) => [styles.node, { width: diameter, height: diameter, borderRadius: diameter / 2,
            left: points[index].x - diameter / 2, top: points[index].y - diameter / 2,
            backgroundColor: palette.face, borderBottomColor: palette.edge }, pressed && styles.pressed]}>
          {isCurrent ? <View pointerEvents="none" style={[styles.ring, { borderRadius: diameter }]} /> : null}
          <Text style={[styles.number, { color: palette.text }]}>{index + 1}</Text>
        </Pressable>;
      })}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 460, alignSelf: "center" },
  line: { position: "absolute", backgroundColor: "#D7E4DD", borderRadius: 2 },
  node: { position: "absolute", alignItems: "center", justifyContent: "center", borderBottomWidth: 6 },
  ring: { position: "absolute", top: -11, right: -11, bottom: -17, left: -11, borderWidth: 5, borderColor: "#FFF0F6" },
  number: { fontSize: 28, fontWeight: "900" },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
});
