import { PRIVACY_POLICY_URL } from "@/constants/legal";
import { GameColors } from "@/constants/game";
import { useLocale } from "@/contexts/LocaleProvider";
import { getPrivacyPolicyContent } from "@/legal/privacy-policy-content";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { openBrowserAsync } from "expo-web-browser";
import { useCallback } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

type PrivacyPolicyViewProps = {
  style?: object;
};

export function PrivacyPolicyView({ style }: PrivacyPolicyViewProps) {
  const { locale } = useLocale();
  const content = getPrivacyPolicyContent(locale);

  const handleViewOnline = useCallback(() => {
    triggerHaptic();
    void openBrowserAsync(PRIVACY_POLICY_URL);
  }, []);

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.updated}>{content.lastUpdatedLabel}</Text>

      <Pressable
        onPress={handleViewOnline}
        style={styles.onlineBtn}
        accessibilityRole="link"
        accessibilityLabel={content.viewOnline}
      >
        <Text style={styles.onlineBtnText}>{content.viewOnline}</Text>
      </Pressable>

      {content.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(14),
  },
  updated: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  onlineBtn: {
    alignSelf: "center",
    minHeight: moderateScale(40),
    justifyContent: "center",
    paddingHorizontal: moderateScale(12),
  },
  onlineBtnText: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.primary,
    textDecorationLine: "underline",
  },
  section: {
    gap: moderateScale(8),
  },
  sectionTitle: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    color: GameColors.text,
  },
  paragraph: {
    fontSize: moderateScale(15),
    fontWeight: "500",
    color: GameColors.textMuted,
    lineHeight: moderateScale(22),
  },
});
