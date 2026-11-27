import type { PercentageExample, Puzzle } from '@/types/puzzle';
import { checkChallengeAnswer, type ChallengeAnswer } from '@/utils/challenge-puzzles';

export type PercentagePart = PercentageExample & { label?: string };
export type PercentagePlan = { parts: PercentagePart[]; budget?: number };

export function percentageRevealPlan(puzzle: Puzzle, answer: ChallengeAnswer | null): PercentagePlan | null {
  if (puzzle.percentageExample) return { parts: [puzzle.percentageExample] };
  if (puzzle.type !== 'budget_plan' || answer?.kind !== 'budget' || !checkChallengeAnswer(puzzle, answer)) return null;
  return {
    budget: puzzle.payload.budget,
    parts: answer.indices.map(index => {
      const { label, price, discountPercent } = puzzle.payload.items[index];
      return { label, whole: price, percent: discountPercent, kind: 'sale' };
    }),
  };
}

export function percentageAmount(part: PercentagePart) {
  return part.whole * part.percent / 100;
}

export function percentageFraction(percent: number) {
  if (percent === 0 || percent === 100) return String(percent / 100);
  let a = 100, b = percent;
  while (b) [a, b] = [b, a % b];
  return `${percent / a}/${100 / a}`;
}

/** A simple share of a whole can be counted in equal parts instead of 100 cells. */
export function percentageShareParts(percent: number) {
  return percent === 50 || percent === 25 || percent === 10 ? 100 / percent : null;
}
