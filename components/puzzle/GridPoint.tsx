import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';

export function GridPoint({ label, diameter = 28, hue = Quantity.teal, style, children }: {
  label?: string; diameter?: number; hue?: { fill: string; edge: string }; style?: ViewStyle; children?: ReactNode;
}) {
  const disc = { width: diameter, height: diameter, borderRadius: diameter / 2 };
  return <View pointerEvents="none" style={[disc, style]}>
    <View style={[styles.lip, disc, { backgroundColor: hue.edge }]} />
    <View style={[styles.face, disc, { backgroundColor: hue.fill }]}>
      {label && <Text allowFontScaling={false} style={styles.letter}>{label}</Text>}
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  lip: { position: 'absolute', left: 0, top: Shape.lip },
  face: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: Ink.text, fontWeight: '800', fontSize: 20, lineHeight: 24, textAlign: 'center', includeFontPadding: false },
});
