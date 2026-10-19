import { RNHostView } from "@expo/ui";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AppBottomSheetProps } from "./AppBottomSheet.types";
import { SheetPresentation } from "./SheetPresentation";

export type { AppBottomSheetProps } from "./AppBottomSheet.types";

export function AppBottomSheet({
  visible,
  onClose,
  onDismissComplete,
  children,
  expanded = false,
}: AppBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [viewportHeight, setViewportHeight] = useState(0);
  // SwiftUI already keeps the measured content above the home indicator.
  const bottomInset = Platform.OS === "android"
    ? Math.max(insets.bottom, moderateScale(20))
    : 0;

  return (
    <SheetPresentation
      visible={visible}
      onClose={onClose}
      onDismissComplete={onDismissComplete}
      expanded={expanded}
    >
      {/* Native presentation owns visibility, including the closing animation. */}
      <RNHostView onLayout={event => {
        const height = event.nativeEvent.layout.height;
        if (height > 0) setViewportHeight(height);
      }}>
        <View
          style={[
            styles.content,
            expanded && styles.contentExpanded,
            expanded && viewportHeight > 0 && { height: viewportHeight, flex: 0 },
            { paddingBottom: bottomInset + moderateScale(12) },
          ]}
        >
          {/* Fixed result actions need the same explicit bound as the native host. */}
          {typeof children === "function"
            ? children(expanded && viewportHeight > 0 ? Math.max(0, viewportHeight - bottomInset - moderateScale(12)) : undefined)
            : children}
        </View>
      </RNHostView>
    </SheetPresentation>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    alignSelf: "stretch",
  },
  contentExpanded: {
    flex: 1,
  },
});
