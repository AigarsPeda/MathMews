type CompanionContext = {
  correct: boolean;
  kind: "practice" | "boss" | "challenge";
  finalStage: boolean;
  practiceFinished: boolean;
  replay: boolean;
  retries: number;
  completedCount: number;
  puzzleId: string;
};

/** Based on the entry snapshot, so reward syncs cannot change a spoken message. */
export function getPuzzleCompanionMessage(context: CompanionContext): { key: string; count?: number } {
  if (!context.correct) return { key: context.retries > 0 ? "retryPatient" : "retry" };
  if (context.kind === "boss") return { key: context.finalStage ? "bossComplete" : "bossStage" };
  if (context.kind === "challenge") return { key: "challengeComplete" };
  if (context.replay) return { key: "replay" };
  if (context.practiceFinished) return { key: "practiceComplete" };
  if (context.retries > 0) return { key: "persistence" };
  if (context.completedCount > 0 && context.completedCount % 5 === 0) return { key: "milestone", count: context.completedCount };
  const hash = Array.from(context.puzzleId).reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 0);
  return { key: `progress${(hash + context.completedCount) % 4}` };
}
