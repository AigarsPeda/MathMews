/**
 * Shared surfaces for every puzzle model. A diagram is flat ink on paper; only
 * things the learner can press get a lower lip. See docs/PUZZLE_STYLE_GUIDE.md.
 */
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink, PuzzleColors, Quantity, Radius, Shape } from '@/constants/puzzle-theme';
import { PressFace } from './PressFace';
import { moderateScale } from '@/utils/scale';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

/** Neutral work surface behind a model. Never pressable. */
export function ModelTray({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.tray, style]}>{children}</View>;
}

/** A given value printed in the model: flat, no lip, never looks tappable. */
export function ValueChip({ label, size = 'md', tone, style, textStyle }: {
  label: string; size?: 'sm' | 'md' | 'lg'; tone?: keyof typeof Quantity;
  style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
}) {
  const palette = tone ? Quantity[tone] : undefined;
  return <View style={[styles.chip, styles[`chip_${size}`], palette && { backgroundColor: palette.soft }, style]}>
    <Text style={[styles.chipText, styles[`chipText_${size}`], textStyle]}>{label}</Text>
  </View>;
}

/**
 * A value nobody has entered yet. Passive unknowns use a soft zone;
 * an `active` well is the slot the learner is filling (berry tint).
 */
export function UnknownWell({ label = '?', active = false, filled = false, size = 'md', style }: {
  label?: string; active?: boolean; filled?: boolean; size?: 'sm' | 'md' | 'lg'; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.chip, styles[`chip_${size}`], filled ? styles.wellFilled : styles.well, active && styles.wellActive, style]}>
    <Text style={[styles.chipText, styles[`chipText_${size}`], !filled && styles.wellText, active && styles.wellActiveText]}>{label}</Text>
  </View>;
}

/** A movable or tappable tile: a rounded face with a lower lip that compresses on press. */
export function NumberTile({ label, selected = false, disabled = false, operatorDisc = false, style, textStyle, ...props }: Omit<PressableProps, 'children' | 'style'> & {
  label: string; selected?: boolean; operatorDisc?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
}) {
  return <Pressable {...props} disabled={disabled} accessibilityRole={props.accessibilityRole ?? 'button'}
    accessibilityState={{ ...props.accessibilityState, disabled: !!disabled, selected }}
    style={[styles.tile, style]}>
    {({ pressed }) => <>
      <PressFace pressed={pressed && !disabled} raised radius={operatorDisc ? 22 : Shape.card(52)} borderWidth={0}
        fill={operatorDisc ? (selected ? Quantity.violet.fill : Quantity.violet.light) : selected ? PuzzleColors.selectedSurface : Shape.empty}
        edge={operatorDisc ? Quantity.violet.edge : selected ? PuzzleColors.primary : Shape.emptyLip} />
      <Text style={[styles.tileText, selected && styles.tileTextSelected, textStyle]}>{label}</Text>
    </>}
  </Pressable>;
}

/** Check / cross drawn from strokes so result states never rely on color alone. */
export function ResultMark({ kind, size = 18, color }: { kind: 'correct' | 'wrong'; size?: number; color?: string }) {
  const c = color ?? (kind === 'correct' ? PuzzleColors.success : PuzzleColors.incorrect);
  const w = Math.max(2.5, size / 6);
  if (kind === 'correct') return <View accessible={false} style={{ width: size, height: size }}>
    <View style={{ position: 'absolute', left: size * .12, top: size * .52, width: size * .36, height: w, borderRadius: w, backgroundColor: c, transform: [{ rotate: '45deg' }] }} />
    <View style={{ position: 'absolute', left: size * .3, top: size * .42, width: size * .66, height: w, borderRadius: w, backgroundColor: c, transform: [{ rotate: '-50deg' }] }} />
  </View>;
  return <View accessible={false} style={{ width: size, height: size }}>
    {['45deg', '-45deg'].map(r => <View key={r} style={{ position: 'absolute', left: size * .08, top: size / 2 - w / 2, width: size * .84, height: w, borderRadius: w, backgroundColor: c, transform: [{ rotate: r }] }} />)}
  </View>;
}

const styles = StyleSheet.create({
  tray: { backgroundColor: Ink.tray, borderRadius: Radius.tray, padding: moderateScale(12) },
  chip: { alignItems: 'center', justifyContent: 'center', backgroundColor: Ink.tray },
  chip_sm: { minWidth: moderateScale(32), minHeight: moderateScale(32), borderRadius: Radius.piece + 2, paddingHorizontal: moderateScale(6) },
  chip_md: { minWidth: moderateScale(44), minHeight: moderateScale(44), borderRadius: Radius.piece + 4, paddingHorizontal: moderateScale(8) },
  chip_lg: { minWidth: moderateScale(56), minHeight: moderateScale(56), borderRadius: Radius.tray, paddingHorizontal: moderateScale(10) },
  chipText: { color: Ink.text, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  chipText_sm: { fontSize: moderateScale(16) },
  chipText_md: { fontSize: moderateScale(20) },
  chipText_lg: { fontSize: moderateScale(26) },
  well: { backgroundColor: Ink.tray },
  wellFilled: { backgroundColor: Ink.guide },
  wellText: { color: Ink.soft },
  wellActive: { backgroundColor: PuzzleColors.selectedSurface },
  wellActiveText: { color: PuzzleColors.primaryDark },
  tile: { minWidth: moderateScale(52), minHeight: moderateScale(52), alignItems: 'center', justifyContent: 'center', paddingHorizontal: moderateScale(10) },
  tileText: { color: Ink.text, fontSize: moderateScale(22), fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileTextSelected: { color: PuzzleColors.primaryDark },
});
