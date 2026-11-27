import { PressFace } from "./kit/PressFace";
import { PuzzleText } from "@/components/puzzle/PuzzleText";
import { Ink, PuzzleColors, Shape } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, type PressableProps } from "react-native";

export function PuzzleButton({ label, disabled, style, palette, wrapIcon, ...props }: Omit<PressableProps, "children"> & {
  label: string; wrapIcon?: string; palette?: { top: string; face: string; edge: string };
}) {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [wrapped, setWrapped] = useState('');
  const layoutKey = JSON.stringify([label, width, fontScale]);
  const useIcon = wrapIcon && wrapped === layoutKey;
  return <Pressable {...props} onLayout={wrapIcon ? event => {
    setWidth(event.nativeEvent.layout.width);
    props.onLayout?.(event);
  } : props.onLayout} disabled={disabled} accessibilityRole="button"
    accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
    style={state => [styles.button, typeof style === "function" ? style(state) : style]}>
    {({ pressed }) => <>
      <PressFace pressed={pressed && !disabled} raised={!disabled} fill={disabled ? Ink.guide : palette?.face ?? PuzzleColors.primary}
        edge={disabled ? Ink.guide : palette?.edge ?? PuzzleColors.primaryDark} radius={Shape.card(56)} borderWidth={0} />
      {useIcon ? <PuzzleText allowFontScaling={false} style={[styles.icon, disabled && styles.disabledLabel]}>{wrapIcon}</PuzzleText>
        : <PuzzleText key={layoutKey} style={[styles.label, disabled && styles.disabledLabel]}
          onTextLayout={wrapIcon && width > 0 ? event => {
            if (event.nativeEvent.lines.length > 1) setWrapped(layoutKey);
          } : undefined}>{label}</PuzzleText>}
    </>}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: moderateScale(56),
    justifyContent: "center", alignItems: "center", paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16) },
  label: { color: PuzzleColors.background, fontSize: moderateScale(17), fontWeight: "800", textAlign: "center" },
  icon: { color: PuzzleColors.background, fontSize: 28, fontWeight: "800", textAlign: "center" },
  disabledLabel: { color: PuzzleColors.textMuted },
});
