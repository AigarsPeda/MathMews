import type { AppIconName } from "@/constants/app-icons";
import type { ReactElement } from "react";

export type NativeMenuAction = {
  id: string;
  title: string;
  icon: AppIconName;
  section?: string;
  attributes?: { disabled?: boolean; destructive?: boolean };
};

export type NativeActionMenuProps = {
  width: number;
  height: number;
  actions: NativeMenuAction[];
  label: string;
  blocked: boolean;
  children: ReactElement;
  onSelect: (id: string) => void;
};
