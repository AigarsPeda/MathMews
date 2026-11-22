import { Canvas, Circle, Group, Line, LinearGradient, vec } from '@shopify/react-native-skia';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { PuzzleText as Text } from './PuzzleText';

const copper = { light: '#FFDBAA', face: '#E99D68', edge: '#9A583B', ink: '#5F301E' };
const gold = { light: '#FFF0A4', face: '#F4C655', edge: '#B7892F', ink: '#634514' };
const silver = { light: '#F3F6F8', face: '#C5D0D8', edge: '#8A98A4', ink: '#384856' };

const grooves = Array.from({ length: 24 }, (_, i) => {
  const a = i * Math.PI / 12;
  return <Line key={i} p1={vec(24 + 19.5 * Math.sin(a), 22.5 + 19.5 * Math.cos(a))}
    p2={vec(24 + 20.9 * Math.sin(a), 22.5 + 20.9 * Math.cos(a))} color="#67482455" strokeWidth={.9} />;
});

/** Practice euro coins use their denomination and metal colors on both puzzle screens. */
export const MoneyCoin = memo(function MoneyCoin({ value, size = 43 }: { value: number; size?: number }) {
  const rim = value === 200 ? silver : value >= 10 ? gold : copper;
  const face = value === 100 ? silver : value === 200 ? gold : rim;
  const label = value >= 100 ? `€${value / 100}` : `${value}c`;
  return <View style={{ width: size, height: size }}>
    <Canvas style={StyleSheet.absoluteFill}>
      <Group transform={[{ scale: size / 48 }]}>
        <Circle cx={24} cy={25.5} r={21.5} color={rim.edge} />
        <Circle cx={24} cy={22.5} r={21.5}>
          <LinearGradient start={vec(10, 3)} end={vec(32, 44)} colors={[rim.light, rim.face]} />
        </Circle>
        {grooves}
        <Circle cx={24} cy={22.5} r={16.8} color={rim.edge} />
        <Circle cx={24} cy={22.5} r={16}>
          <LinearGradient start={vec(15, 7)} end={vec(33, 40)} colors={[face.light, face.face]} />
        </Circle>
      </Group>
    </Canvas>
    <View style={[styles.center, { bottom: size * .055 }]}>
      <Text allowFontScaling={false} style={{ color: face.ink, fontSize: size * (label.length > 2 ? .31 : .36), fontWeight: '900' }}>{label}</Text>
    </View>
  </View>;
});
const styles = StyleSheet.create({ center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' } });
