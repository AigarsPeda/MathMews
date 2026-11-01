import { DifficultyPicker } from "@/components/puzzle/DifficultyPicker";
import { LearningLevelCard } from "@/components/puzzle/LearningLevelCard";
import { LessonListItem } from "@/components/puzzle/LessonListItem";
import { PuzzlePathItem } from "@/components/puzzle/PuzzlePathItem";
import { PuzzleButton } from "@/components/puzzle/PuzzleButton";
import { PuzzleGradient, PuzzleHeaderGlow } from "@/components/puzzle/PuzzleGradient";
import { getPuzzleRecommendation } from "@/utils/puzzle-recommendation";
import { useFonts } from "expo-font";
import { AppIcon } from "@/components/ui/AppIcon";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  getLearningLesson, getLearningLevelState, getLearningProgress, getLearningTopics,
  getLevelPuzzles, getPracticeIds, getRequiredIds, getTopicLessons, getTopicProgress, isLessonAvailable,
} from "@/constants/curriculum";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import { PuzzleFontAssets } from "@/constants/puzzle-fonts";
import { PUZZLE_DIFFICULTIES, isPuzzleDifficulty } from "@/constants/puzzles";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import { AchievementsLink } from "@/components/puzzle/AchievementsLink";
import type { LearningLevel } from "@/types/curriculum";
import type { PuzzleDifficulty } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { memo, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PuzzlesScreen() {
  const { isReady, hasCompletedOnboarding, progress } = useGame();
  const [fontsLoaded, fontError] = useFonts(PuzzleFontAssets);
  if (!fontsLoaded && !fontError) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  return <PuzzlesContent isReady={isReady} hasCompletedOnboarding={hasCompletedOnboarding} progress={progress} />;
}

const PuzzlesContent = memo(function PuzzlesContent({ isReady, hasCompletedOnboarding, progress }:
  Pick<ReturnType<typeof useGame>, 'isReady' | 'hasCompletedOnboarding' | 'progress'>) {
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ difficulty?: string; topic?: string; lesson?: string }>();
  const difficulty: PuzzleDifficulty = isPuzzleDifficulty(params.difficulty ?? "") ? params.difficulty as PuzzleDifficulty : "easy";
  const previousDifficulty = useRef(difficulty);
  const reduceMotion = useReducedMotion();
  const contentOpacity = useSharedValue(1);
  const contentOffset = useSharedValue(0);
  useLayoutEffect(() => {
    const previous = previousDifficulty.current;
    previousDifficulty.current = difficulty;
    if (previous === difficulty || params.topic || reduceMotion) return;
    const direction = PUZZLE_DIFFICULTIES.indexOf(difficulty) > PUZZLE_DIFFICULTIES.indexOf(previous) ? 1 : -1;
    contentOpacity.set(0.15);
    contentOffset.set(direction * moderateScale(14));
    const timing = { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
    contentOpacity.set(withTiming(1, timing));
    contentOffset.set(withTiming(0, timing));
  }, [difficulty, params.topic, reduceMotion, contentOpacity, contentOffset]);
  const selectionStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.get(), transform: [{ translateX: contentOffset.get() }] }));
  const topics = getLearningTopics(difficulty);
  const topic = topics.find(item => item.id === params.topic);
  const lesson = getLearningLesson(difficulty, params.lesson);
  const completed = progress.completedPuzzleIds ?? [];
  const lessons = topic ? getTopicLessons(difficulty, topic.id) : [];
  const practiceComplete = lesson ? getLearningProgress(getPracticeIds(lesson), completed).complete : false;
  const scopeProgress = lesson ? getLearningProgress(getRequiredIds(lesson), completed)
    : topic ? getTopicProgress(difficulty, topic.id, completed) : null;
  const title = lesson?.title[locale] ?? topic?.title[locale] ?? t("puzzleDesign.letsPlay");
  const recommendation = !topic ? getPuzzleRecommendation(difficulty, progress) : undefined;
  const recommendedProgress = recommendation ? getLearningProgress(getRequiredIds(recommendation.lesson), completed) : undefined;
  const hasStarted = recommendation?.lesson.levels.some(level => level.puzzleIds.some(id => completed.includes(id)
    || progress.attemptedPuzzleIds?.includes(id)));
  const description = lesson?.description[locale] ?? topic?.description[locale];
  const availableLevels = lesson?.levels.filter(level => getLearningLevelState(lesson, level, completed) === "current");
  const firstAvailable = availableLevels?.find(level => level.kind === "practice")
    ?? availableLevels?.find(level => level.kind === "challenge") ?? availableLevels?.find(level => level.kind === "boss");
  const nextLesson = !lesson ? lessons.find(item => isLessonAvailable(item, completed)
    && !getLearningProgress(getRequiredIds(item), completed).complete) : undefined;
  const scrollKey = topic ? `${difficulty}-${topic.id}-${lesson?.id}` : "selection";
  const nextItemId = lesson ? firstAvailable?.id : nextLesson?.id;
  const targetKey = nextItemId ? `${scrollKey}-${nextItemId}` : undefined;
  const scrollRef = useRef<ScrollView>(null);
  const positionedTarget = useRef<string | undefined>(undefined);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [targetLayout, setTargetLayout] = useState({ key: "", y: 0 });
  const [contentLayout, setContentLayout] = useState({ key: "", height: 0 });
  const [scrollContent, setScrollContent] = useState({ key: "", height: 0 });
  const targetReady = targetKey !== undefined && targetLayout.key === targetKey && contentLayout.key === scrollKey;
  // Enough trailing space lets even the final card sit just below the Back button.
  const trailingSpace = targetReady ? Math.max(0, targetLayout.y + viewportHeight - contentLayout.height) : 0;

  useLayoutEffect(() => { positionedTarget.current = undefined; }, [scrollKey]);

  useLayoutEffect(() => {
    if (!targetReady || !viewportHeight || scrollContent.key !== scrollKey
      || scrollContent.height + 1 < targetLayout.y + viewportHeight || positionedTarget.current === targetKey) return;
    scrollRef.current?.scrollTo({ y: targetLayout.y, animated: false });
    positionedTarget.current = targetKey;
  }, [targetReady, viewportHeight, scrollContent, scrollKey, targetLayout, targetKey]);

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
      <PuzzleHeaderGlow color={topic ? GameColors.playGlow : GameColors.headerGlow} />
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel={t("puzzlePath.a11yBack")}>
            <BackButtonLabel style={styles.backText} />
          </Pressable>
          {!topic && <AchievementsLink />}
        </View>
        <ScrollView key={scrollKey} ref={scrollRef} style={styles.scroll}
          contentContainerStyle={{ paddingBottom: trailingSpace }} showsVerticalScrollIndicator={false}
          onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => setScrollContent({ key: scrollKey, height })}>
          <View style={styles.content} onLayout={event => setContentLayout({ key: scrollKey, height: event.nativeEvent.layout.height })}>
          {topic && <Text style={styles.location}>{[t(`difficulty.${difficulty}`), ...(lesson ? [topic.title[locale]] : [])].join(" / ")}</Text>}
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          {!topic ? <>
            <Text style={styles.description}>{t("puzzleDesign.subtitle")}</Text>
            <DifficultyPicker selected={difficulty} onSelect={tier => {
              if (tier !== difficulty) router.setParams({ difficulty: tier });
            }} />
            <Animated.View style={[styles.selectionContent, selectionStyle]}>
              {recommendation && recommendedProgress ? <View style={styles.continuePanel}>
                <PuzzleGradient colors={[GameColors.recommendationTop, GameColors.recommendationSurface]} />
                <Text style={styles.continueLabel}>{t(recommendation.resumeChallenge ? "timedChallenge.resume" : hasStarted ? "puzzleDesign.pickUp" : "puzzleDesign.startHere")}</Text>
                <Text style={styles.continueTitle}>{recommendation.lesson.title[locale]}</Text>
                <View style={styles.row}>
                  <Text style={styles.continueLabel}>{t("lessonProgress.requiredTasks")}</Text>
                  <Text style={styles.continueLabel}>{recommendedProgress.solved}/{recommendedProgress.total}</Text>
                </View>
                <ProgressBar progress={recommendedProgress.total ? recommendedProgress.solved / recommendedProgress.total : 0}
                  fillColor={GameColors.progress} trackColor={GameColors.progressTrack} />
                <PuzzleButton label={t(recommendation.resumeChallenge ? "timedChallenge.resume" : hasStarted ? "puzzleDesign.continue" : "puzzleDesign.start")}
                  onPress={() => router.push({ pathname: "/play", params: { difficulty: recommendation.lesson.difficulty,
                    lesson: recommendation.lesson.id, level: recommendation.level.id } })} />
              </View> : null}
              <Text style={styles.sectionTitle} accessibilityRole="header">{t("puzzleDesign.explore")}</Text>
            {topics.map((item, index) => {
              const status = getTopicProgress(difficulty, item.id, completed);
              const topicLessons = getTopicLessons(difficulty, item.id);
              return <Pressable key={item.id} onPress={() => navigate(item.id)} style={styles.topic} accessibilityRole="button"
                accessibilityLabel={`${item.title[locale]}. ${t("learning.lessonsCount", { count: topicLessons.length })}. ${t("learning.requiredProgress", { count: status.solved, total: status.total })}`}>
                <View style={[styles.topicIcon, { backgroundColor: topicSurfaces[index % topicSurfaces.length] }]}>
                  <AppIcon name={item.icon} size={moderateScale(38)} />
                </View>
                <View style={styles.topicCopy}>
                  <Text style={styles.topicTitle}>{item.title[locale]}</Text>
                <Text style={styles.description}>{item.description[locale]}</Text>
                  <Text style={styles.topicMeta}>{t("learning.lessonsCount", { count: topicLessons.length })} · {status.solved}/{status.total}</Text>
                </View>
                <AppIcon name={status.complete ? "check" : "chevron-right"} size={moderateScale(20)} />
              </Pressable>;
            })}
            </Animated.View>
          </> : null}
          {scopeProgress && <View style={styles.scopeProgress} accessible accessibilityLabel={t("learning.requiredProgress", { count: scopeProgress.solved, total: scopeProgress.total })}>
            {lesson ? <Text style={styles.progressText}>{t("learning.requiredProgress", { count: scopeProgress.solved, total: scopeProgress.total })}</Text>
              : <View style={styles.row}><Text style={styles.progressText}>{t("lessonProgress.requiredTasks")}</Text><Text style={styles.progressText}>{scopeProgress.solved}/{scopeProgress.total}</Text></View>}
            <ProgressBar progress={scopeProgress.total ? scopeProgress.solved / scopeProgress.total : 0} fillColor={GameColors.success} trackColor={GameColors.cardBorder} />
          </View>}


          {topic && !lesson && lessons.map((item, index) => <View key={`${item.id}-${item.id === nextLesson?.id}`}
            onLayout={item.id === nextLesson?.id ? event => setTargetLayout({ key: targetKey!, y: event.nativeEvent.layout.y }) : undefined}>
            <LessonListItem lesson={item} number={index + 1} progress={progress} onPress={() => navigate(topic.id, item.id)} />
          </View>)}

          {lesson && lesson.levels.map((level, index) => {
            const state = getLearningLevelState(lesson, level, completed);
            const isNext = level.id === firstAvailable?.id;
            return <View key={`${level.id}-${isNext}`}
              onLayout={isNext ? event => setTargetLayout({ key: targetKey!, y: event.nativeEvent.layout.y }) : undefined}>
              {level.kind !== "practice"
                ? <LearningLevelCard level={level} state={state} completedIds={completed} onPress={() => play(level)} />
                : <PuzzlePathItem puzzle={getLevelPuzzles(locale, lesson, level)[0]} puzzleNumber={index + 1}
                  state={state} lockedMessage={t("learning.puzzleLocked")} onPress={() => play(level)} />}
            </View>;
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
          </View>
        </ScrollView>
        {lesson && firstAvailable ? <PuzzleButton onPress={() => play(firstAvailable)}
          label={firstAvailable.kind === "practice" ? t("learning.continueLesson") : t(`learning.start_${firstAvailable.kind}`)} /> : null}
      </View>
    </SafeAreaView>
  );
});

