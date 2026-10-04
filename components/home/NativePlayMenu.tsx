import { MenuView } from "@expo/ui/community/menu";
import { View } from "react-native";
import type { NativePlayMenuProps } from "./NativePlayMenu.types";

export function NativePlayMenu({ width, height, actions, title, label, blocked, children, onSelect }: NativePlayMenuProps) {
  return (
    <MenuView style={{ width, height }} title={title} actions={actions}
      onPressAction={({ nativeEvent }) => onSelect(nativeEvent.event)}>
      <View accessible accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ disabled: blocked }} style={{ width, height }}>
        {children}
      </View>
    </MenuView>
  );
}
