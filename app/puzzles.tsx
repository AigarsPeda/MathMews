import { DifficultyPicker } from "@/components/puzzle/DifficultyPicker";
import { LearningLevelCard } from "@/components/puzzle/LearningLevelCard";
import { LessonListItem } from "@/components/puzzle/LessonListItem";
import { PuzzlePathItem } from "@/components/puzzle/PuzzlePathItem";
import { AppIcon } from "@/components/ui/AppIcon";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { IconText as Text } from "@/components/ui/IconText";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  getLearningLesson, getLearningLevelState, getLearningProgress, getLearningTopics,
  getLevelPuzzles, getPracticeIds, getRequiredIds, getTopicLessons, getTopicProgress, isLessonAvailable,
} from "@/constants/curriculum";
import { GameColors } from "@/constants/game";
import { isPuzzleDifficulty } from "@/constants/puzzles";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import { AchievementsLink } from "@/components/puzzle/AchievementsLink";
import type { LearningLevel } from "@/types/curriculum";
import type { PuzzleDifficulty } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PuzzlesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ difficulty?: string; topic?: string; lesson?: string }>();
  const { isReady, hasCompletedOnboarding, progress } = useGame();
  const difficulty: PuzzleDifficulty = isPuzzleDifficulty(params.difficulty ?? "") ? params.difficulty as PuzzleDifficulty : "easy";
  const topics = getLearningTopics(difficulty);
  const topic = topics.find(item => item.id === params.topic);
  const lesson = getLearningLesson(difficulty, params.lesson);
  const completed = progress.completedPuzzleIds ?? [];
  const lessons = topic ? getTopicLessons(difficulty, topic.id) : [];
  const practiceComplete = lesson ? getLearningProgress(getPracticeIds(lesson), completed).complete : false;
  const scopeProgress = lesson ? getLearningProgress(getRequiredIds(lesson), completed)
    : topic ? getTopicProgress(difficulty, topic.id, completed) : null;
  const title = lesson?.title[locale] ?? topic?.title[locale] ?? t("learning.chooseTopic");
  const description = lesson?.description[locale] ?? topic?.description[locale] ?? t("learning.topicIntro");
  const availableLevels = lesson?.levels.filter(level => getLearningLevelState(lesson, level, completed) === "current");
  const firstAvailable = availableLevels?.find(level => level.kind === "practice")
    ?? availableLevels?.find(level => level.kind === "boss") ?? availableLevels?.[0];

  function navigate(topicId?: string, lessonId?: string, tier = difficulty) {
    router.push({ pathname: "/puzzles", params: { difficulty: tier, ...(topicId && { topic: topicId }), ...(lessonId && { lesson: lessonId }) } });
  }
  function back() {
    if (router.canGoBack()) { router.back(); return; }
    if (lesson && topic) router.replace({ pathname: "/puzzles", params: { difficulty, topic: topic.id } });
    else if (topic) router.replace({ pathname: "/puzzles", params: { difficulty } });
    else router.replace("/");
  }
  function play(level: LearningLevel) {
    if (!lesson || getLearningLevelState(lesson, level, completed) === "locked") return;
    router.push({ pathname: "/play", params: { difficulty, lesson: lesson.id, level: level.id } });
  }

  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;
  if ((params.topic && !topic) || (params.lesson && (!lesson || lesson.topicId !== topic?.id || !isLessonAvailable(lesson, completed)))) {
    return <Redirect href={{ pathname: "/puzzles", params: { difficulty, ...(topic && { topic: topic.id }) } }} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel={t("puzzlePath.a11yBack")}>
            <BackButtonLabel style={styles.backText} />
          </Pressable>
          {!topic && <AchievementsLink />}
        </View>
        {!topic && <DifficultyPicker selected={difficulty} onSelect={tier => {
          router.replace({ pathname: "/puzzles", params: { difficulty: tier } });
        }} />}
        <ScrollView key={`${difficulty}-${topic?.id}-${lesson?.id}`} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {topic && <Text style={styles.location}>{[t(`difficulty.${difficulty}`), ...(lesson ? [topic.title[locale]] : [])].join(" / ")}</Text>}
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {scopeProgress && <View style={styles.scopeProgress} accessible accessibilityLabel={t("learning.requiredProgress", { count: scopeProgress.solved, total: scopeProgress.total })}>
            {lesson ? <Text style={styles.progressText}>{t("learning.requiredProgress", { count: scopeProgress.solved, total: scopeProgress.total })}</Text>
              : <View style={styles.row}><Text style={styles.progressText}>{t("lessonProgress.requiredTasks")}</Text><Text style={styles.progressText}>{scopeProgress.solved}/{scopeProgress.total}</Text></View>}
            <ProgressBar progress={scopeProgress.total ? scopeProgress.solved / scopeProgress.total : 0} fillColor={GameColors.success} trackColor={GameColors.cardBorder} />
          </View>}

          {!topic && topics.map(item => {
            const status = getTopicProgress(difficulty, item.id, completed);
            const topicLessons = getTopicLessons(difficulty, item.id);
            return <Pressable key={item.id} onPress={() => navigate(item.id)} style={styles.topic} accessibilityRole="button"
              accessibilityLabel={`${item.title[locale]}. ${t("learning.lessonsCount", { count: topicLessons.length })}. ${t("learning.requiredProgress", { count: status.solved, total: status.total })}`}>
              <View style={styles.topicHeading}>
                <AppIcon name={item.icon} size={moderateScale(38)} />
                <Text style={styles.topicTitle}>{item.title[locale]}</Text>
                <AppIcon name={status.complete ? "check" : "chevron-right"} size={moderateScale(22)} />
              </View>
              <Text style={styles.description}>{item.description[locale]}</Text>
              <View style={styles.row}>
                <Text style={styles.progressText}>{t("learning.lessonsCount", { count: topicLessons.length })}</Text>
                <Text style={styles.progressText}>{status.solved} / {status.total}</Text>
              </View>
              <ProgressBar progress={status.total ? status.solved / status.total : 0} fillColor={GameColors.success} />
            </Pressable>;
          })}

          {topic && !lesson && lessons.map((item, index) => <LessonListItem key={item.id} lesson={item} number={index + 1}
            progress={progress} onPress={() => navigate(topic.id, item.id)} />)}

          {lesson && lesson.levels.map((level, index) => {
            const state = getLearningLevelState(lesson, level, completed);
            if (level.kind !== "practice") return <LearningLevelCard key={level.id} level={level} state={state} completedIds={completed} onPress={() => play(level)} />;
            return <PuzzlePathItem key={level.id} puzzle={getLevelPuzzles(locale, lesson, level)[0]} puzzleNumber={index + 1}
              state={state} lockedMessage={t("learning.puzzleLocked")} onPress={() => play(level)} />;
          })}
          {lesson && practiceComplete && <View style={styles.completion}>
            <AppIcon name={scopeProgress?.complete ? "check" : "paw"} size={moderateScale(30)} />
            <Text style={styles.lessonTitle}>{t(scopeProgress?.complete ? "learning.lessonComplete" : "learning.practiceComplete")}</Text>
            <Text style={styles.description}>{t(scopeProgress?.complete ? "learning.bonusOptional" : "learning.bossRequired")}</Text>
            <Pressable onPress={() => navigate(topic!.id)} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.backText}>{t("learning.chooseLesson")}</Text>
            </Pressable>
          </View>}
          {!topic && <Pressable onPress={() => router.push("/stats")} style={styles.secondary} accessibilityRole="button"><Text style={styles.backText}>{t("stats.title")}</Text></Pressable>}
        </ScrollView>
        {lesson && firstAvailable && <Pressable onPress={() => play(firstAvailable)} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>{firstAvailable.kind === "practice" ? t("learning.continueLesson") : t(`learning.start_${firstAvailable.kind}`)}</Text>
        </Pressable>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GameColors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: GameColors.background },
  screen: { flex: 1, paddingHorizontal: moderateScale(16), gap: moderateScale(12), paddingBottom: moderateScale(8) },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { minHeight: moderateScale(48), justifyContent: "center", paddingRight: moderateScale(12) },
  backText: { fontSize: moderateScale(16), fontWeight: "700", color: GameColors.text },
  scroll: { flex: 1 }, content: { paddingBottom: moderateScale(24), gap: moderateScale(14) },
  location: { fontSize: moderateScale(14), color: GameColors.textMuted },
  title: { fontSize: moderateScale(26), fontWeight: "800", color: GameColors.text },
  description: { fontSize: moderateScale(15), lineHeight: moderateScale(22), color: GameColors.textMuted },
  scopeProgress: { gap: moderateScale(8), paddingVertical: moderateScale(8) },
  progressText: { fontSize: moderateScale(14), color: GameColors.textMuted, fontWeight: "600" },
  topic: { padding: moderateScale(16), gap: moderateScale(10), backgroundColor: GameColors.card, borderWidth: 2, borderColor: GameColors.cardBorder, borderRadius: moderateScale(16) },
  topicHeading: { flexDirection: "row", gap: moderateScale(12), alignItems: "center" },
  topicTitle: { flex: 1, fontSize: moderateScale(20), fontWeight: "800", color: GameColors.text },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: moderateScale(12) },
  lessonTitle: { flexShrink: 1, fontSize: moderateScale(19), fontWeight: "800", color: GameColors.text },
  completion: { alignItems: "center", padding: moderateScale(20), gap: moderateScale(12), backgroundColor: "#E8FAF8", borderRadius: moderateScale(16) },
  primary: { minHeight: moderateScale(54), alignItems: "center", justifyContent: "center", backgroundColor: GameColors.primary, borderRadius: moderateScale(16), padding: moderateScale(14) },
  primaryText: { fontSize: moderateScale(17), fontWeight: "800", color: GameColors.card, textAlign: "center" },
  secondary: { minHeight: moderateScale(48), alignItems: "center", justifyContent: "center", padding: moderateScale(12) },
});
