import { BottomSheet, RNHostView, type SnapPoint } from "@expo/ui";
import { moderateScale } from "@/utils/scale";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AppBottomSheetProps } from "./AppBottomSheet.types";

export type { AppBottomSheetProps } from "./AppBottomSheet.types";

const DEFAULT_SNAP_POINTS: SnapPoint[] = ["half"];
/**
 * Picture help needs most of the screen. On Android, fractional snap points map to
 * ~half or full only — use full height so content can scroll inside the sheet.
 */
const EXPANDED_SNAP_POINTS: SnapPoint[] =
  Platform.OS === "android" ? ["full"] : [{ fraction: 0.88 }];

export function AppBottomSheet({
  visible,
  onClose,
  children,
  expanded = false,
}: AppBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const snapPoints = expanded ? EXPANDED_SNAP_POINTS : DEFAULT_SNAP_POINTS;
  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? moderateScale(20) : 0,
  );

  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onClose}
      snapPoints={snapPoints}
    >
      <RNHostView style={styles.host} hidden={!visible}>
        <View
          style={[
            styles.content,
            expanded && styles.contentExpanded,
            { paddingBottom: bottomInset + moderateScale(expanded ? 24 : 16) },
          ]}
        >
          {children}
        </View>
      </RNHostView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
    alignSelf: "stretch",
    flex: 1,
  },
  content: {
    width: "100%",
    alignSelf: "stretch",
  },
  contentExpanded: {
    flex: 1,
  },
});
