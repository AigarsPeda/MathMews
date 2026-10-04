import { AppIcon } from "./AppIcon";
import { INLINE_ICONS } from "@/constants/inline-icons";
import { Children } from "react";
import { StyleSheet, Text, type TextProps } from "react-native";

const markers = new RegExp(`(${Object.keys(INLINE_ICONS).join("|")})`, "gu");

/** Native inline images preserve translated word order and wrapping. */
export function IconText({ children, style, ...props }: TextProps) {
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 14;
  return <Text {...props} style={style}>{Children.map(children, child => {
    if (typeof child !== "string") return child;
    return child.split(markers).map((part, index) => {
      const icon = INLINE_ICONS[part as keyof typeof INLINE_ICONS];
      return icon ? <AppIcon key={index} name={icon} size={fontSize * 1.2} /> : part;
    });
  })}</Text>;
}
