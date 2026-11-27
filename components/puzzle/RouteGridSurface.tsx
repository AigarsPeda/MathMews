import { moderateScale } from '@/utils/scale';
import { StyleSheet, View } from 'react-native';
import { Quantity, Shape } from '@/constants/puzzle-theme';

export const ROUTE_CELL = 72;
export const ROUTE_GAP = 10;
/** The walked route is one chunky shape: solid cells joined by wide bridges in the gaps, never a line across the numbers. */
const BRIDGE = 28;
const TUCK = 4;

export function RouteGridSurface({ width, columns, count, path, miss = false }: {
  width: number; columns: number; count: number; path: readonly number[]; miss?: boolean;
}) {
  if (width <= 0) return null;
  const cellWidth = (width - ROUTE_GAP * (columns - 1)) / columns;
  const left = (i: number) => i % columns * (cellWidth + ROUTE_GAP);
  const top = (i: number) => Math.floor(i / columns) * (ROUTE_CELL + ROUTE_GAP);
  const tone = miss ? Quantity.amber : Quantity.teal;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {path.slice(1).map((i, k) => {
      const prev = path[k]!;
      const across = top(i) === top(prev);
      return <View key={`b${k}`} style={across ? {
        position: 'absolute', left: Math.min(left(i), left(prev)) + cellWidth - TUCK, top: top(i) + (ROUTE_CELL - BRIDGE) / 2,
        width: ROUTE_GAP + 2 * TUCK, height: BRIDGE, backgroundColor: tone.fill,
      } : {
        position: 'absolute', left: left(i) + (cellWidth - BRIDGE) / 2, top: Math.min(top(i), top(prev)) + ROUTE_CELL - TUCK,
        width: BRIDGE, height: ROUTE_GAP + 2 * TUCK, backgroundColor: tone.fill,
      }} />;
    })}
    {Array.from({ length: count }, (_, i) => {
      const walked = path.includes(i);
      return <View key={i} style={[{
        position: 'absolute', left: left(i), top: top(i), width: cellWidth, height: ROUTE_CELL,
        borderRadius: Shape.tile(ROUTE_CELL), backgroundColor: walked ? tone.fill : Quantity.teal.soft,
      }, walked && { borderBottomWidth: Shape.lip, borderBottomColor: tone.edge }]}>{i === count - 1 && !walked && <View style={styles.flag} accessible={false}>
        <View style={styles.flagPole} /><View style={styles.flagCloth} />
      </View>}</View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  flag: { position: "absolute", top: 8, right: 10, width: moderateScale(14), height: moderateScale(18) },
  flagPole: { position: "absolute", left: 0, top: 0, bottom: 0, width: Shape.stroke.active, borderRadius: 2, backgroundColor: Quantity.teal.fill },
  // friendly-ok: the transparent sides define a filled triangular flag.
  flagCloth: { position: "absolute", left: Shape.stroke.active, top: 1, width: 0, height: 0, borderTopWidth: moderateScale(5), borderBottomWidth: moderateScale(5), borderLeftWidth: moderateScale(11),
    borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: Quantity.teal.fill },
});
