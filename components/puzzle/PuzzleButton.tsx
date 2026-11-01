import { PuzzleGradient } from "@/components/puzzle/PuzzleGradient";
import { PuzzleText } from "@/components/puzzle/PuzzleText";
import { PuzzleColors } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { Pressable, StyleSheet, type PressableProps } from "react-native";

export function PuzzleButton({ label, disabled, style, ...props }: Omit<PressableProps, "children"> & { label: string }) {
  return <Pressable {...props} disabled={disabled} accessibilityRole="button"
    accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
    style={state => [styles.button, disabled && styles.disabled, state.pressed && !disabled && styles.pressed,
      typeof style === "function" ? style(state) : style]}>
    {!disabled ? <PuzzleGradient colors={[PuzzleColors.primaryTop, PuzzleColors.primary]} /> : null}
    <PuzzleText style={[styles.label, disabled && styles.disabledLabel]}>{label}</PuzzleText>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: moderateScale(56), borderRadius: moderateScale(16), overflow: "hidden",
    backgroundColor: PuzzleColors.primary, borderBottomWidth: 4, borderBottomColor: PuzzleColors.primaryDark,
    justifyContent: "center", alignItems: "center", paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16) },
  disabled: { backgroundColor: "#E9ECF3", borderBottomColor: "#E9ECF3" },
  pressed: { opacity: 0.9, transform: [{ translateY: 1 }] },
  label: { color: "#FFFFFF", fontSize: moderateScale(17), fontWeight: "800", textAlign: "center" },
  disabledLabel: { color: PuzzleColors.textMuted },
});
