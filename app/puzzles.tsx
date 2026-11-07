import { Feather } from "@expo/vector-icons";
import { DifficultyPicker } from "@/components/puzzle/DifficultyPicker";
import { TopicLevelPath } from "@/components/puzzle/TopicLevelPath";
import { PuzzleButton } from "@/components/puzzle/PuzzleButton";
import { PuzzleGradient, PuzzleHeaderGlow } from "@/components/puzzle/PuzzleGradient";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleProgress } from "@/components/puzzle/PuzzleProgress";
import { AppIcon } from "@/components/ui/AppIcon";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { AchievementsLink } from "@/components/puzzle/AchievementsLink";
import { getLearningTopics } from "@/constants/curriculum";
import { getPathEntry, getPathProgress, getPathRecommendation, getPathResumeRecommendation, getTopicPaths, getTopicPathProgress } from "@/constants/puzzle-path";
import { PuzzleColors as GameColors, TopicPathColors } from "@/constants/puzzle-theme";
import { PuzzleFontAssets } from "@/constants/puzzle-fonts";
import { PUZZLE_DIFFICULTIES, isPuzzleDifficulty } from "@/constants/puzzles";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import type { LearningLesson } from "@/types/curriculum";
import type { PuzzleDifficulty } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { getTopicPathLayout } from "@/utils/topic-path-layout";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { memo, useCallback, useLayoutEffect, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { Easing, ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PuzzlesScreen() {
  const { isReady, hasCompletedOnboarding, progress } = useGame();
  const [fontsLoaded, fontError] = useFonts(PuzzleFontAssets);
  if (!fontsLoaded && !fontError) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  return <PuzzlesContent isReady={isReady} hasCompletedOnboarding={hasCompletedOnboarding} progress={progress} />;
}
const PuzzlesContent = memo(function PuzzlesContent({ isReady, hasCompletedOnboarding, progress }:
  Pick<ReturnType<typeof useGame>, "isReady" | "hasCompletedOnboarding" | "progress">) {
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
  const recommendation = topic ? getPathRecommendation(difficulty, progress, topic.id)
    : getPathResumeRecommendation(difficulty, progress);
  const recommendedProgress = recommendation ? getPathProgress(recommendation.lesson, progress) : undefined;
  const lessons = topic ? getTopicPaths(difficulty, topic.id) : [];
  const recommendedLevel = lessons.findIndex(lesson => lesson.id === recommendation?.lesson.id) + 1;
  const topicId = params.topic;
  const lessonCount = Number(lessons.length);
  const trailScroll = useRef<ScrollView>(null);
  const trailOffset = useSharedValue(0);
  const trailViewport = useSharedValue(0);
  const onTrailScroll = useAnimatedScrollHandler(event => {
    trailOffset.set(event.contentOffset.y);
  });
  const trailLayout = useRef({ width: 0, height: 0, contentHeight: 0, positioned: false });
  const focusFrame = useRef<number | null>(null);
  useLayoutEffect(() => {
    trailLayout.current.contentHeight = 0;
    trailLayout.current.positioned = false;
    trailOffset.set(0);
  }, [topic?.id, difficulty, trailOffset]);

  const focusCurrentLevel = useCallback(() => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    // Native content bounds must be committed before issuing the scroll command.
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      const viewport = trailLayout.current;
      if (!topicId || viewport.positioned || !viewport.width || !viewport.height || !trailScroll.current) return;
      const layout = getTopicPathLayout(Math.min(viewport.width, 460), lessonCount, recommendedLevel - 1, topicId);
      const point = layout.points[recommendedLevel - 1];
      if (!point || viewport.contentHeight < layout.height) return;
      trailScroll.current.scrollTo({ y: Math.max(0, point.y - viewport.height * 0.45), animated: false });
      viewport.positioned = true;
    });
  }, [topicId, lessonCount, recommendedLevel]);
  useFocusEffect(useCallback(() => {
    trailLayout.current.positioned = false;
    focusCurrentLevel();
    return () => {
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
      focusFrame.current = null;
    };
  }, [focusCurrentLevel]));

  function play(lesson: LearningLesson) {
    const entry = getPathEntry(lesson, progress);
    if (!entry) return;
    router.push({ pathname: "/play", params: { difficulty, lesson: lesson.id, level: entry.level.id, ...(entry.replay && { replay: "1" }) } });
  }
  function back() {
    if (topic) {
      router.setParams({ topic: undefined, lesson: undefined });
    } else if (router.canGoBack()) router.back();
    else router.replace("/");
  }
  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;
  if (params.topic && !topic) return <Redirect href={{ pathname: "/puzzles", params: { difficulty } }} />;
  return <SafeAreaView style={[styles.safe, topic && styles.trailSafe]} edges={["top", "bottom"]}>
    {topic ? <PuzzleGradient colors={[TopicPathColors.header, TopicPathColors.background]} /> : <PuzzleHeaderGlow color={GameColors.playGlow} />}
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={back} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t(topic ? "puzzlePathDesign.back" : "puzzlePath.a11yBack")}>
          {topic ? <Feather name="arrow-left" color={TopicPathColors.text} size={24} /> : <BackButtonLabel style={styles.backText} />}
        </Pressable>
        {topic ? <Text style={styles.trailTitle} accessibilityRole="header">{topic.title[locale]}</Text> : null}
        {topic ? <Text style={styles.difficultyLabel}>{t(`difficulty.${difficulty}`)}</Text> : null}
        {!topic ? <AchievementsLink /> : null}
      </View>
      <Animated.ScrollView ref={trailScroll} key={`${difficulty}:${topic?.id ?? "selection"}`} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        onScroll={onTrailScroll} scrollEventThrottle={16}
        onLayout={({ nativeEvent: { layout } }) => {
          if (trailLayout.current.width !== layout.width || trailLayout.current.height !== layout.height) trailLayout.current.positioned = false;
          trailLayout.current.width = layout.width;
          trailLayout.current.height = layout.height;
          trailViewport.set(layout.height);
          focusCurrentLevel();
        }} onContentSizeChange={(_width, height) => {
          trailLayout.current.contentHeight = height;
          focusCurrentLevel();
        }}>
        {topic ? <TopicLevelPath lessons={lessons} progress={progress} currentLessonId={recommendation?.lesson.id} onPlay={play}
          scrollOffset={trailOffset} viewportHeight={trailViewport} /> : <>
          <Text style={styles.title} accessibilityRole="header">{t("puzzlePathDesign.chooseTopic")}</Text>
          <DifficultyPicker selected={difficulty} onSelect={tier => { if (tier !== difficulty) router.setParams({ difficulty: tier }); }} />
          <Animated.View style={[styles.selectionContent, selectionStyle]}>
            {recommendation ? <View style={styles.resumeCard}>
              <PuzzleGradient colors={[GameColors.recommendationTop, GameColors.recommendationSurface]} />
              <Text style={styles.resumeTitle} accessibilityRole="header">{recommendation.lesson.title[locale]}</Text>
              <PuzzleProgress
                size="slim"
                steps={recommendation.lesson.levels.flatMap(level => level.puzzleIds.map(id => progress.completedPuzzleIds?.includes(id) ?? false))}
                label={t("puzzlePathDesign.progress", { count: recommendedProgress?.solved ?? 0, total: recommendedProgress?.total ?? 0 })} />
              <PuzzleButton label={t("puzzleDesign.continue")} accessibilityHint={recommendation.lesson.title[locale]}
                onPress={() => play(recommendation.lesson)} />
            </View> : null}
            {topics.map((item, index) => {
              const { solved, total } = getTopicPathProgress(difficulty, item.id, progress);
              const counts = { completed: solved, remaining: total - solved };
              return <Pressable key={item.id} style={styles.topic}
                accessibilityRole="button" accessibilityLabel={item.title[locale]}
                accessibilityValue={{ text: t("puzzlePathDesign.topicProgressLabel", counts) }}
                accessibilityHint={t("puzzlePathDesign.viewTopicPath", { topic: item.title[locale] })}
                onPress={() => router.setParams({ topic: item.id, lesson: undefined })}>
                <View style={[styles.topicIcon, { backgroundColor: topicSurfaces[index % topicSurfaces.length] }]}><AppIcon name={item.icon} size={moderateScale(34)} /></View>
                <View style={styles.topicDetails}>
                  <Text style={styles.topicTitle}>{item.title[locale]}</Text>
                  <Text style={styles.topicProgress}>{t("puzzlePathDesign.topicProgress", counts)}</Text>
                </View>
                <Feather name="chevron-right" size={23} color={GameColors.textMuted} />
              </Pressable>;
            })}
          </Animated.View>
          <Pressable onPress={() => router.push("/stats")} style={styles.secondary} accessibilityRole="button"><Text style={styles.backText}>{t("stats.title")}</Text></Pressable>
        </>}
      </Animated.ScrollView>
      {topic && recommendation ? <View style={styles.pathAction}>
        <PuzzleButton palette={TopicPathColors.current} label={t(recommendedProgress?.complete ? "puzzlePathDesign.replay" : "puzzlePathDesign.playLevel", { number: recommendedLevel })} onPress={() => play(recommendation.lesson)} />
      </View> : null}
    </View>
  </SafeAreaView>;
});
const topicSurfaces = ["#D5F4FF", "#E8FFC2", "#FFDCF8", "#F0D8FF", "#FFF3BF"];
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GameColors.background },
  trailSafe: { backgroundColor: TopicPathColors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: GameColors.background },
  screen: { flex: 1, paddingHorizontal: moderateScale(22), gap: moderateScale(12), paddingBottom: moderateScale(8) },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: moderateScale(16), fontWeight: "700", color: GameColors.text },
  scroll: { flex: 1 }, content: { paddingBottom: moderateScale(20), gap: moderateScale(18) },
  title: { fontSize: moderateScale(32), fontWeight: "900", color: GameColors.text },
  trailTitle: { flex: 1, marginLeft: moderateScale(8), fontSize: moderateScale(28), fontWeight: "800", color: TopicPathColors.text },
  difficultyLabel: { flexShrink: 0, fontSize: moderateScale(14), color: TopicPathColors.textMuted, fontWeight: "700", marginLeft: moderateScale(12), textAlign: "right" },
  pathAction: { paddingTop: moderateScale(12) },
  selectionContent: { gap: moderateScale(14) },
  resumeCard: { padding: moderateScale(20), gap: moderateScale(16), borderRadius: moderateScale(24), overflow: "hidden", marginBottom: moderateScale(8) },
  resumeTitle: { fontSize: moderateScale(23), lineHeight: moderateScale(30), fontWeight: "900", color: GameColors.text },
  topic: { flexDirection: "row", alignItems: "center", gap: moderateScale(14), minHeight: 84, paddingVertical: moderateScale(16), borderBottomWidth: 1, borderColor: GameColors.cardBorder },
  topicIcon: { width: moderateScale(46), height: moderateScale(46), alignItems: "center", justifyContent: "center", borderRadius: moderateScale(13) },
  topicDetails: { flex: 1, gap: moderateScale(4) },
  topicTitle: { fontSize: moderateScale(18), fontWeight: "800", color: GameColors.text },
  topicProgress: { fontSize: moderateScale(13), lineHeight: moderateScale(19), fontWeight: "700", color: GameColors.textMuted },
  secondary: { alignItems: "center", padding: moderateScale(14) },
});
