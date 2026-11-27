import { Circle, Group } from '@shopify/react-native-skia';
import { memo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { Quantity, Shape } from '@/constants/puzzle-theme';
import type { QuantityTaskModel } from '@/types/puzzle';
import type { QuantityPiece } from '@/utils/quantity-task-scene';
import { DiagramGlyph } from '../kit/DiagramIcon';

/** Source, flight and landing all draw the same full-contrast object. */
export const CountingPiece = memo(function CountingPiece({ item, object, time, placed, duration = 1 }: {
  item: QuantityPiece; object: QuantityTaskModel['object']; time: SharedValue<number>; duration?: number; placed?: boolean;
}) {
  const transform = useDerivedValue(() => {
    const p = placed !== undefined ? Number(placed) : item.turn < 0 ? 0 : Math.max(0, Math.min(1, (time.get() - item.turn) / duration));
    const x = item.from.x + (item.to.x - item.from.x) * p;
    const y = item.from.y + (item.to.y - item.from.y) * p - 6 * Math.sin(Math.PI * p);
    return [{ translateX: x - item.size / 2 }, { translateY: y - item.size / 2 }, { scale: item.size / 64 }];
  });
  const counter = item.secondary ? Quantity.violet : Quantity.teal;
  const lip = Shape.lip * 64 / item.size;
  return <Group transform={transform}>{object ? <DiagramGlyph name={object} tone={item.secondary ? 'secondary' : 'primary'} displaySize={item.size} /> :
    <Group><Circle cx={32} cy={32 + lip / 2} r={26 - lip / 2} color={counter.edge} />
      <Circle cx={32} cy={32 - lip / 2} r={26 - lip / 2} color={counter.fill} /></Group>}</Group>;
});
