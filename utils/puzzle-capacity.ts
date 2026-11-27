import type { EverydayModel } from '@/types/everyday';

export type CapacityModel = Extract<EverydayModel, { kind: 'capacity' }>;

/** The scale always measures millilitres, even when the answer counts containers. */
export function jugMeasure(model: CapacityModel) {
  const [first, second] = model.amounts;
  const start = model.task === 'total' || model.task === 'space' ? first : 0;
  const end = model.task === 'total' ? first + second : model.task === 'space' ? model.capacities[0] : first;
  const capacity = model.task === 'total' ? model.capacities.reduce((sum, value) => sum + value, 0) : Math.max(end, ...model.capacities);
  const full = Math.floor(end / model.portion);
  const remainder = end % model.portion;
  const portions = model.task === 'containers' ? Math.ceil(end / model.portion) : model.task === 'servings' ? full : 0;
  return { start, end, capacity, full, remainder, portions };
}

/** Calibrated graduations in ml. The rim may be a partial interval. */
export function jugScale(model: CapacityModel, capacity: number) {
  const portions = model.task === 'containers' || model.task === 'servings';
  const minor = model.task === 'litres' ? 250 : portions ? model.portion : 100;
  const interval = model.task === 'litres' ? 1000 : portions ? model.portion : 200;
  const marks = Array.from({ length: Math.ceil(capacity / minor) }, (_, i) => i * minor).concat(capacity);
  const majors = marks.filter(value => value === capacity || value % interval === 0);
  const closest = Math.min(...majors.slice(1).map((value, i) => value - majors[i]));
  return { marks, majors, closest, minor };
}

export type CapacityInput = {
  choices: readonly string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
};
export type CapacityAttempt = { choice?: string };

/** Compare the child's proposed amount and the givens on the same millilitre scale. */
export function capacityChoiceLevel(model: CapacityModel, choice?: string) {
  if (!choice || !/^\d+(?:[.,]\d+)?$/.test(choice)) return undefined;
  const value = Number(choice.replace(',', '.'));
  if (!Number.isFinite(value)) return undefined;
  if (model.task === 'containers' || model.task === 'servings') return value * model.portion;
  if (model.task === 'litres') return Math.round(value * 1000);
  if (model.task === 'space') return model.amounts[0] + value;
  return value;
}
