import type { LearningEvidence, SkillEvidence } from '@/types/learning';
import type { Puzzle } from '@/types/puzzle';

const empty = (): SkillEvidence => ({ independentPuzzleIds: [], supportedSuccesses: 0, mistakes: 0, guidedSessions: 0, lastPractisedAt: 0, lastIndependentAt: 0 });
/** Completion and rewards are deliberately separate from readiness evidence. */
export function recordLearningAttempt(evidence: LearningEvidence | undefined, puzzle: Puzzle, correct: boolean, independent: boolean, now: number): LearningEvidence {
  const id = puzzle.learning?.skillId;
  if (!id) return evidence ?? {};
  const entry = evidence?.[id] ?? empty();
  return { ...evidence, [id]: { ...entry,
    independentPuzzleIds: correct && independent ? [...new Set([...entry.independentPuzzleIds, puzzle.id])] : entry.independentPuzzleIds,
    supportedSuccesses: entry.supportedSuccesses + (correct && !independent ? 1 : 0),
    mistakes: entry.mistakes + (correct ? 0 : 1), lastPractisedAt: now,
    lastIndependentAt: correct && independent ? now : entry.lastIndependentAt,
  } };
}
export function recordGuidedLearning(evidence: LearningEvidence | undefined, skillId: string, now: number): LearningEvidence {
  const entry = evidence?.[skillId] ?? empty();
  return { ...evidence, [skillId]: { ...entry, guidedSessions: entry.guidedSessions + 1, lastPractisedAt: now } };
}
export function normalizeLearningEvidence(value: unknown, skills: ReadonlyMap<string, ReadonlySet<string>>): LearningEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: LearningEvidence = {};
  const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : 0;
  for (const [id, raw] of Object.entries(value)) {
    if (!skills.has(id) || !raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    result[id] = { independentPuzzleIds: Array.isArray(e.independentPuzzleIds) ? [...new Set(e.independentPuzzleIds.filter((p): p is string => typeof p === 'string' && skills.get(id)!.has(p)))] : [],
      lastReviewedAt: count(e.lastReviewedAt), reviewCorrect: count(e.reviewCorrect), reviewWrong: count(e.reviewWrong), supportedSuccesses: count(e.supportedSuccesses), mistakes: count(e.mistakes), guidedSessions: count(e.guidedSessions), lastPractisedAt: count(e.lastPractisedAt), lastIndependentAt: count(e.lastIndependentAt) };
  }
  return result;
}
