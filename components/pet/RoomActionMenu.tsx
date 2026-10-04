import { NativeActionMenu } from "@/components/ui/NativeActionMenu";
import type { NativeActionMenuProps } from "@/components/ui/NativeActionMenu.types";
import type MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, type ComponentProps, type ReactElement } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type RoomItemMenuAction = {
  label: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
  emoji?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

const ACTION_EMOJI: Partial<Record<RoomItemMenuAction["icon"], string>> = {
  pets: "🐾", weekend: "🛋️", "sports-baseball": "🧸",
  home: "🏡", north: "⬆️", south: "⬇️",
  "power-settings-new": "⚡", "rotate-right": "🔄",
  style: "🎨", "zoom-in": "🔎",
  "zoom-out": "🔍", "delete-outline": "🗑️",
};

type Props = {
  actions: RoomItemMenuAction[];
  label: string;
  blocked?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: { width: number; height: number };
  children: ReactElement;
};

export function RoomActionMenu({ actions, label, blocked = false, style, size, children }: Props) {
  const [measuredSize, setMeasuredSize] = useState({ width: 0, height: 0 });
  const dimensions = size ?? measuredSize;
  const nativeActions: NativeActionMenuProps["actions"] = actions.map((action, index) => ({
    id: String(index), title: `${action.emoji ?? ACTION_EMOJI[action.icon] ?? ""} ${action.label}`.trim(),
    attributes: { disabled: action.disabled, destructive: action.destructive },
  }));

  return (
    <View style={style} pointerEvents={blocked ? "none" : "auto"}
      onTouchStart={event => event.stopPropagation()}
      onLayout={({ nativeEvent: { layout } }) => {
        if (size) return;
        setMeasuredSize(current => current.width === layout.width && current.height === layout.height
          ? current : { width: layout.width, height: layout.height });
      }}>
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <NativeActionMenu {...dimensions} actions={nativeActions} label={label} title={label}
          blocked={blocked} onSelect={id => {
            const action = actions[Number(id)];
            if (!blocked && action && !action.disabled) action.onPress();
          }}>
          {children}
        </NativeActionMenu>
      ) : children}
    </View>
  );
}
