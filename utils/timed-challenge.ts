import { getLearningLevelLocation } from "@/constants/curriculum";
import type { LearningLevel } from "@/types/curriculum";
import type { ChallengeAttempt, Progress } from "@/types/game";
import { applyLifeRegen, loseLife } from "@/utils/lives";

type ChallengeProgress = Pick<Progress, "lives" | "challengeAttempt" | "attemptedPuzzleIds">;

/** Settle once, at the original deadline, then regenerate lives up to the current time. */
export function settleChallengeTimeout<T extends ChallengeProgress>(progress: T, now = Date.now(), expectedId?: string): T {
  const attempt = progress.challengeAttempt;
  if (!attempt || attempt.status !== "active" || now < attempt.deadlineAt || expectedId && expectedId !== attempt.id) return progress;
  const lives = applyLifeRegen(progress.lives, attempt.deadlineAt);
  const lifeLost = lives.current > 0;
  return { ...progress, lives: applyLifeRegen(lifeLost ? loseLife(lives, attempt.deadlineAt) : lives, now),
    challengeAttempt: { ...attempt, status: "expired", lifeLost } };
}

/** A running challenge must be resumed, never silently replaced by a fresh clock. */
export function beginTimedChallenge<T extends ChallengeProgress>(progress: T, level: LearningLevel, id: string, now = Date.now()): T | null {
  const synced = settleChallengeTimeout(progress, now);
  const previous = synced.challengeAttempt;
  if (previous?.status === "active") return previous.levelId === level.id ? synced : null;
  const seconds = level.timeLimitSeconds;
  const lives = applyLifeRegen(synced.lives, now);
  if (level.kind !== "challenge" || level.puzzleIds.length !== 1 || !seconds || !Number.isFinite(seconds) || seconds < 1 || lives.current < 1) return null;
  return { ...synced, lives, attemptedPuzzleIds: [...new Set([...(synced.attemptedPuzzleIds ?? []), level.puzzleIds[0]])], challengeAttempt: { id, levelId: level.id, puzzleId: level.puzzleIds[0], startedAt: now,
    deadlineAt: now + seconds * 1000, status: "active" } };
}

export function isChallengeOpen(attempt: ChallengeAttempt | undefined, puzzleId: string, now = Date.now()): boolean {
  return !!attempt && attempt.puzzleId === puzzleId && attempt.status === "active" && now < attempt.deadlineAt;
}

export function normalizeChallengeAttempt(value: unknown): ChallengeAttempt | undefined {
  if (!value || typeof value !== "object") return;
  const p = value as Partial<ChallengeAttempt>;
  if (typeof p.id !== "string" || !p.id || p.id.length > 200 || typeof p.levelId !== "string" || typeof p.puzzleId !== "string") return;
  const level = getLearningLevelLocation(p.levelId)?.level;
  if (!level || level.kind !== "challenge" || !level.timeLimitSeconds || level.puzzleIds[0] !== p.puzzleId || level.puzzleIds.length !== 1) return;
  if (typeof p.startedAt !== "number" || !Number.isFinite(p.startedAt) || p.startedAt < 0 || p.deadlineAt !== p.startedAt + level.timeLimitSeconds * 1000) return;
  if (p.status !== "active" && p.status !== "expired" && p.status !== "completed") return;
  return { id: p.id, levelId: p.levelId, puzzleId: p.puzzleId, startedAt: p.startedAt, deadlineAt: p.deadlineAt,
    status: p.status, ...(p.lifeLost === true && { lifeLost: true }) };
}

export function formatChallengeTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
