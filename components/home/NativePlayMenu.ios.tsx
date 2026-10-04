import { Button, Host, Menu, RNHostView, Section } from "@expo/ui/swift-ui";
import { accessibilityLabel, buttonStyle, disabled, frame } from "@expo/ui/swift-ui/modifiers";
import type { NativePlayMenuProps } from "./NativePlayMenu.types";

export function NativePlayMenu({ width, height, actions, title, label, blocked, children, onSelect }: NativePlayMenuProps) {
  return (
    <Host style={{ width, height }} ignoreSafeArea="all">
      <Menu
        label={<RNHostView matchContents>{children}</RNHostView>}
        modifiers={[frame({ width, height }), buttonStyle("plain"), accessibilityLabel(label), disabled(blocked)]}
      >
        <Section title={title}>
          {actions.map((action) => (
            <Button key={action.id} label={action.title}
              modifiers={[disabled(action.attributes?.disabled ?? false)]}
              onPress={() => onSelect(action.id)} />
          ))}
        </Section>
      </Menu>
    </Host>
  );
}
