import { APP_ICON_SOURCES } from "@/constants/app-icons";
import { DropdownMenu, DropdownMenuItem, HorizontalDivider, Host, Icon, RNHostView, Text } from "@expo/ui/jetpack-compose";
import { GameColors } from "@/constants/game";
import { Fragment, useState } from "react";
import { Pressable, View } from "react-native";
import type { NativeActionMenuProps } from "./NativeActionMenu.types";
import { groupMenuSections } from "./native-menu-sections";

/** Native Material menu, with untinted artwork rather than template icons. */
export function NativeActionMenu({ width, height, actions, label, blocked, children, onSelect }: NativeActionMenuProps) {
  const [expanded, setExpanded] = useState(false);
  return <View style={{ width, height }} pointerEvents={blocked ? "none" : "auto"}>
    <Host matchContents>
      <DropdownMenu expanded={!blocked && expanded} onDismissRequest={() => setExpanded(false)}>
        <DropdownMenu.Trigger><RNHostView matchContents>
          <Pressable accessible accessibilityRole="button" accessibilityLabel={label}
            accessibilityState={{ disabled: blocked }} disabled={blocked}
            onPress={() => setExpanded(true)} style={{ width, height }}>
            {children}
          </Pressable>
        </RNHostView></DropdownMenu.Trigger>
        <DropdownMenu.Items>{groupMenuSections(actions).map((section, index) => <Fragment key={index}>
          {index > 0 ? <HorizontalDivider /> : null}
          {section.actions.map(action => <DropdownMenuItem key={action.id}
            enabled={!blocked && !action.attributes?.disabled}
            elementColors={action.attributes?.destructive ? { textColor: GameColors.primary } : undefined}
            onClick={() => {
              setExpanded(false);
              if (!blocked && !action.attributes?.disabled) onSelect(action.id);
            }}>
            <DropdownMenuItem.Text><Text>{action.title}</Text></DropdownMenuItem.Text>
            <DropdownMenuItem.LeadingIcon><Icon source={APP_ICON_SOURCES[action.icon]} size={28} tint={null} /></DropdownMenuItem.LeadingIcon>
          </DropdownMenuItem>)}
        </Fragment>)}</DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  </View>;
}
