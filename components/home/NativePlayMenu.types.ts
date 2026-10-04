import type { MenuAction } from "@expo/ui/community/menu";
import type { ReactElement } from "react";

export type NativePlayMenuProps = {
  width: number;
  height: number;
  actions: (MenuAction & { id: string })[];
  title: string;
  label: string;
  blocked: boolean;
  children: ReactElement;
  onSelect: (id: string) => void;
};
