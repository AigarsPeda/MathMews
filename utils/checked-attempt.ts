import type { Puzzle } from '@/types/puzzle';
import type { PuzzleAnswer } from '@/utils/puzzle-type';
import type { PuzzleDraft } from '@/utils/puzzle-attempt';
import type { TFunction } from 'i18next';

export type AttemptArrangement = {
  selectedSlices: readonly number[];
  decimalCells: readonly number[];
  distribution: readonly number[];
  matchedIds: readonly string[];
};

export type CheckedAttempt = {
  puzzle: Puzzle;
  prompt: string;
  responseMode: NonNullable<Puzzle['response']>['kind'] | 'model';
  answer: PuzzleAnswer;
  draft: PuzzleDraft;
  arrangement: AttemptArrangement;
  correct: boolean;
};

// Replay metadata can differ when two move sequences reach the same equation.
export function checkedAnswerKey(answer: PuzzleAnswer | null): string {
  if (answer?.kind === 'bridge' && answer.state.equation) {
    const { a, b, c } = answer.state.equation;
    return JSON.stringify(['equation', a, b, c]);
  }
  return JSON.stringify(answer);
}

export function effectivePuzzlePrompt(puzzle: Puzzle, t: TFunction) {
  if (puzzle.response?.prompt) return puzzle.response.prompt;
  if (puzzle.type === 'fraction_match' && !puzzle.response) return t('puzzleTypes.fractionMatchShade');
  if (puzzle.type === 'operation_path') return t('play.reachTarget', { value: puzzle.payload.target });
  if (puzzle.type === 'budget_plan') return t('challenges.budgetGoal', { budget: puzzle.payload.budget, count: puzzle.payload.pickCount, remaining: puzzle.payload.remaining });
  if (puzzle.type === 'fair_share' && puzzle.payload.object === 'cookie') return t('cookieShare.goal', { cookies: t('cookieShare.cookies', { count: puzzle.payload.items }), plates: puzzle.payload.people });
  if (puzzle.type === 'multiple_choice' && puzzle.taskVisual?.kind === 'array' && puzzle.taskVisual.object === 'mouse') return t('objectScenes.countMice', { rows: puzzle.taskVisual.rows, columns: puzzle.taskVisual.columns });
  return puzzle.question;
}

// Drafts and arrays are immutable React state. Copy at the submission boundary
// so subsequent moves, including those owned by a child board, cannot affect replay.
export function freezeCheckedAttempt(puzzle: Puzzle, prompt: string, draft: PuzzleDraft, answer: PuzzleAnswer, arrangement: AttemptArrangement, correct: boolean): CheckedAttempt {
  const data = JSON.parse(JSON.stringify({ draft, answer, arrangement })) as Pick<CheckedAttempt, 'draft' | 'answer' | 'arrangement'>;
  return { puzzle, prompt, responseMode: puzzle.response?.kind ?? 'model', correct, ...data };
}
