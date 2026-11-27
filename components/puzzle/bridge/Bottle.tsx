/** One flat bottle drawing shared by the ratio table and its reveal. */
import { DiagramGlyph } from '@/components/puzzle/kit/DiagramIcon';
import { Quantity } from '@/constants/puzzle-theme';
import { StyleSheet, View } from 'react-native';
import { Group } from '@shopify/react-native-skia';

/** Drawn on a 24 × 48 box. */
export const BOTTLE_W = 24;
export const BOTTLE_H = 48;

/** Skia group for use inside an existing canvas: the shared `bottle` object glyph, fitted to a 24 × 48 slot. */
export function BottleShape({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  const glyphScale = scale * BOTTLE_H / 64;
  const offset = (BOTTLE_W * scale - 64 * glyphScale) / 2;
  return <Group transform={[{ translateX: x + offset }, { translateY: y }, { scale: glyphScale }]}>
    <DiagramGlyph name="bottle" cutout displaySize={64 * glyphScale} />
  </Group>;
}

/** One native silhouette per bottle keeps both groups painted when their fill changes. */
export function BottleRow({ count, size = 96, submittedFraction }: { count: number; size?: number; submittedFraction?: number }) {
  const width = size * BOTTLE_W / BOTTLE_H;
  return <View accessible={false} style={styles.row}>
    {Array.from({ length: count }, (_, i) => <View key={i} style={[styles.bottle, { height: size, width }]}>
      <View style={[styles.cap, { width: width * .58, height: size * .16 }]} />
      <View style={[styles.neck, { width: width * .44, height: size * .11 }]} />
      <View style={[styles.body, { width, borderTopLeftRadius: width * .4, borderTopRightRadius: width * .4 }]}>
        {submittedFraction !== undefined && <View style={[styles.liquid, {
          height: `${100 * (submittedFraction <= 1 ? 1 - submittedFraction : 1 - 1 / submittedFraction)}%`,
          backgroundColor: Quantity.amber.fill,
        }]} />}
      </View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  bottle: { alignItems: 'center' },
  cap: { backgroundColor: Quantity.teal.fill, borderRadius: 3 },
  neck: { backgroundColor: Quantity.teal.fill },
  liquid: { width: '100%' },
  body: { flex: 1, overflow: 'hidden', backgroundColor: Quantity.teal.fill, borderRadius: 4 },
});
