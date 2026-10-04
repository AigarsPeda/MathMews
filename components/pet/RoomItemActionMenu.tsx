import type { RoomMenuAnchorRect, RoomMenuBounds } from "@/components/pet/room-menu-types";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type RoomItemMenuAction = {
  label: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

type RoomItemActionMenuProps = {
  actions: RoomItemMenuAction[];
  anchorRect: RoomMenuAnchorRect;
  roomBounds: RoomMenuBounds;
};

const ICON_SIZE = moderateScale(18);
const MENU_GAP = moderateScale(4);
const ROOM_EDGE_PADDING = moderateScale(8);
const ARROW_SIZE = moderateScale(6);
const ACTION_ROW_HEIGHT = moderateScale(40);

function estimateMenuHeight(actionCount: number): number {
  return actionCount * ACTION_ROW_HEIGHT + ARROW_SIZE + MENU_GAP;
}

function pickPlacement(params: {
  anchorY: number;
  anchorHeight: number;
  menuHeight: number;
  roomTop: number;
  roomBottom: number;
}): "above" | "below" {
  const { anchorY, anchorHeight, menuHeight, roomTop, roomBottom } = params;
  const spaceAbove = anchorY - roomTop;
  const spaceBelow = roomBottom - (anchorY + anchorHeight);
  const required = menuHeight + ROOM_EDGE_PADDING;

  if (spaceAbove >= required) return "above";
  if (spaceBelow >= required) return "below";
  return spaceBelow > spaceAbove ? "below" : "above";
}

export function RoomItemActionMenu({
  actions,
  anchorRect,
  roomBounds,
}: RoomItemActionMenuProps) {
  const [measuredHeight, setMeasuredHeight] = useState(() =>
    estimateMenuHeight(actions.length),
  );

  const roomBottom = roomBounds.pageY + roomBounds.height;
  const placement = pickPlacement({
    anchorY: anchorRect.pageY,
    anchorHeight: anchorRect.height,
    menuHeight: measuredHeight,
    roomTop: roomBounds.pageY,
    roomBottom,
  });

  const anchorLeft = anchorRect.pageX - roomBounds.pageX;
  const anchorTop = anchorRect.pageY - roomBounds.pageY;
  const desiredMenuTop =
    placement === "above"
      ? anchorTop - measuredHeight - MENU_GAP
      : anchorTop + anchorRect.height + MENU_GAP;

  const menuTop = Math.max(ROOM_EDGE_PADDING, Math.min(
    desiredMenuTop, roomBounds.height - measuredHeight - ROOM_EDGE_PADDING,
  ));
  const menuWidth = Math.min(moderateScale(184), roomBounds.width - ROOM_EDGE_PADDING * 2);
  const menuLeft = Math.max(ROOM_EDGE_PADDING, Math.min(
    anchorLeft + anchorRect.width / 2 - menuWidth / 2,
    roomBounds.width - menuWidth - ROOM_EDGE_PADDING,
  ));

  return (
    <View
      style={[
        styles.anchor,
        {
          left: menuLeft,
          top: menuTop,
          width: menuWidth,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={styles.wrap}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0) {
            setMeasuredHeight(height);
          }
        }}
      >
        {placement === "below" ? <View style={styles.arrowUp} /> : null}
        <View style={[styles.menu, { width: menuWidth }]}>
          <ScrollView style={{ maxHeight: roomBounds.height - ROOM_EDGE_PADDING * 2 - ARROW_SIZE }}
            showsVerticalScrollIndicator={false} bounces={false}>
          {actions.map((action, index) => {
            const iconColor = action.disabled
              ? GameColors.textMuted
              : action.destructive
                ? GameColors.primary
                : GameColors.textMuted;

            return (
              <Pressable
                key={`${action.label}-${index}`}
                onPress={action.onPress}
                disabled={action.disabled}
                style={({ pressed }) => [
                  styles.action,
                  index > 0 && styles.actionBorder,
                  action.disabled && styles.actionDisabled,
                  pressed && !action.disabled && styles.actionPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled: action.disabled }}
              >
                <Text
                  style={[
                    styles.actionText,
                    action.destructive && styles.actionTextDestructive,
                    action.disabled && styles.actionTextDisabled,
                  ]}
                >
                  {action.label}
                </Text>
                <MaterialIcons
                  name={action.icon}
                  size={ICON_SIZE}
                  color={iconColor}
                />
              </Pressable>
            );
          })}
          </ScrollView>
        </View>
        {placement === "above" ? <View style={styles.arrowDown} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    alignItems: "center",
    zIndex: 2,
  },
  wrap: {
    alignItems: "center",
  },
  menu: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(10),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: moderateScale(6),
    shadowOffset: { width: 0, height: moderateScale(2) },
    elevation: 8,
    overflow: "hidden",

  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(16),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
  },
  actionBorder: {
    borderTopWidth: 1,
    borderTopColor: GameColors.cardBorder,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionPressed: {
    backgroundColor: GameColors.background,
  },
  actionText: {
    flex: 1,
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "left",
  },
  actionTextDestructive: {
    color: GameColors.primary,
  },
  actionTextDisabled: {
    color: GameColors.textMuted,
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: GameColors.cardBorder,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderBottomWidth: ARROW_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: GameColors.cardBorder,
  },
});
