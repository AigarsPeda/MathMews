import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink, PuzzleColors, Radius, Shape } from '@/constants/puzzle-theme';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';

export function LineStepButton({ direction, label, disabled, onPress, testID, accessibilityLabel }: {
  direction: -1 | 1; label: string; disabled: boolean; onPress: () => void; testID?: string; accessibilityLabel?: string;
}) {
  // The same geometry faces either way, independent of the platform emoji font.
  const text = label.replace(/^[←→]\s*|\s*[←→]$/g, '');
  const arrow = <View style={direction === -1 ? styles.flipped : undefined} accessible={false}>
    <Canvas style={styles.arrow}>
      <Path path="M0 4H14V0L20 7L14 14V10H0Z" color={disabled ? Ink.soft : PuzzleColors.primaryDark} />
    </Canvas>
  </View>;
  return <Pressable testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? text} accessibilityState={{ disabled }}
    style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
    {direction === -1 ? arrow : null}
    <Text style={[styles.text, disabled && styles.disabledText]}>{text}</Text>
    {direction === 1 ? arrow : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { flex: 1, minHeight: 48, padding: 8, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.control, backgroundColor: PuzzleColors.selectedSurface, borderColor: PuzzleColors.primary,
    borderBottomWidth: Shape.lip },
  disabled: { backgroundColor: Ink.guide, borderColor: Ink.trayEdge },
  disabledText: { color: Ink.soft },
  pressed: { opacity: .8 },
  text: { color: PuzzleColors.primaryDark, textAlign: 'center', fontSize: 16, fontWeight: '800', flexShrink: 1 },
  flipped: { transform: [{ scaleX: -1 }] },
  arrow: { width: 20, height: 14 },
});
