import { GameContext, useGame } from '@/contexts/GameProvider';
import { createDefaultGameSave } from '@/utils/game-storage';
import { buyOneLife, canBuyLife } from '@/utils/lives';
import { getStoreCoinPrice } from '@/utils/store-catalog';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import { beginTimedChallenge, settleChallengeTimeout } from '@/utils/timed-challenge';
import type { LearningLevel } from '@/types/curriculum';
import type { GameSave } from '@/types/save';
import { getPathLocation } from '@/constants/puzzle-path';
import { useCallback, useRef, useState, type ReactNode } from 'react';

/** Each mount starts a disposable puzzle session, including its wallet and challenge clock. */
export function PuzzlePreviewGame({ children, initialChallenge }: { children: ReactNode; initialChallenge?: LearningLevel }) {
  const realGame = useGame();
  const [save, setSave] = useState(() => {
    const fresh = createDefaultGameSave();
    if (!initialChallenge) return fresh;
    const progress = beginTimedChallenge(fresh.progress, initialChallenge, 'qa-fixture-' + initialChallenge.id, Date.now(), 'untimed');
    return progress ? { ...fresh, progress } : fresh;
  });
  const current = useRef(save);
  const commit = useCallback((next: GameSave) => { current.current = next; setSave(next); }, []);
  const beginChallenge = useCallback((id: string, pace: 'timed' | 'untimed' = 'timed') => {
    const start = getPathLocation(id)?.level;
    if (!start) return false;
    const now = Date.now(), progress = beginTimedChallenge(current.current.progress, start, `qa-${now}`, now, pace);
    if (!progress) return false;
    commit({ ...current.current, progress }); return true;
  }, [commit]);
  const expireChallenge = useCallback((id: string) => {
    commit({ ...current.current, progress: settleChallengeTimeout(current.current.progress, Date.now(), id) });
  }, [commit]);
  const game = { ...realGame, pet: save.pet, wallet: save.wallet, progress: save.progress, isReady: true, hasCompletedOnboarding: true,
    requestRoomDecoration() {}, recordInteraction() { return 0; }, recordLearningHelp() {}, purchaseVisualHelp: () => true,
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, puzzle, correct, id);
      if (result.save !== current.current) commit(result.save);
      return result.accepted ? result.coins : null;
    },
    async buyLife(cost = getStoreCoinPrice('life', 'one')!) {
      if (!canBuyLife(current.current.progress.lives, current.current.wallet.coins)) return false;
      commit({ ...current.current, wallet: { ...current.current.wallet, coins: current.current.wallet.coins - cost },
        progress: { ...current.current.progress, lives: buyOneLife(current.current.progress.lives) } });
      return true;
    },
    beginChallenge, expireChallenge,
  };
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}
