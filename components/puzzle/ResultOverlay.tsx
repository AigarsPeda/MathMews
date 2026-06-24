import { PetAvatar } from "@/components/pet/PetAvatar";
import { GameColors, LIFE_BUY_COST } from "@/constants/game";
import type { PetAnimationState } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ResultOverlayProps = {
  visible: boolean;
  correct: boolean;
  petMood: PetAnimationState;
  message: string;
  detail: string;
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
  correct,
  petMood,
  message,
  detail,
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
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View
          style={[
            styles.card,
            { paddingBottom: insets.bottom + moderateScale(16) },
          ]}
        >
          <View style={styles.petWrap}>
            <PetAvatar mood={petMood} width={moderateScale(120)} loop />
          </View>

          <Text
            style={[
              styles.title,
              correct ? styles.titleSuccess : styles.titleHint,
            ]}
          >
            {message}
          </Text>
          <Text style={styles.detail}>{detail}</Text>

          {correct && coinsEarned > 0 && (
            <View
              style={[
                styles.coinRow,
                coinType === "sparkle" && styles.sparkleCoinRow,
              ]}
            >
              <Text style={styles.coinEmoji}>
                {coinType === "sparkle" ? "✨" : "🪙"}
              </Text>
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

          <View style={styles.actions}>
            <Pressable
              style={styles.primaryButton}
              onPress={onContinue}
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
                onPress={onGoHome}
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(45, 52, 54, 0.35)",
    justifyContent: "flex-end",
    zIndex: 20,
  },
  sheet: {
    width: "100%",
    backgroundColor: GameColors.card,
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: GameColors.cardBorder,
    overflow: "hidden",
  },
  card: {
    width: "100%",
    backgroundColor: GameColors.card,
    paddingTop: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    alignItems: "center",
    gap: moderateScale(10),
  },
  petWrap: {
    marginBottom: moderateScale(4),
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
    color: "#FF9F43",
  },
  detail: {
    fontSize: moderateScale(16),
    fontWeight: "500",
    color: GameColors.text,
    textAlign: "center",
    lineHeight: moderateScale(24),
  },
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
  coinEmoji: {
    fontSize: moderateScale(18),
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
    width: "100%",
    gap: moderateScale(10),
    marginTop: moderateScale(4),
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
