import { Button, Host, Menu, RNHostView, Section } from "@expo/ui/swift-ui";
import { accessibilityLabel, buttonStyle, disabled, frame } from "@expo/ui/swift-ui/modifiers";
import type { NativeActionMenuProps } from "./NativeActionMenu.types";

export function NativeActionMenu({ width, height, actions, title, label, blocked, children, onSelect }: NativeActionMenuProps) {
  return (
    <Host style={{ width, height }} ignoreSafeArea="all">
      <Menu
        label={<RNHostView matchContents>{children}</RNHostView>}
        modifiers={[frame({ width, height }), buttonStyle("plain"), accessibilityLabel(label), disabled(blocked)]}
      >
        <Section title={title}>
          {actions.map((action) => (
            <Button key={action.id} label={action.title}
              systemImage={typeof action.image === "string" ? action.image : undefined}
              role={action.attributes?.destructive ? "destructive" : undefined}
              modifiers={[disabled(action.attributes?.disabled ?? false)]}
              onPress={() => { if (!blocked && !action.attributes?.disabled) onSelect(action.id); }} />
          ))}
        </Section>
      </Menu>
    </Host>
  );
}
