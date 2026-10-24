export type LearningAttemptContext = { helpUsed?: boolean };
export type SkillEvidence = {
  lastReviewedAt?: number;
  reviewCorrect?: number;
  reviewWrong?: number;
  independentPuzzleIds: string[];
  supportedSuccesses: number;
  mistakes: number;
  guidedSessions: number;
  lastPractisedAt: number;
  lastIndependentAt: number;
};
export type LearningEvidence = Record<string, SkillEvidence>;
