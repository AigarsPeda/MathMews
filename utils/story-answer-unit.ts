import type { Puzzle } from '@/types/puzzle';

/** Unit requested by the clay rate problems, also used beside the written answer. */
export function storyAnswerUnit(puzzle: Puzzle, locale: string): string {
  if (puzzle.helpTemplate !== 'rate' || !/gram|грам/i.test(puzzle.question)) return '';
  return locale.startsWith('ru') ? 'г' : 'g';
}
