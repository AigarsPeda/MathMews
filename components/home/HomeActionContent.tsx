import { AppIcon } from "@/components/ui/AppIcon";
import type { AppIconName } from "@/constants/app-icons";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  icon: AppIconName;
  label: string;
  cost?: number;
  dropdown?: boolean;
};

export function HomeActionContent({ icon, label, cost, dropdown = false }: Props) {
  return (
    <>
      <AppIcon name={icon} size={moderateScale(30)} />
      <View style={homeActionStyles.labelRow}>
        <Text style={homeActionStyles.label} numberOfLines={1}>{label}</Text>
        {dropdown ? <AppIcon name="chevron-down" size={moderateScale(13)} /> : null}
      </View>
      {cost !== undefined ? <View style={homeActionStyles.price}>
        <Text style={homeActionStyles.priceText}>{cost}</Text>
        <AppIcon name="coin" size={moderateScale(12)} />
      </View> : null}
    </>
  );
}

export const homeActionStyles = StyleSheet.create({
  button: {
    minHeight: moderateScale(72), borderRadius: moderateScale(16),
    backgroundColor: GameColors.card, borderWidth: 1.5, borderColor: GameColors.cardBorder,
    alignItems: "center", justifyContent: "center", paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(8), gap: moderateScale(4),
  },
  pressed: { backgroundColor: GameColors.background },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", minHeight: moderateScale(20), gap: 3 },
  label: { flexShrink: 1, fontSize: moderateScale(15), lineHeight: moderateScale(20), fontWeight: "700", color: GameColors.text },
  price: { position: "absolute", top: moderateScale(8), right: moderateScale(8),
    flexDirection: "row", alignItems: "center", gap: moderateScale(3), minHeight: moderateScale(20),
    paddingHorizontal: moderateScale(4), borderRadius: moderateScale(6), backgroundColor: GameColors.background },
  priceText: { fontSize: moderateScale(12), lineHeight: moderateScale(16), fontWeight: "600", color: GameColors.textMuted },
});
