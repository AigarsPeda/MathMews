import { AchievementMovie } from "@/components/puzzle/AchievementMovie";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { AppIcon } from "@/components/ui/AppIcon";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { ACHIEVEMENT_MEDIA } from "@/constants/achievement-media";
import { getAchievementStory } from "@/constants/achievement-stories";
import { GameColors } from "@/constants/game";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import { getBossAchievements, type BossAchievement } from "@/utils/boss-achievements";
import { moderateScale } from "@/utils/scale";
import { shareBossAchievement } from "@/utils/share-boss-achievement";
import { Image } from "expo-image";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const AchievementCard = memo(function AchievementCard({ item, onOpen }: { item: BossAchievement; onOpen: (item: BossAchievement) => void }) {
  const { locale } = useLocale(), { t } = useTranslation();
  const sceneId = item.level.story!.sceneId;
  const movie = getAchievementStory(sceneId, locale);
  const source = item.collected ? ACHIEVEMENT_MEDIA[sceneId]?.poster : ACHIEVEMENT_MEDIA[sceneId]?.locked;
  return <Pressable testID={`achievement-${item.id}`} onPress={() => onOpen(item)} accessibilityRole="button"
    accessibilityLabel={`${movie.title}. ${item.level.title[locale]}. ${item.topic.title[locale]}. ${t(`difficulty.${item.lesson.difficulty}`)}. ${t("learning.lessonNumber", { number: item.lessonNumber })}. ${t(item.collected ? "achievements.play" : "achievements.progress", { count: item.stagesComplete })}`}
    style={({ pressed }) => [styles.card, item.collected ? styles.collectedCard : styles.lockedCard, pressed && styles.pressed]}>
    <View style={styles.cardHeading}><Text style={styles.cardTitle}>{movie.title}</Text></View>
    <View style={styles.artwork}>
      {source ? <Image source={source} style={styles.thumbnail} contentFit="contain" recyclingKey={item.id} /> : <View style={styles.thumbnail}><AppIcon name="boss-badge" size={moderateScale(60)} /></View>}
    </View>
    <View style={styles.cardContent}>
      <Text style={styles.movieDescription}>{movie.description}</Text>
      <Text style={styles.context}>{item.topic.title[locale]} · {t(`difficulty.${item.lesson.difficulty}`)} · {t("learning.lessonNumber", { number: item.lessonNumber })}</Text>
      <View style={styles.cardFooter}>
        <AppIcon name={item.collected ? "check" : "lock"} size={moderateScale(22)} />
        <Text style={[styles.cardStatus, item.collected && styles.collectedText]}>{t(item.collected ? "achievements.play" : "achievements.progress", { count: item.stagesComplete })}</Text>
        <Text style={styles.cardAction}>{t(item.collected ? "achievements.watch" : "achievements.howToUnlock")}</Text>
      </View>
      {!item.collected ? <View style={styles.stageTrack}>{[0, 1, 2].map(stage => <View key={stage} style={[styles.stageSegment, stage < item.stagesComplete && styles.stageComplete]} />)}</View> : null}
    </View>
  </Pressable>;
});

