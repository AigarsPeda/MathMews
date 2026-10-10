export type SpotlightAim = { instanceId: string; angle: number; swivel: number };

/** One shared drawing-thread pose keeps the head and beam in sync. */
export function advanceSpotlightAim(current: SpotlightAim | undefined, target: SpotlightAim | undefined, dt: number, reduceMotion = false): SpotlightAim | undefined {
  'worklet';
  if (!target || !current || current.instanceId !== target.instanceId || reduceMotion) return target;
  const blend = 1 - Math.exp(-Math.max(0, Math.min(.1, dt)) / .045);
  const angle = current.angle + (target.angle - current.angle) * blend;
  const swivel = current.swivel + (target.swivel - current.swivel) * blend;
  if (Math.abs(target.angle - angle) < .01 && Math.abs(target.swivel - swivel) < .01) return target;
  return { instanceId: target.instanceId, angle, swivel };
}
