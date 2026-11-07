import { getLearningLevelLocation, getPuzzleLevelKind } from "@/constants/curriculum";
import { getPuzzleCoinReward, TIMED_CHALLENGE_REWARD_MULTIPLIER } from "@/constants/game";
import { getPathLocation } from "@/constants/puzzle-path";
import type { LearningLevel } from "@/types/curriculum";
import type { ChallengeAttempt, Progress } from "@/types/game";
import { applyLifeRegen, loseLife } from "@/utils/lives";

type ChallengeProgress = Pick<Progress, "lives" | "challengeAttempt" | "attemptedPuzzleIds">;

export function getTimedRunPuzzleIds(level: LearningLevel): string[] {
  const location = getPathLocation(level.id);
  if (!location) return [...level.puzzleIds];
  const index = location.lesson.levels.findIndex(item => item.id === level.id);
  return location.lesson.levels.slice(index).flatMap(item => item.puzzleIds);
}

/** Pending coins cannot be spent, claimed or counted as permanent completion. */
export function getTimedRunReward(progress: Pick<Progress, "challengeAttempt" | "completedPuzzleIds">): number {
  const run = progress.challengeAttempt;
  const location = run && getPathLocation(run.levelId);
  if (!run?.puzzleIds || !location) return 0;
  return (run.solvedPuzzleIds ?? []).reduce((sum, id) => sum + TIMED_CHALLENGE_REWARD_MULTIPLIER *
    getPuzzleCoinReward(location.lesson.difficulty, progress.completedPuzzleIds?.includes(id), getPuzzleLevelKind(id)), 0);
}

/** Settle once, at the original deadline, then regenerate lives up to the current time. */
export function settleChallengeTimeout<T extends ChallengeProgress>(progress: T, now = Date.now(), expectedId?: string): T {
  const attempt = progress.challengeAttempt;
  if (!attempt || attempt.status !== "active" || attempt.mode === "untimed" || now < attempt.deadlineAt || expectedId && expectedId !== attempt.id) return progress;
  const lives = applyLifeRegen(progress.lives, attempt.deadlineAt);
  const lifeLost = lives.current > 0;
  return { ...progress, lives: applyLifeRegen(lifeLost ? loseLife(lives, attempt.deadlineAt) : lives, now),
    challengeAttempt: { ...attempt, status: "expired", lifeLost,
      ...(attempt.puzzleIds && { puzzleId: attempt.puzzleIds[0], solvedPuzzleIds: [] }) } };
}

/** A running challenge must be resumed, never silently replaced by a fresh clock. */
export function beginTimedChallenge<T extends ChallengeProgress>(progress: T, level: LearningLevel, id: string, now = Date.now(), mode: "timed" | "untimed" = "timed"): T | null {
  const synced = settleChallengeTimeout(progress, now);
  const previous = synced.challengeAttempt;
  if (previous?.status === "active") return previous.levelId === level.id ? synced : null;
  const seconds = level.timeLimitSeconds;
  const lives = applyLifeRegen(synced.lives, now);
  if (level.kind !== "challenge" || level.puzzleIds.length !== 1 || !seconds || !Number.isFinite(seconds) || seconds < 1 || lives.current < 1) return null;
  return { ...synced, lives, attemptedPuzzleIds: [...new Set([...(synced.attemptedPuzzleIds ?? []), level.puzzleIds[0]])], challengeAttempt: { id, mode, levelId: level.id, puzzleId: level.puzzleIds[0], startedAt: now,
    ...(mode === "timed" && { puzzleIds: getTimedRunPuzzleIds(level), solvedPuzzleIds: [] }),
    deadlineAt: now + seconds * 1000, status: "active" } };
}

export function isChallengeOpen(attempt: ChallengeAttempt | undefined, puzzleId: string, now = Date.now()): boolean {
  return !!attempt && attempt.puzzleId === puzzleId && attempt.status === "active" && (attempt.mode === "untimed" || now < attempt.deadlineAt);
}

export function normalizeChallengeAttempt(value: unknown): ChallengeAttempt | undefined {
  if (!value || typeof value !== "object") return;
  const p = value as Partial<ChallengeAttempt>;
  if (typeof p.id !== "string" || !p.id || p.id.length > 200 || typeof p.levelId !== "string" || typeof p.puzzleId !== "string") return;
  const level = getLearningLevelLocation(p.levelId)?.level;
  if (!level || level.kind !== "challenge" || !level.timeLimitSeconds || level.puzzleIds.length !== 1) return;
  if (typeof p.startedAt !== "number" || !Number.isFinite(p.startedAt) || p.startedAt < 0 || p.deadlineAt !== p.startedAt + level.timeLimitSeconds * 1000) return;
  if (p.mode !== undefined && p.mode !== "timed" && p.mode !== "untimed") return;
  if (p.mode === "untimed" && p.status === "expired") return;
  if (p.status !== "active" && p.status !== "expired" && p.status !== "completed") return;
  if (p.mode !== "untimed" && (p.puzzleIds !== undefined || p.status === "active" || p.status === "expired")) {
    const puzzleIds = getTimedRunPuzzleIds(level);
    const solved = p.solvedPuzzleIds ?? [];
    if (p.puzzleIds !== undefined && (!Array.isArray(p.puzzleIds) || p.puzzleIds.length !== puzzleIds.length || p.puzzleIds.some((id, i) => id !== puzzleIds[i]))) return;
    if (!Array.isArray(solved) || solved.length > puzzleIds.length || solved.some((id, i) => id !== puzzleIds[i])) return;
    if (p.status === "completed" ? solved.length !== puzzleIds.length : solved.length >= puzzleIds.length) return;
    if (p.puzzleId !== (p.status === "completed" ? puzzleIds.at(-1) : puzzleIds[solved.length])) return;
    return { id: p.id, mode: "timed", levelId: p.levelId, puzzleId: p.puzzleId, startedAt: p.startedAt,
      deadlineAt: p.deadlineAt, status: p.status, puzzleIds, solvedPuzzleIds: solved, ...(p.lifeLost === true && { lifeLost: true }) };
  }
  if (level.puzzleIds[0] !== p.puzzleId) return;
  return { ...(p.mode && { mode: p.mode }), id: p.id, levelId: p.levelId, puzzleId: p.puzzleId, startedAt: p.startedAt, deadlineAt: p.deadlineAt,
    status: p.status, ...(p.lifeLost === true && { lifeLost: true }) };
}

export function formatChallengeTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
