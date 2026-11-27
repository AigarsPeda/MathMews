import { DiagramIcon } from './kit/DiagramIcon';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import { HelpProofContext } from './kit/HelpProofContext';
import { memo, useContext, type ComponentProps } from 'react';
import { useProofCanvasSize } from './everyday/PaintedModel';
import { StyleSheet, Text, View } from 'react-native';

export function MoneyDiagramIcon(props: ComponentProps<typeof DiagramIcon>) {
  const size = useProofCanvasSize(props.size > 0);
  return <DiagramIcon {...props} cutout onSize={size} />;
}

export const MoneyCoin = memo(function MoneyCoin({ value, label }: { value: number; label?: string }) {
  const help = useContext(HelpProofContext);
  const large = help && { width: 72, height: 72, borderRadius: 36 };
  const hue = value >= 100 ? Quantity.teal : Quantity.amber;
  return <View style={[styles.coin, large]}>
    <View style={[styles.disc, large, { top: Shape.lip, backgroundColor: hue.edge }]} />
    <View style={[styles.disc, large, { backgroundColor: help ? hue.fill : hue.light }]} />
    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, help && { fontSize: 26 }]}>{label ?? (value >= 100 ? `€${value / 100}` : `${value} c`)}</Text>
  </View>;
});

const styles = StyleSheet.create({
  coin: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  disc: { position: 'absolute', top: 0, left: 0, width: 36, height: 36, borderRadius: 18 },
  label: { color: Ink.text, fontWeight: '800', fontSize: 15 },
});
