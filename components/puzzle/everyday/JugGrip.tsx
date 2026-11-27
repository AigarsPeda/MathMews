import { StyleSheet, View } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import { Ink, Quantity } from '@/constants/puzzle-theme';

/** A fixed direction cue on a grip centred at the learner’s estimate. */
export function JugGrip({ x, y }: { x: number; y: number }) {
  return <View pointerEvents="none" accessible={false} style={[styles.grip, { left: x - 22, top: y - 16 }]}>
    <Canvas style={styles.chevrons}><Path path="M0 6 L6 0 L12 6 L9 9 L6 6 L3 9 Z M0 12 L3 9 L6 12 L9 9 L12 12 L6 18 Z" color={Ink.text} /></Canvas>
  </View>;
}
const styles = StyleSheet.create({
  grip: { position: 'absolute', width: 44, height: 32, borderRadius: 12, backgroundColor: Quantity.amber.fill,
    borderBottomWidth: 4, borderColor: Quantity.amber.edge, alignItems: 'center', justifyContent: 'center', gap: 4 },
  chevrons: { width: 12, height: 18 },
});
