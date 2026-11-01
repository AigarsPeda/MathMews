import { IconText } from "@/components/ui/IconText";
import { isLoaded } from "expo-font";
import { StyleSheet, type TextProps } from "react-native";

/** Bundled rounded type only inside puzzles. Keeps native text scaling and inline icons. */
export function PuzzleText({ style, ...props }: TextProps) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const numericWeight = weight === "bold" ? 700 : Number(weight) || 400;
  const family = numericWeight >= 800 ? "MewsNunito900" : numericWeight >= 600 ? "MewsNunito700" : "MewsNunito400";
  return <IconText {...props} style={[style, isLoaded(family) && { fontFamily: family, fontWeight: "normal" }]} />;
}