export default function AchievementsScreen() {
  const { isReady, hasCompletedOnboarding } = useGame(), params = useLocalSearchParams<{ boss?: string }>();
  if (!isReady) return <View style={styles.loading}><ActivityIndicator color={GameColors.primary} /></View>;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/name-pet" />;
  return <AchievementsCollection key={params.boss ?? "collection"} initialBoss={params.boss} />;
}
function AchievementsCollection({ initialBoss }: { initialBoss?: string }) {
  const { progress } = useGame(), { locale } = useLocale(), { t } = useTranslation();
  const router = useRouter();
  const all = useMemo(() => getBossAchievements(progress.completedPuzzleIds), [progress.completedPuzzleIds]);
  const initial = all.find(item => item.id === initialBoss && item.collected);
  const [selectedId, setSelectedId] = useState<string | null>(() => initial?.id ?? null), [open, setOpen] = useState(() => !!initial);
  const selected = all.find(item => item.id === selectedId) ?? null;
  const selectedMovie = selected ? getAchievementStory(selected.level.story!.sceneId, locale) : null;
  const [filter, setFilter] = useState<"all" | "collected">("all");
  const [sharing, setSharing] = useState(false), [shareError, setShareError] = useState<string | null>(null);
  const shareInFlight = useRef(false);
  const collected = useMemo(() => all.filter(item => item.collected), [all]);
  const handleOpen = useCallback((item: BossAchievement) => { setSelectedId(item.id); setShareError(null); setOpen(true); }, []);
  const renderItem = useCallback(({ item }: { item: BossAchievement }) => <AchievementCard item={item} onOpen={handleOpen} />, [handleOpen]);
  const back = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace("/puzzles"); }, [router]);
  async function share() {
    if (!selected?.collected || shareInFlight.current) return;
    shareInFlight.current = true; setSharing(true); setShareError(null);
    try {
      const result = await shareBossAchievement(selected.id, progress.completedPuzzleIds ?? [], selectedMovie?.title ?? selected.level.title[locale]);
      if (result === "unavailable") setShareError(t("achievements.shareUnavailable"));
    } catch {
      setShareError(t("achievements.shareError"));
    } finally {
      shareInFlight.current = false; setSharing(false);
    }
  }
  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.screen}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t("common.back")} style={styles.back}><BackButtonLabel style={styles.backText} /></Pressable>
      <View style={styles.heading}><AppIcon name="boss-badge" size={moderateScale(40)} /><Text style={styles.title} accessibilityRole="header">{t("achievements.title")}</Text></View>
      <Text style={styles.count}>{t("achievements.count", { count: collected.length, total: all.length })}</Text>
      <View style={styles.filters} accessibilityRole="tablist">
        {(["all", "collected"] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: filter === value }}
          onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterSelected]}>
          <Text style={[styles.filterText, filter === value && styles.filterSelectedText]}>{t(`achievements.${value}`)}</Text>
        </Pressable>)}
      </View>
      <FlatList data={filter === "all" ? all : collected} keyExtractor={item => item.id} renderItem={renderItem}
        ListHeaderComponent={<Text style={styles.description}>{t("achievements.description")}</Text>}
        ListEmptyComponent={<View style={styles.empty}><AppIcon name="boss-badge" size={moderateScale(72)} />
          <Text style={styles.cardTitle}>{t("achievements.emptyTitle")}</Text><Text style={styles.description}>{t("achievements.emptyBody")}</Text>
          <Pressable accessibilityRole="button" onPress={() => setFilter("all")} style={styles.filter}><Text style={styles.filterText}>{t("achievements.all")}</Text></Pressable>
        </View>}
        contentContainerStyle={styles.list} initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5} />
    </View>
    <AppBottomSheet visible={open && !!selected} onClose={() => { if (!shareInFlight.current) setOpen(false); }} onDismissComplete={() => setSelectedId(null)} expanded>
      {height => <View style={[styles.preview, height !== undefined && { height }]}>
        <ScrollView contentContainerStyle={styles.previewContent}>
          {selected ? <>
            <Text style={styles.previewTitle} accessibilityRole="header">{selectedMovie?.title}</Text>
            <Text style={styles.context}>{selected.topic.title[locale]} · {t(`difficulty.${selected.lesson.difficulty}`)}</Text>
            {selected.collected ? <AchievementMovie key={selected.id} sceneId={selected.level.story!.sceneId} label={selectedMovie?.description ?? selected.level.story!.outcome[locale]} active={open && !sharing} />
              : <Image source={ACHIEVEMENT_MEDIA[selected.level.story!.sceneId].locked} style={styles.thumbnail} contentFit="contain" />}
            <Text style={styles.rewardTitle}>{t(selected.collected ? "achievements.youDidIt" : "achievements.unlockTitle")}</Text>
            <Text style={styles.outcome}>{selected.collected ? selectedMovie?.description : t("achievements.unlockBody", { count: selected.stagesComplete })}</Text>
            <Text style={styles.context}>{selected.level.title[locale]}</Text>
            <Text style={styles.description}>{t(selected.collected ? "achievements.shareHint" : "achievements.unlockHint")}</Text>
          </> : null}
        </ScrollView>
        {shareError ? <Text accessibilityRole="alert" style={styles.shareError}>{shareError}</Text> : null}
        <View style={styles.actions}>
          {selected?.collected ? <Pressable accessibilityRole="button" disabled={sharing} accessibilityState={{ disabled: sharing, busy: sharing }} onPress={share} style={[styles.share, sharing && styles.sharing]}>
            {sharing ? <ActivityIndicator color={GameColors.card} /> : null}
            <Text style={styles.shareText}>{t(sharing ? "achievements.preparingShare" : "achievements.share")}</Text>
          </Pressable> : <Pressable accessibilityRole="button" style={styles.share} onPress={() => {
            if (!selected) return;
            setOpen(false);
            router.push({ pathname: "/puzzles", params: { difficulty: selected.lesson.difficulty, topic: selected.topic.id, lesson: selected.lesson.id } });
          }}><Text style={styles.shareText}>{t("achievements.goToLesson")}</Text></Pressable>}
          <Pressable accessibilityRole="button" disabled={sharing} accessibilityState={{ disabled: sharing }} onPress={() => setOpen(false)} style={styles.close}><Text style={styles.closeText}>{t("common.close")}</Text></Pressable>
        </View>
      </View>}
    </AppBottomSheet>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GameColors.background }, loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: GameColors.background },
  screen: { flex: 1, paddingHorizontal: moderateScale(16), gap: moderateScale(12) },
  back: { minHeight: moderateScale(44), justifyContent: "center", alignSelf: "flex-start" }, backText: { color: GameColors.text, fontSize: moderateScale(16), fontWeight: "700" },
  heading: { flexDirection: "row", alignItems: "center", gap: moderateScale(10) }, title: { flex: 1, color: GameColors.text, fontSize: moderateScale(28), fontWeight: "800" },
  description: { color: GameColors.textMuted, fontSize: moderateScale(15), lineHeight: moderateScale(22) }, count: { color: GameColors.coinText, fontSize: moderateScale(16), fontWeight: "700" },
  list: { gap: moderateScale(18), paddingBottom: moderateScale(24) },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: moderateScale(8) },
  filter: { minHeight: 48, paddingHorizontal: moderateScale(18), paddingVertical: moderateScale(10), borderRadius: moderateScale(14), justifyContent: "center", backgroundColor: GameColors.card },
  filterSelected: { backgroundColor: GameColors.secondaryDark },
  filterText: { color: GameColors.text, fontSize: moderateScale(15), fontWeight: "700" }, filterSelectedText: { color: GameColors.card },
  empty: { alignItems: "center", gap: moderateScale(16), paddingVertical: moderateScale(28) },
  card: { width: "100%", overflow: "hidden", borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: moderateScale(16), backgroundColor: GameColors.card },
  pressed: { opacity: .8 }, collectedCard: { borderColor: GameColors.coin },
  artwork: { backgroundColor: GameColors.background, paddingHorizontal: moderateScale(8) },
  thumbnail: { width: "100%", aspectRatio: 512 / 448, alignItems: "center", justifyContent: "center" },
  lockedCard: { borderColor: "#D5D9DA" },
  cardHeading: { paddingHorizontal: moderateScale(16), paddingTop: moderateScale(16), paddingBottom: moderateScale(8) },
  cardContent: { padding: moderateScale(16), gap: moderateScale(8) },
  cardTitle: { color: GameColors.text, fontSize: moderateScale(20), lineHeight: moderateScale(26), fontWeight: "800" },
  movieDescription: { color: GameColors.text, fontSize: moderateScale(15), lineHeight: moderateScale(22) },
  context: { color: GameColors.textMuted, fontSize: moderateScale(13), lineHeight: moderateScale(19) },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: moderateScale(7), flexWrap: "wrap", marginTop: moderateScale(6) },
  cardStatus: { flexShrink: 1, color: GameColors.textMuted, fontSize: moderateScale(14), fontWeight: "700" },
  cardAction: { marginLeft: "auto", color: GameColors.secondaryDark, fontSize: moderateScale(14), fontWeight: "800" }, collectedText: { color: GameColors.success },
  stageTrack: { flexDirection: "row", gap: moderateScale(6) }, stageSegment: { flex: 1, height: moderateScale(5), borderRadius: 3, backgroundColor: "#D5D9DA" }, stageComplete: { backgroundColor: GameColors.secondaryDark },
  rewardTitle: { color: GameColors.success, fontSize: moderateScale(22), fontWeight: "800" },
  preview: { flex: 1 }, previewContent: { padding: moderateScale(20), gap: moderateScale(16) }, previewTitle: { color: GameColors.text, fontSize: moderateScale(24), fontWeight: "800" }, outcome: { color: GameColors.text, fontSize: moderateScale(17), lineHeight: moderateScale(25) },
  actions: { flexDirection: "row", gap: moderateScale(10), paddingHorizontal: moderateScale(20), paddingTop: moderateScale(12) },
  share: { flex: 1, minHeight: moderateScale(52), flexDirection: "row", gap: moderateScale(8), alignItems: "center", justifyContent: "center", padding: moderateScale(10), borderRadius: moderateScale(16), backgroundColor: GameColors.primary },
  shareText: { flexShrink: 1, textAlign: "center", color: GameColors.card, fontSize: moderateScale(16), fontWeight: "800" }, sharing: { opacity: .7 },
  shareError: { color: GameColors.primary, fontSize: moderateScale(14), lineHeight: moderateScale(21), paddingHorizontal: moderateScale(20) },
  close: { flex: .6, minHeight: moderateScale(52), alignItems: "center", justifyContent: "center", padding: moderateScale(10), borderRadius: moderateScale(16), borderWidth: 1, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card }, closeText: { color: GameColors.text, fontSize: moderateScale(16), fontWeight: "800" },
});
