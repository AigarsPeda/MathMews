import { Host, RNHostView } from "@expo/ui";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export function ExpoUIHost({ children }: { children: ReactNode }) {
  return (
    <Host style={styles.host} ignoreSafeArea="all">
      <RNHostView>
        <GestureHandlerRootView style={styles.host}>
          {children}
        </GestureHandlerRootView>
      </RNHostView>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
