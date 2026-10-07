import { NativeActionMenu } from "@/components/ui/NativeActionMenu";
import type { NativeActionMenuProps } from "@/components/ui/NativeActionMenu.types";
import type { AppIconName } from "@/constants/app-icons";
import { useState, type ReactElement } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type RoomItemMenuAction = {
  label: string;
  icon: AppIconName;
  section?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
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
    id: String(index), title: action.label, icon: action.icon, section: action.section,
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
        <NativeActionMenu {...dimensions} actions={nativeActions} label={label}
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
