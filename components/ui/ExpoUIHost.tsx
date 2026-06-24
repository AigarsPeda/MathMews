import { Host } from "@expo/ui";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

export function ExpoUIHost({ children }: { children: ReactNode }) {
  return (
    <Host style={styles.host} ignoreSafeArea="all">
      {children}
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
