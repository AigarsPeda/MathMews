import { moderateScale } from "@/utils/scale";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenInsetOptions = {
  topGap?: number;
  bottomGap?: number;
  horizontal?: number;
};

/** Device safe-area padding for full-screen layouts (replaces hardcoded platform offsets). */
export function useScreenInsets({
  topGap = moderateScale(4),
  bottomGap = moderateScale(8),
  horizontal = moderateScale(16),
}: ScreenInsetOptions = {}) {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => ({
      paddingTop: insets.top + topGap,
      paddingLeft: insets.left + horizontal,
      paddingRight: insets.right + horizontal,
      paddingBottom: insets.bottom + bottomGap,
    }),
    [
      topGap,
      bottomGap,
      horizontal,
      insets.top,
      insets.left,
      insets.right,
      insets.bottom,
    ],
  );
}
