import {
  LIFE_BUY_COST,
  LIFE_REGEN_MINUTES,
  MAX_LIVES,
} from '@/constants/game';
import type { LivesState } from '@/types/game';

const REGEN_MS = LIFE_REGEN_MINUTES * 60 * 1000;

export function createDefaultLives(now = Date.now()): LivesState {
  return { current: MAX_LIVES, nextRegenAt: null };
}

export function applyLifeRegen(
  lives: LivesState,
  now = Date.now(),
): LivesState {
  if (lives.current >= MAX_LIVES) {
    return { current: MAX_LIVES, nextRegenAt: null };
  }

  if (lives.nextRegenAt === null) {
    return {
      current: lives.current,
      nextRegenAt: now + REGEN_MS,
    };
  }

  if (now < lives.nextRegenAt) {
    return lives;
  }

  const elapsed = now - lives.nextRegenAt;
  const gained = 1 + Math.floor(elapsed / REGEN_MS);
  const current = Math.min(MAX_LIVES, lives.current + gained);

  if (current >= MAX_LIVES) {
    return { current: MAX_LIVES, nextRegenAt: null };
  }

  const remainder = elapsed % REGEN_MS;
  return {
    current,
    nextRegenAt: now + (REGEN_MS - remainder),
  };
}

export function loseLife(
  lives: LivesState,
  now = Date.now(),
): LivesState {
  const synced = applyLifeRegen(lives, now);
  const current = Math.max(0, synced.current - 1);

  if (current >= MAX_LIVES) {
    return { current: MAX_LIVES, nextRegenAt: null };
  }

  return {
    current,
    nextRegenAt: synced.nextRegenAt ?? now + REGEN_MS,
  };
}

export function msUntilNextLife(
  lives: LivesState,
  now = Date.now(),
): number | null {
  const synced = applyLifeRegen(lives, now);
  if (synced.current >= MAX_LIVES || synced.nextRegenAt === null) {
    return null;
  }
  return Math.max(0, synced.nextRegenAt - now);
}

export function regenProgress(regenMs: number): number {
  const total = LIFE_REGEN_MINUTES * 60 * 1000;
  return Math.min(1, Math.max(0, 1 - regenMs / total));
}

export function formatRegenCountdown(ms: number): string {
  return formatRegenClock(ms);
}

export function formatRegenClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function canSpendLife(lives: LivesState, now = Date.now()): boolean {
  return applyLifeRegen(lives, now).current > 0;
}

export function canBuyLife(
  lives: LivesState,
  coins: number,
  now = Date.now(),
): boolean {
  const synced = applyLifeRegen(lives, now);
  return synced.current < MAX_LIVES && coins >= LIFE_BUY_COST;
}

export function buyOneLife(
  lives: LivesState,
  now = Date.now(),
): LivesState {
  const synced = applyLifeRegen(lives, now);
  if (synced.current >= MAX_LIVES) {
    return synced;
  }

  const current = synced.current + 1;
  return {
    current,
    nextRegenAt: current >= MAX_LIVES ? null : synced.nextRegenAt,
  };
}