const topicSurfaces = ["#D5F4FF", "#E8FFC2", "#FFDCF8", "#F0D8FF", "#FFF3BF"];
const styles = StyleSheet.create({
  selectionContent: { gap: moderateScale(14) },
  safe: { flex: 1, backgroundColor: GameColors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: GameColors.background },
  screen: { flex: 1, paddingHorizontal: moderateScale(22), gap: moderateScale(12), paddingBottom: moderateScale(8) },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { minHeight: moderateScale(48), justifyContent: "center", paddingRight: moderateScale(12) },
  backText: { fontSize: moderateScale(16), fontWeight: "700", color: GameColors.text },
  scroll: { flex: 1 }, content: { paddingBottom: moderateScale(24), gap: moderateScale(14) },
  location: { fontSize: moderateScale(14), color: GameColors.textMuted },
  title: { fontSize: moderateScale(30), fontWeight: "900", color: GameColors.text },
  description: { fontSize: moderateScale(15), lineHeight: moderateScale(22), color: GameColors.textMuted },
  scopeProgress: { gap: moderateScale(8), paddingVertical: moderateScale(8) },
  progressText: { fontSize: moderateScale(14), color: GameColors.textMuted, fontWeight: "600" },
  topic: { flexDirection: "row", alignItems: "center", gap: moderateScale(12), paddingVertical: moderateScale(14), borderBottomWidth: 1, borderColor: GameColors.cardBorder },
  topicIcon: { width: moderateScale(48), height: moderateScale(48), alignItems: "center", justifyContent: "center", borderRadius: moderateScale(13) },
  topicCopy: { flex: 1, gap: moderateScale(3) },
  topicTitle: { fontSize: moderateScale(17), fontWeight: "800", color: GameColors.text },
  topicMeta: { fontSize: moderateScale(12), color: GameColors.textMuted },
  sectionTitle: { fontSize: moderateScale(19), fontWeight: "800", color: GameColors.text, marginTop: moderateScale(10) },
  continuePanel: { borderRadius: moderateScale(20), overflow: "hidden", padding: moderateScale(20), gap: moderateScale(13), backgroundColor: GameColors.recommendationSurface, marginTop: moderateScale(6) },
  continueLabel: { fontSize: moderateScale(13), fontWeight: "700", color: GameColors.secondaryDark },
  continueTitle: { fontSize: moderateScale(24), fontWeight: "900", color: GameColors.secondaryDark },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: moderateScale(12) },
  lessonTitle: { flexShrink: 1, fontSize: moderateScale(19), fontWeight: "800", color: GameColors.text },
  completion: { alignItems: "center", padding: moderateScale(20), gap: moderateScale(12), backgroundColor: GameColors.selectedSurface, borderRadius: moderateScale(16) },
  secondary: { minHeight: moderateScale(48), alignItems: "center", justifyContent: "center", padding: moderateScale(12) },
});
