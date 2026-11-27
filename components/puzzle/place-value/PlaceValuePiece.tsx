import { Quantity } from '@/constants/puzzle-theme';
import { View } from 'react-native';

export function PlaceValuePiece({ width, height, hue, traced = false }: {
  width: number; height: number; hue: 'teal' | 'amber'; traced?: boolean;
}) {
  const radius = Math.min(10, height / 3);
  return <View pointerEvents="none" style={{
    width, height, paddingBottom: 3, borderRadius: radius, backgroundColor: Quantity[hue].edge,
    transform: [{ translateY: traced ? -3 : 0 }],
  }}><View style={{ flex: 1, borderRadius: radius, backgroundColor: Quantity[hue].fill }} /></View>;
}
