import type { EverydayModel } from '@/types/everyday';

export type CapacityModel = Extract<EverydayModel, { kind: 'capacity' }>;

/** The scale always measures millilitres, even when the answer counts containers. */
export function jugMeasure(model: CapacityModel) {
  const [first, second] = model.amounts;
  const start = model.task === 'total' || model.task === 'space' ? first : 0;
  const end = model.task === 'total' ? first + second : model.task === 'space' ? model.capacities[0] : first;
  const capacity = Math.max(end, ...model.capacities);
  const full = Math.floor(end / model.portion);
  const remainder = end % model.portion;
  const portions = model.task === 'containers' ? Math.ceil(end / model.portion) : model.task === 'servings' ? full : 0;
  return { start, end, capacity, full, remainder, portions };
}
