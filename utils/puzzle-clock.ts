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

export type ClockInput = {
  choices: readonly string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  elapsedUnit: 'hours' | 'minutes';
};

export type ClockAttempt = { choice: string; elapsedUnit: ClockInput['elapsedUnit'] };

/** Put authored clock choices on the same timeline as the given time, even across midnight. */
export function clockHandChoices(model: ClockModel, input: Pick<ClockInput, 'choices' | 'elapsedUnit'>): number[] {
  return input.choices.map(choice => {
    if (model.task === 'elapsed') return model.minutes + Number(choice) * (input.elapsedUnit === 'hours' ? 60 : 1);
    const [hour, minute] = choice.split(':').map(Number);
    const time = hour * 60 + minute;
    return time + DAY * Math.round((model.minutes + clockTravel(model) - time) / DAY);
  });
}
