import { PUZZLE_RETRY_REACTIONS, PUZZLE_SUCCESS_REACTIONS, type PuzzleCatReaction } from "@/constants/puzzle-cat-reactions";

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
function getCompanionText(context: CompanionContext): { key: string; count?: number } {
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

export function getPuzzleCompanionMessage(context: CompanionContext): { key: string; count?: number; reaction: PuzzleCatReaction } {
  const message = getCompanionText(context);
  const hash = Array.from(context.puzzleId).reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 0);
  // Attempts advance through all retry performances. Rerenders keep the same
  // choice, and wording that offers a high paw gets the matching gesture.
  const reaction = !context.correct
    ? PUZZLE_RETRY_REACTIONS[(hash + context.retries) % PUZZLE_RETRY_REACTIONS.length]
    : ["persistence", "progress2", "bossComplete"].includes(message.key) ? "puzzleHighPaw"
    : message.key === "milestone" || message.key === "practiceComplete" || message.key === "challengeComplete" ? "puzzleBounce"
    : PUZZLE_SUCCESS_REACTIONS[(hash + context.completedCount) % PUZZLE_SUCCESS_REACTIONS.length];
  return { ...message, reaction };
}
