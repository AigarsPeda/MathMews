import { BottomSheet, RNHostView, type SnapPoint } from "@expo/ui";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AppBottomSheetProps } from "./AppBottomSheet.types";

export type { AppBottomSheetProps } from "./AppBottomSheet.types";

const DEFAULT_SNAP_POINTS: SnapPoint[] = ["half"];
/** Picture help and other tall sheets — ~75% of the screen, not full height. */
const EXPANDED_SNAP_POINTS: SnapPoint[] = [{ fraction: 0.75 }];

export function AppBottomSheet({
  visible,
  onClose,
  children,
  expanded = false,
}: AppBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const snapPoints = expanded ? EXPANDED_SNAP_POINTS : DEFAULT_SNAP_POINTS;

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
            { paddingBottom: insets.bottom + moderateScale(16) },
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
  },
  content: {
    width: "100%",
    alignSelf: "stretch",
  },
});
