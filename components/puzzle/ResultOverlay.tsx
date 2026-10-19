import { IconText as Text } from "@/components/ui/IconText";
import { AppIcon } from "@/components/ui/AppIcon";
import { BossStoryScene } from "@/components/puzzle/BossStoryScene";
import type { BossStory } from "@/types/curriculum";
import type { AppLocale } from "@/types/locale";
import { PuzzleCatCompanion } from "@/components/puzzle/PuzzleCatCompanion";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors, LIFE_BUY_COST } from "@/constants/game";
import type { PetAnimationState, PetType } from "@/types/game";
import type { PuzzleCatReaction } from "@/constants/puzzle-cat-reactions";
import { moderateScale } from "@/utils/scale";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

type ResultOverlayProps = {
  visible: boolean;
  bossStory?: { story: BossStory; locale: AppLocale; completed: number };
  correct: boolean;
  petType: PetType;
  catSkinId?: string;
  petMood: PetAnimationState;
  catReaction?: PuzzleCatReaction;
  petName: string;
  encouragement: string;
  message: string;
  detail: string;
  summary?: string;
  coinsEarned?: number;
  coinType?: "regular" | "sparkle";
  continueLabel?: string;
  onContinue: () => void;
  onGoHome?: () => void;
  onBuyLife?: () => void;
  buyLifeCost?: number;
  coins?: number;
};

export function ResultOverlay({
  visible,
  bossStory,
  correct,
  petType,
  catSkinId,
  petMood,
  catReaction,
  petName,
  encouragement,
  message,
  detail,
  summary,
  coinsEarned = 0,
  coinType = "regular",
  continueLabel,
  onContinue,
  onGoHome,
  onBuyLife,
  buyLifeCost = LIFE_BUY_COST,
  coins = 0,
}: ResultOverlayProps) {
  const { t } = useTranslation();
  const actionHandled = useRef(false);
  const pendingAction = useRef<"continue" | "home" | null>(null);
  const [closing, setClosing] = useState(false);
  if (!visible && closing) setClosing(false);
  useEffect(() => {
    if (visible) {
      actionHandled.current = false;
      pendingAction.current = null;
    }
  }, [visible]);
  const continueOnce = () => {
    if (actionHandled.current) return;
    actionHandled.current = true;
    pendingAction.current = "continue";
    setClosing(true);
  };
  const goHomeOnce = () => {
    if (actionHandled.current) return;
    actionHandled.current = true;
    pendingAction.current = "home";
    setClosing(true);
  };
  const handleDismissComplete = () => {
    // A swipe may finish before iOS sends its presentation-change event.
    const action = pendingAction.current ?? (!actionHandled.current && visible ? "continue" : null);
    actionHandled.current = true;
    pendingAction.current = null;
    if (action === "home") onGoHome?.();
    else if (action === "continue") onContinue();
  };

  return (
    <AppBottomSheet visible={visible && !closing} onClose={continueOnce} onDismissComplete={handleDismissComplete} expanded>
      {contentHeight => <View style={[styles.screen, contentHeight !== undefined && { height: contentHeight, flex: 0 }]}>
        <ScrollView style={styles.body} nestedScrollEnabled={Platform.OS === "android"} contentContainerStyle={styles.card} showsVerticalScrollIndicator={false}>
          {correct && bossStory ? <BossStoryScene story={bossStory.story} locale={bossStory.locale}
            completed={bossStory.completed} outcome={bossStory.completed === 3} reaction={bossStory.completed < 3} active={visible} /> : null}
          <PuzzleCatCompanion key={`${visible}-${petMood}-${catReaction}-${encouragement}`} petType={petType}
            catSkinId={catSkinId} mood={petMood} reaction={catReaction} petName={petName} message={encouragement} portraitSize={bossStory && correct ? 88 : 180} />

          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              correct ? styles.titleSuccess : styles.titleHint,
            ]}
          >
            {message}
          </Text>
          <Text style={styles.detail}>{detail}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}

          {correct && coinsEarned > 0 && (
            <View
              style={[
                styles.coinRow,
                coinType === "sparkle" && styles.sparkleCoinRow,
              ]}
            >
              <AppIcon name={coinType === "sparkle" ? "sparkle" : "coin"} size={moderateScale(28)} />
              <Text
                style={[
                  styles.coinText,
                  coinType === "sparkle" && styles.sparkleCoinText,
                ]}
              >
                +{coinsEarned}{" "}
                {coinType === "sparkle"
                  ? t("play.sparkleCoinsLabel")
                  : t("play.coinsLabel")}
              </Text>
            </View>
          )}

        </ScrollView>
        <View style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            onPress={continueOnce}
            disabled={closing}
            accessibilityRole="button"
            accessibilityLabel={
              continueLabel ??
              (correct ? t("play.a11yNext") : t("play.a11yTryAgain"))
            }
          >
            <Text style={styles.primaryButtonText}>
              {continueLabel ??
                (correct ? t("play.nextPuzzle") : t("play.tryAgain"))}
            </Text>
          </Pressable>

          {correct && onGoHome && (
            <Pressable
              style={styles.secondaryButton}
              onPress={goHomeOnce}
              disabled={closing}
              accessibilityRole="button"
              accessibilityLabel={t("play.a11yHome")}
            >
              <Text style={styles.secondaryButtonText}>
                {t("play.backToHome")}
              </Text>
            </Pressable>
          )}

          {!correct && onBuyLife && coins >= buyLifeCost ? (
            <Pressable
              style={styles.buyLifeButton}
              onPress={onBuyLife}
              accessibilityRole="button"
              accessibilityLabel={t("lives.a11yBuy", { cost: buyLifeCost })}
            >
              <Text style={styles.buyLifeButtonText}>
                {t("lives.buyLife", { cost: buyLifeCost })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%", backgroundColor: GameColors.background },
  body: { flex: 1, minHeight: 0 },
  card: {
    width: "100%",
    paddingTop: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(16),
    alignItems: "center",
    gap: moderateScale(10),
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    textAlign: "center",
  },
  titleSuccess: {
    color: GameColors.success,
  },
  titleHint: {
    color: "#99501A",
  },
  detail: {
    fontSize: moderateScale(16),
    fontWeight: "500",
    color: GameColors.text,
    textAlign: "center",
    lineHeight: moderateScale(24),
  },
  summary: { fontSize: moderateScale(16), lineHeight: moderateScale(24), fontWeight: "700", textAlign: "center", color: GameColors.text },
  coinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(6),
    paddingHorizontal: moderateScale(12),
  },
  sparkleCoinRow: {
    backgroundColor: "#F3EEFF",
    borderWidth: 2,
    borderColor: "#C9B6FF",
  },
  coinText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.coinText,
  },
  sparkleCoinText: {
    color: "#6B4FCF",
  },
  actions: {
    flexShrink: 0,
    width: "100%",
    gap: moderateScale(10),
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(12),
  },
  primaryButton: {
    width: "100%",
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    backgroundColor: GameColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(14),
  },
  primaryButtonText: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  secondaryButton: {
    width: "100%",
    minHeight: moderateScale(48),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(12),
  },
  secondaryButtonText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  buyLifeButton: {
    width: "100%",
    minHeight: moderateScale(48),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.primary,
    backgroundColor: "#FFF8F6",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(12),
  },
  buyLifeButtonText: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: GameColors.primary,
  },
});
