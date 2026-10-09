import { APP_ICON_SOURCES } from "@/constants/app-icons";
import { Button, Host, HStack, Image, Label, Menu, RNHostView, Section } from "@expo/ui/swift-ui";
import { accessibilityLabel, aspectRatio, buttonStyle, contentShape, disabled, frame, resizable, shapes } from "@expo/ui/swift-ui/modifiers";
import { useAssets } from "expo-asset";
import type { NativeActionMenuProps } from "./NativeActionMenu.types";
import { groupMenuSections } from "./native-menu-sections";

const menuIcons = Object.values(APP_ICON_SOURCES);

export function NativeActionMenu({ width, height, actions, label, blocked, children, onSelect }: NativeActionMenuProps) {
  // SwiftUI requires local files. Loading the family once also handles changing
  // room actions, and expo-asset caches the bundled files across menu instances.
  const [assets] = useAssets(menuIcons);
  return (
    <Host style={{ width, height }} ignoreSafeArea="all">
      <Menu label={<HStack spacing={0} modifiers={[frame({ width, height }), contentShape(shapes.rectangle())]}>
        <RNHostView matchContents>{children}</RNHostView>
      </HStack>}
        modifiers={[frame({ width, height }), buttonStyle("plain"), accessibilityLabel(label), disabled(blocked)]}>
        {groupMenuSections(actions).map((section, index) => <Section key={index}>
          {section.actions.map(action => {
            const uri = assets?.[menuIcons.indexOf(APP_ICON_SOURCES[action.icon])]?.localUri;
            return <Button key={action.id} role={action.attributes?.destructive ? "destructive" : undefined}
              modifiers={[disabled(action.attributes?.disabled ?? false)]}
              onPress={() => { if (!blocked && !action.attributes?.disabled) onSelect(action.id); }}>
              <Label title={action.title} icon={uri ? <Image uiImage={uri}
                modifiers={[resizable(), aspectRatio({ contentMode: "fit" }), frame({ width: 28, height: 28 })]} /> : undefined} />
            </Button>;
          })}
        </Section>)}
      </Menu>
    </Host>
  );
}
