import { PetAvatar } from "@/components/pet/PetAvatar";
import { GameColors } from "@/constants/game";
import type { PetAnimationState } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ResultOverlayProps = {
  visible: boolean;
  correct: boolean;
  petMood: PetAnimationState;
  message: string;
  detail: string;
  coinsEarned?: number;
  onContinue: () => void;
  onGoHome?: () => void;
};

export function ResultOverlay({
  visible,
  correct,
  petMood,
  message,
  detail,
  coinsEarned = 0,
  onContinue,
  onGoHome,
}: ResultOverlayProps) {
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
            <View style={styles.coinRow}>
              <Text style={styles.coinEmoji}>🪙</Text>
              <Text style={styles.coinText}>+{coinsEarned} coins</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              style={styles.primaryButton}
              onPress={onContinue}
              accessibilityRole="button"
              accessibilityLabel={correct ? "Go to next puzzle" : "Try again"}
            >
              <Text style={styles.primaryButtonText}>
                {correct ? "Next puzzle" : "Try again"}
              </Text>
            </Pressable>

            {correct && onGoHome && (
              <Pressable
                style={styles.secondaryButton}
                onPress={onGoHome}
                accessibilityRole="button"
                accessibilityLabel="Back to home"
              >
                <Text style={styles.secondaryButtonText}>Back to home</Text>
              </Pressable>
            )}
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
  coinEmoji: {
    fontSize: moderateScale(18),
  },
  coinText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.coinText,
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
});
