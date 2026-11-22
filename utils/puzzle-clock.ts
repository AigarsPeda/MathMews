import type { EverydayModel } from '@/types/everyday';

export type ClockModel = Extract<EverydayModel, { kind: 'clock' }>;

const DAY = 24 * 60;

export function clockTime(minutes: number) {
  const local = ((minutes % DAY) + DAY) % DAY;
  return [Math.floor(local / 60), local % 60].map(n => String(n).padStart(2, '0')).join(':');
}

/** Work from the given time. Keep full revolutions, including journeys past midnight. */
export function clockTravel(model: ClockModel): number {
  switch (model.task) {
    case 'elapsed': return ((model.end ?? model.minutes) - model.minutes + DAY) % DAY;
    case 'start': return -(model.duration ?? 0);
    case 'finish': return model.duration ?? 0;
    case 'read': return 0;
  }
}
