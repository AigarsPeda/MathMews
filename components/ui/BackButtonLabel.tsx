import { AppIcon } from "@/components/ui/AppIcon";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

export function BackButtonLabel({ style }: { style?: StyleProp<TextStyle> }) {
  const { t } = useTranslation();
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? moderateScale(16);

  return (
    <View style={styles.row}>
      <AppIcon name="arrow-left" size={fontSize * 1.2} />
      <Text style={[styles.text, style]}>{t("common.back")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(4),
  },
  text: {
    includeFontPadding: false,
  },
});
