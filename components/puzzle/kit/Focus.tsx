import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink, PuzzleColors } from '@/constants/puzzle-theme';
import { moderateScale } from '@/utils/scale';
import { ProofFinale, ProofPlaybackContext } from './ProofFeedback';
import { useContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';

export function Focus({ active, dimmed, children, style }: {
  /** This part is the one the current beat acts on. */
  active?: boolean;
  /** Another part is acting: retain this part at full contrast. */
  dimmed?: boolean;
  children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>
    {active && !dimmed && <View pointerEvents="none" accessible={false} style={styles.highlight} />}
    {children}
  </View>;
}

export function Caption({ strong = false, style, ...props }: TextProps & { strong?: boolean }) {
  return <Text {...props} style={[styles.caption, strong && styles.strong, style]} />;
}

/** One current caption. Let native text wrap the full phrase or equation at Dynamic Type sizes. */
export function ProofCaption({ text }: { text: string; /** @deprecated The current caption measures itself. */ reserveTexts?: readonly string[] }) {
  const { settled } = useContext(ProofPlaybackContext);
  const line = text.replace(/[\r\n]+/g, ' ').trim();
  return <View accessible={!!line} accessibilityRole="text" accessibilityLabel={line} style={styles.lane}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ProofFinale settled={settled}><Caption strong>{line || '\u00a0'}</Caption></ProofFinale>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  highlight: { ...StyleSheet.absoluteFill, backgroundColor: PuzzleColors.selectedSurface, borderRadius: 6 },
  lane: { alignSelf: 'stretch' },
  caption: { fontSize: Math.max(14, moderateScale(15)), lineHeight: Math.max(20, moderateScale(21)), fontWeight: '700', color: Ink.soft, textAlign: 'center' },
  strong: { color: Ink.text, fontWeight: '800', fontSize: Math.max(16, moderateScale(18)), lineHeight: Math.max(22, moderateScale(24)) },
});
