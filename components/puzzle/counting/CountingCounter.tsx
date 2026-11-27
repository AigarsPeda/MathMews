import { View } from 'react-native';
import { Quantity, Shape, type QuantityHue } from '@/constants/puzzle-theme';

export function CountingCounter({ diameter, hue = 'teal' }: { diameter: number; hue?: QuantityHue }) {
  const paint = Quantity[hue];
  const radius = Shape.coin(diameter);
  return <View style={{ width: diameter, height: diameter, borderRadius: radius, backgroundColor: paint.edge }}>
    <View style={{ height: diameter - Shape.lip, borderRadius: radius, backgroundColor: paint.fill }} />
  </View>;
}
