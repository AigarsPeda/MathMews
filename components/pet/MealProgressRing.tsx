import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";

export const MEAL_RING_SIZE = moderateScale(28);
const STROKE = moderateScale(5);
/** A pale rim keeps the ring readable over any floor or furniture colour. */
const RIM = moderateScale(1.5);
const RADIUS = MEAL_RING_SIZE / 2 - RIM - STROKE / 2;

export function MealProgressRing({ bites, total }: { bites: number; total: number }) {
  const count = Number.isFinite(total) && total > 0 ? Math.min(20, Math.floor(total)) : 0;
  const filled = Number.isFinite(bites) ? Math.max(0, Math.min(count, Math.floor(bites))) : 0;
  const arcs = useMemo(() => Array.from({ length: count }, (_, index) => {
    const angle = 360 / count;
    const gap = count === 1 ? 0 : Math.min(4, angle * .15);
    return Skia.PathBuilder.Make().addArc({
      x: MEAL_RING_SIZE / 2 - RADIUS, y: MEAL_RING_SIZE / 2 - RADIUS, width: RADIUS * 2, height: RADIUS * 2,
    }, -90 + index * angle + gap / 2, angle - gap).detach();
  }), [count]);
  return (
    <Canvas style={{ width: MEAL_RING_SIZE, height: MEAL_RING_SIZE }}>
      <Circle cx={MEAL_RING_SIZE / 2} cy={MEAL_RING_SIZE / 2} r={RADIUS}
        color={GameColors.card} style="stroke" strokeWidth={STROKE + RIM * 2} />
      {arcs.map((arc, index) => <Path key={index} path={arc} opacity={index < filled ? 1 : .3}
        color={GameColors.hunger} style="stroke" strokeWidth={STROKE} strokeCap="butt" />)}
    </Canvas>
  );
}
