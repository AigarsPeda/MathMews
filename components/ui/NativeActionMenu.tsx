import { MenuView } from "@expo/ui/community/menu";
import { View } from "react-native";
import type { NativeActionMenuProps } from "./NativeActionMenu.types";

export function NativeActionMenu({ width, height, actions, title, label, blocked, children, onSelect }: NativeActionMenuProps) {
  return (
    <View pointerEvents={blocked ? "none" : "auto"}><MenuView style={{ width, height }} title={title} actions={actions}
      onPressAction={({ nativeEvent }) => {
        const action = actions.find(item => item.id === nativeEvent.event);
        if (!blocked && action && !action.attributes?.disabled) onSelect(action.id);
      }}>
      <View accessible accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ disabled: blocked }} style={{ width, height }}>
        {children}
      </View>
    </MenuView></View>
  );
}
