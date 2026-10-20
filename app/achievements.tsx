import { BossStoryScene } from "@/components/puzzle/BossStoryScene";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { AppIcon } from "@/components/ui/AppIcon";
import { BackButtonLabel } from "@/components/ui/BackButtonLabel";
import { BOSS_SCENE_ASSETS } from "@/constants/boss-scene-assets";
import { ACHIEVEMENT_MEDIA } from "@/constants/achievement-media";
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
  const source = item.collected ? BOSS_SCENE_ASSETS[sceneId]?.states[3] : ACHIEVEMENT_MEDIA[sceneId]?.locked;
  return <Pressable testID={`achievement-${item.id}`} disabled={!item.collected} onPress={() => onOpen(item)} accessibilityRole="button"
    accessibilityState={{ disabled: !item.collected }}
    accessibilityLabel={`${item.level.title[locale]}. ${item.topic.title[locale]}. ${t(`difficulty.${item.lesson.difficulty}`)}. ${t("learning.lessonNumber", { number: item.lessonNumber })}. ${t(item.collected ? "achievements.play" : "achievements.progress", { count: item.stagesComplete })}`}
    style={[styles.card, item.collected ? styles.collectedCard : styles.lockedCard]}>
    {source ? <Image source={source} style={styles.thumbnail} contentFit="contain" recyclingKey={item.id} /> : <View style={styles.thumbnail}><AppIcon name="boss-badge" size={moderateScale(60)} /></View>}
    <Text style={[styles.cardTitle, !item.collected && styles.lockedText]} numberOfLines={3}>{item.level.title[locale]}</Text>
    <Text style={styles.context}>{item.topic.title[locale]} · {t(`difficulty.${item.lesson.difficulty}`)} · {t("learning.lessonNumber", { number: item.lessonNumber })}</Text>
    <View style={styles.cardFooter}>
      <AppIcon name={item.collected ? "check" : "lock"} size={moderateScale(18)} style={!item.collected ? styles.lockedIcon : undefined} />
      <Text style={[styles.cardStatus, item.collected && styles.collectedText]}>{t(item.collected ? "achievements.play" : "achievements.progress", { count: item.stagesComplete })}</Text>
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
  const selected = all.find(item => item.id === selectedId && item.collected) ?? null;
  const [sharing, setSharing] = useState(false), [shareError, setShareError] = useState<string | null>(null);
  const shareInFlight = useRef(false);
  const collected = useMemo(() => all.filter(item => item.collected), [all]);
  const handleOpen = useCallback((item: BossAchievement) => { if (item.collected) { setSelectedId(item.id); setShareError(null); setOpen(true); } }, []);
  const renderItem = useCallback(({ item }: { item: BossAchievement }) => <AchievementCard item={item} onOpen={handleOpen} />, [handleOpen]);
  const back = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace("/puzzles"); }, [router]);
  async function share() {
    if (!selected || shareInFlight.current) return;
    shareInFlight.current = true; setSharing(true); setShareError(null);
    try {
      const result = await shareBossAchievement(selected.id, progress.completedPuzzleIds ?? [], selected.level.title[locale]);
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
      <Text style={styles.description}>{t("achievements.description")}</Text>
      <Text style={styles.count}>{t("achievements.count", { count: collected.length, total: all.length })}</Text>
      <FlatList data={all} keyExtractor={item => item.id} renderItem={renderItem} numColumns={2}
        columnWrapperStyle={styles.columns} contentContainerStyle={styles.list} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5} />
    </View>
    <AppBottomSheet visible={open && !!selected} onClose={() => { if (!shareInFlight.current) setOpen(false); }} onDismissComplete={() => setSelectedId(null)} expanded>
      {height => <View style={[styles.preview, height !== undefined && { height }]}>
        <ScrollView contentContainerStyle={styles.previewContent}>
          {selected ? <>
            <Text style={styles.previewTitle} accessibilityRole="header">{selected.level.title[locale]}</Text>
            <Text style={styles.context}>{selected.topic.title[locale]} · {t(`difficulty.${selected.lesson.difficulty}`)}</Text>
            <BossStoryScene key={selected.id} story={selected.level.story!} locale={locale} completed={3} outcome active={open} />
            <Text style={styles.outcome}>{selected.level.story!.outcome[locale]}</Text>
            <Text style={styles.description}>{t("achievements.replayFree")}</Text>
          </> : null}
        </ScrollView>
        {shareError ? <Text accessibilityRole="alert" style={styles.shareError}>{shareError}</Text> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={sharing} accessibilityState={{ disabled: sharing, busy: sharing }} onPress={share} style={[styles.share, sharing && styles.sharing]}>
            {sharing ? <ActivityIndicator color={GameColors.card} /> : null}
            <Text style={styles.shareText}>{t(sharing ? "achievements.preparingShare" : "achievements.share")}</Text>
          </Pressable>
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
  columns: { gap: moderateScale(12) }, list: { gap: moderateScale(12), paddingBottom: moderateScale(24) },
  card: { flex: 1, maxWidth: "49%", padding: moderateScale(12), gap: moderateScale(8), borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: moderateScale(16), backgroundColor: GameColors.card },
  collectedCard: { borderColor: GameColors.coin }, thumbnail: { width: "100%", aspectRatio: 1.6, alignItems: "center", justifyContent: "center" },
  lockedCard: { backgroundColor: "#F0F1F1", borderColor: "#D5D9DA" }, lockedText: { color: GameColors.textMuted }, lockedIcon: { tintColor: GameColors.textMuted },
  cardTitle: { color: GameColors.text, fontSize: moderateScale(15), lineHeight: moderateScale(20), fontWeight: "700" }, context: { color: GameColors.textMuted, fontSize: moderateScale(12), lineHeight: moderateScale(18) },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: moderateScale(5), marginTop: "auto" }, cardStatus: { flexShrink: 1, color: GameColors.textMuted, fontSize: moderateScale(12), fontWeight: "700" }, collectedText: { color: GameColors.success },
  preview: { flex: 1 }, previewContent: { padding: moderateScale(20), gap: moderateScale(16) }, previewTitle: { color: GameColors.text, fontSize: moderateScale(24), fontWeight: "800" }, outcome: { color: GameColors.text, fontSize: moderateScale(17), lineHeight: moderateScale(25) },
  actions: { flexDirection: "row", gap: moderateScale(10), paddingHorizontal: moderateScale(20), paddingTop: moderateScale(12) },
  share: { flex: 1, minHeight: moderateScale(52), flexDirection: "row", gap: moderateScale(8), alignItems: "center", justifyContent: "center", padding: moderateScale(10), borderRadius: moderateScale(16), backgroundColor: GameColors.primary },
  shareText: { flexShrink: 1, textAlign: "center", color: GameColors.card, fontSize: moderateScale(16), fontWeight: "800" }, sharing: { opacity: .7 },
  shareError: { color: GameColors.primary, fontSize: moderateScale(14), lineHeight: moderateScale(21), paddingHorizontal: moderateScale(20) },
  close: { flex: 1, minHeight: moderateScale(52), alignItems: "center", justifyContent: "center", padding: moderateScale(10), borderRadius: moderateScale(16), borderWidth: 1, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card }, closeText: { color: GameColors.text, fontSize: moderateScale(16), fontWeight: "800" },
});
