import { PetDisplay } from "@/pet-display/components/PetDisplay";
import { GameColors } from "@/constants/game";
import {
  CAT_SKIN_IDS,
  type CatSkinId,
} from "@/constants/cat-skins";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

type CatSkinPickerProps = {
  value: CatSkinId;
  onChange: (skinId: CatSkinId) => void;
};

export function CatSkinPicker({ value, onChange }: CatSkinPickerProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t("onboarding.catColor")}</Text>
      <View style={styles.options}>
        {CAT_SKIN_IDS.map((skinId) => {
          const selected = value === skinId;
          return (
            <Pressable
              key={skinId}
              onPress={() => {
                if (skinId === value) return;
                triggerHaptic();
                onChange(skinId);
              }}
              style={[styles.option, selected && styles.optionSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`onboarding.catSkin.${skinId}`)}
            >
              <View style={styles.preview}>
                <PetDisplay
                  petType="cat"
                  catSkinId={skinId}
                  mood="idle"
                  width={moderateScale(64)}
                  loop
                  transparentBackground
                />
              </View>
              <View style={styles.optionFooter}>
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {t(`onboarding.catSkin.${skinId}`)}
                </Text>
                {selected ? <Text style={styles.check}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(6),
  },
  label: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  options: {
    flexDirection: "row",
    gap: moderateScale(8),
  },
  option: {
    flex: 1,
    minHeight: moderateScale(96),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "stretch",
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(6),
    gap: moderateScale(4),
  },
  optionSelected: {
    borderColor: GameColors.primary,
    backgroundColor: "#FFF8F5",
  },
  preview: {
    flex: 1,
    minHeight: moderateScale(64),
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  optionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(4),
  },
  optionText: {
    fontSize: moderateScale(12),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
  },
  optionTextSelected: {
    color: GameColors.primary,
  },
  check: {
    fontSize: moderateScale(12),
    fontWeight: "800",
    color: GameColors.primary,
  },
});
