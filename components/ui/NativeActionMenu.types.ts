import type { AppIconName } from "@/constants/app-icons";
import type { ReactElement } from "react";

export type NativeMenuAction = {
  id: string;
  title: string;
  icon: AppIconName;
  attributes?: { disabled?: boolean; destructive?: boolean };
};

export type NativeActionMenuProps = {
  width: number;
  height: number;
  actions: NativeMenuAction[];
  title: string;
  label: string;
  blocked: boolean;
  children: ReactElement;
  onSelect: (id: string) => void;
};
