import { DiagramColors as Ink, DiagramFrameMetrics as Frame, PuzzleColors } from '@/constants/puzzle-theme';
import { Canvas, Group, Path, Rect, RoundedRect, Skia } from '@shopify/react-native-skia';
import type { DecimalRevealModel } from '@/utils/decimal-reveal';
import { glide } from '@/utils/puzzle-motion';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

export function BaseTenGrid({ model, index = 0, size, amount, beat }: {
  model?: DecimalRevealModel; index?: number; size: number; amount: SharedValue<number>; beat?: SharedValue<number>;
}) {
  const field = size - Frame.inset * 2;
  const unit = field / 10;
  const offset = index * 100;
  const exchange = model?.exchange;
  const total = model?.total ?? 100;
  const grid = model?.grid ?? true;
  const scale = model?.scale ?? 100;
  const whole = !grid && offset + 100 <= total;
  const vertical = scale === 10 && !whole;
  const localAmount = useDerivedValue(() => Math.max(0, Math.min(100, amount.get() - offset)));
  const fill = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const local = localAmount.get();
    if (vertical || whole) {
      path.addRect(Skia.XYWHRect(0, 0, field * local / 100, field));
    } else {
      const rows = Math.floor(local / 10);
      path.addRect(Skia.XYWHRect(0, 0, field, rows * unit));
      if (rows < 10) path.addRect(Skia.XYWHRect(0, rows * unit, (local - rows * 10) * unit, unit));
    }
    return path;
  });
  const { rules, changing } = useMemo(() => {
    const rules = Skia.Path.Make(), changing = Skia.Path.Make();
    if (vertical) {
      for (let i = 1; i < 10; i++) {
        rules.moveTo(i * unit, 0); rules.lineTo(i * unit, field);
      }
    } else if (whole) {
      if (exchange?.size === 100 && exchange.start === offset) {
        for (let i = 1; i < 10; i++) {
          changing.moveTo(0, i * unit); changing.lineTo(field, i * unit);
        }
      }
    } else {
      for (let row = 0; row < 10; row++) {
        if (row > 0) { rules.moveTo(0, row * unit); rules.lineTo(field, row * unit); }
        const start = offset + row * 10;
        const exchangedRow = exchange?.size === 10 && exchange.start === start;
        if (!grid && !exchangedRow && start + 10 <= total) continue;
        const lines = exchangedRow ? changing : rules;
        for (let col = 1; col < 10; col++) {
          lines.moveTo(col * unit, row * unit); lines.lineTo(col * unit, (row + 1) * unit);
        }
      }
    }
    return { rules, changing };
  }, [vertical, whole, exchange, offset, total, grid, unit, field]);
  const exchangeTrim = useDerivedValue(() => {
    const progress = glide(beat?.get() ?? 0);
    return exchange?.mode === 'split' ? progress : 1 - progress;
  });
  const inner = Skia.RRectXY(Skia.XYWHRect(0, 0, field, field), Frame.outerRadius - Frame.inset, Frame.outerRadius - Frame.inset);
  return <Canvas style={{ width: size, height: size }} accessible={false}>
    <RoundedRect x={0} y={0} width={size} height={size} r={Frame.outerRadius} color={Ink.decimalSurface} />
    <Group transform={[{ translateX: Frame.inset }, { translateY: Frame.inset }]}>
      <Group clip={inner}>
        <Rect x={0} y={0} width={field} height={field} color={PuzzleColors.card} />
        <Path path={fill} color={Ink.decimalFill} />
        <Path path={rules} color={Ink.decimalGrid} style="stroke" strokeWidth={1} />
        <Group clip={fill}>
          <Path path={rules} color={Ink.decimalEdge} style="stroke" strokeWidth={1.15} />
        </Group>
        {exchange && <Path path={changing} color={PuzzleColors.coinText} end={exchangeTrim} style="stroke" strokeWidth={1.7} />}
      </Group>
      <RoundedRect rect={inner} color={Ink.decimalEdge} style="stroke" strokeWidth={1.3} />
    </Group>
  </Canvas>;
}
