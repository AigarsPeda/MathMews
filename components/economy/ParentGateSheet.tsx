import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors } from "@/constants/game";
import {
  createParentGateChallenge,
  type ParentGateChallenge,
} from "@/utils/parent-gate-challenge";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

type ParentGateSheetProps = {
  visible: boolean;
  onPass: () => void;
  onClose: () => void;
};

function triggerHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
}

export function ParentGateSheet({
  visible,
  onPass,
  onClose,
}: ParentGateSheetProps) {
  const { t } = useTranslation();
  const [challenge, setChallenge] = useState<ParentGateChallenge>(() =>
    createParentGateChallenge(),
  );
  const [showWrong, setShowWrong] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setChallenge(createParentGateChallenge());
    setShowWrong(false);
  }, [visible]);

  const handleChoice = useCallback(
    (choice: number) => {
      triggerHaptic();

      if (choice === challenge.answer) {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        onPass();
        return;
      }

      setShowWrong(true);
      setChallenge(createParentGateChallenge());
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [challenge.answer, onPass],
  );

  return (
    <AppBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.card}>
        <Text style={styles.emoji}>🧑‍🧒</Text>
        <Text style={styles.title}>{t("parentGate.title")}</Text>
        <Text style={styles.subtitle}>{t("parentGate.subtitle")}</Text>

        <Text style={styles.question}>
          {t("parentGate.question", { a: challenge.a, b: challenge.b })}
        </Text>

        {showWrong ? (
          <Text style={styles.wrong}>{t("parentGate.wrong")}</Text>
        ) : null}

        <View style={styles.choices}>
          {challenge.choices.map((choice) => (
            <Pressable
              key={`${challenge.a}-${challenge.b}-${choice}`}
              onPress={() => handleChoice(choice)}
              style={({ pressed }) => [
                styles.choiceBtn,
                pressed && styles.choiceBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("parentGate.a11yChoice", { value: choice })}
            >
              <Text style={styles.choiceText}>{choice}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onClose}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
        >
          <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
        </Pressable>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingTop: moderateScale(8),
    paddingHorizontal: moderateScale(20),
    gap: moderateScale(10),
  },
  emoji: {
    fontSize: moderateScale(32),
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
    lineHeight: moderateScale(20),
    maxWidth: moderateScale(300),
  },
  question: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
    textAlign: "center",
    marginTop: moderateScale(4),
  },
  choices: {
    width: "100%",
    gap: moderateScale(10),
    marginTop: moderateScale(4),
  },
  choiceBtn: {
    width: "100%",
    minHeight: moderateScale(52),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
  },
  choiceBtnPressed: {
    opacity: 0.9,
    borderColor: GameColors.primary,
  },
  choiceText: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
  },
  wrong: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.primaryDark,
    textAlign: "center",
  },
  cancelBtn: {
    minHeight: moderateScale(44),
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
    marginTop: moderateScale(4),
  },
  cancelBtnText: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
});
