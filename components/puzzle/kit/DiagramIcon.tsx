import { Canvas, Circle, Group, Path, type SkSize } from '@shopify/react-native-skia';
import { Ink, Shape } from '@/constants/puzzle-theme';
import { objectMaterials } from '@/constants/puzzle-object-assets';
import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { glyphPaint, glyphs, type DiagramIconName, type DiagramIconTone } from '../glyphs/library';

export type { DiagramIconName, DiagramIconTone, ShopItem } from '../glyphs/library';

/** Draw directly into the model canvas when representing a set of objects. */
export const DiagramGlyph = memo(function DiagramGlyph({ name, tone = 'primary', cutout = false, displaySize }: {
  name: DiagramIconName; tone?: DiagramIconTone; displaySize: number; cutout?: boolean;
}) {
  const glyph = glyphs[name];
  const stroke = (displaySize < 24 ? Shape.stroke.small : Shape.stroke.silhouette) * 64 / Math.max(1, displaySize);
  const paint = glyphPaint(name, tone);
  if (!cutout || glyph.bottomLip) {
    // Fit the face and its three-point bottom lip inside the original glyph box.
    const lip = Shape.lip * 64 / Math.max(displaySize, Shape.lip + 1);
    const face = [{ scaleY: 1 - lip / 64 }];
    return <Group>
      <Group transform={[{ translateY: lip }, ...face]}>
        <Path path={glyph.body} color={paint.lip} />
        {glyph.accentMaterial && glyph.accent && <Path path={glyph.accent} color={tone === 'ghost' ? Shape.emptyLip : paint.accentEdge} />}
      </Group>
      <Group transform={face}>
        {name === 'mouse' && <Path path="M20 40 C16 51 6 53 3 46 C0 40 4 35 9 35 Q10 36 8 37 C4 38 3 42 5 45 C8 50 14 47 17 40 Z" color={paint.body} />}
        <Path path={glyph.body} color={paint.body} />
        {glyph.accent && <Path path={glyph.accent} color={paint.accent} />}
        {glyph.detail && <Path path={glyph.detail} color={glyph.bottomLip ? Ink.text : paint.edge} />}
        {name === 'balloon' && glyph.line && <Path path={glyph.line} color={paint.edge} style="stroke" strokeWidth={stroke} strokeCap="round" />}
        {name === 'bag' && <Path path="M21 17 Q30 20 41 16 L41 21 Q31 25 21 22 Z" color={paint.accent} />}
        {name === 'mouse' && <Circle cx={59} cy={39} r={2.8} color={tone === 'ghost' ? Ink.soft : objectMaterials.coral.edge} />}
      </Group>
    </Group>;
  }
  return <Group>
    <Path path={glyph.body} color={paint.body} />
    {glyph.accent && <Path path={glyph.accent} color={paint.accent} />}
    {glyph.detail && <Path path={glyph.detail} color={paint.edge} />}
    {name === 'bag' && <Path path="M21 17 Q30 20 41 16 L41 21 Q31 25 21 22 Z" color={paint.accent} />}
  </Group>;

});

export function DiagramIcon({ name, size, tone = 'primary', style, onSize, cutout }: {
  name: DiagramIconName; size: number; tone?: DiagramIconTone; style?: StyleProp<ViewStyle>;
  onSize?: SharedValue<SkSize>; cutout?: boolean;
}) {
  return <Canvas onSize={onSize} accessible={false} pointerEvents="none" style={[{ width: size, height: size }, style]}>
    <Group transform={[{ scale: size / 64 }]}><DiagramGlyph name={name} tone={tone} displaySize={size} cutout={cutout} /></Group>
  </Canvas>;
}
