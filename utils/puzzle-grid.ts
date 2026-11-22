import type { EverydayModel } from '@/types/everyday';

export type GridModel = Extract<EverydayModel, { kind: 'grid' }>;

export function gridSteps(model: GridModel) {
  if (model.task === 'rotate') return model.turns;
  if (model.task === 'reflect') return 1;
  return Math.abs(model.dx) + Math.abs(model.dy);
}

/** Cell centres have half-integer coordinates. One step is one square, one flip, or one quarter-turn. */
export function gridPose(model: GridModel, step: number) {
  'worklet';
  const startX = (model.start - 1) % model.size + .5;
  const startY = Math.floor((model.start - 1) / model.size) + .5;
  const centre = model.size / 2;
  if (model.task === 'rotate') {
    const angle = step * Math.PI / 2;
    const dx = startX - centre, dy = startY - centre;
    return { x: centre + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: centre + dx * Math.sin(angle) + dy * Math.cos(angle), angle, scaleX: 1 };
  }
  if (model.task === 'reflect') {
    const scaleX = Math.cos(Math.PI * step);
    return { x: centre + (startX - centre) * scaleX, y: startY, angle: 0, scaleX };
  }
  const across = Math.min(step, Math.abs(model.dx));
  return { x: startX + Math.sign(model.dx) * across, y: startY + Math.sign(model.dy) * (step - across), angle: 0, scaleX: 1 };
}

export function gridStops(model: GridModel) {
  const steps = gridSteps(model);
  const stops = [{ step: 0, square: model.start }];
  for (let step = 1; step <= steps; step++) {
    if (model.task === 'translate' && step !== Math.abs(model.dx) && step !== steps) continue;
    const { x, y } = gridPose(model, step);
    stops.push({ step, square: Math.floor(y) * model.size + Math.floor(x) + 1 });
  }
  return stops;
}
