import type { PlaceValueState } from './place-value';
import type { PracticeToken } from '@/types/visual-explanation';

/** Every unit retains its identity when ten loose units become a rod (or split). */
export function getPlaceValueTokens(state: PlaceValueState): PracticeToken[] {
  return Array.from({ length: state.tens * 10 + state.ones }, (_, index) => {
    const bundled = index < state.tens * 10;
    const loose = index - state.tens * 10;
    return {
      id: `unit-${index}`, label: '', shape: 'part', cornerRadius: 1,
      width: 9, height: 9, tone: bundled ? 'blue' : 'primary',
      x: bundled ? 28 + index % 10 * 9 : 190 + loose % 5 * 18,
      y: bundled ? 12 + Math.floor(index / 10) * 14 : 12 + Math.floor(loose / 5) * 18,
    };
  });
}
