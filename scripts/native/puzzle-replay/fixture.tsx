/** Disposable save around the production route gate and native result sheets. */
import PlayScreen from '@/app/play';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import { getPathEntry, getPathLocation, getTopicPaths, isPathAvailable } from '@/constants/puzzle-path';
import { createDefaultGameSave, parseGameSaveFromValue } from '@/utils/game-storage';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import { grantCatPlanRewards } from '@/utils/cat-plan-rewards';
import { beginTimedChallenge, settleChallengeTimeout } from '@/utils/timed-challenge';
import type { GameSave } from '@/types/save';
import i18n from '@/i18n';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';

const PREVIOUS_FAST_REFRESH = true;
const [lesson, second] = getTopicPaths('easy', 'cat-plans');
function replaySave() {
  const save = createDefaultGameSave();
  save.progress.completedPuzzleIds = lesson.levels.flatMap(level => level.puzzleIds);
  return grantCatPlanRewards(save);
}
export default function ReplayFixture() {
  const realGame = useGame(), router = useRouter();
  const params = useLocalSearchParams<{ lesson?: string }>();
  const [save, setSave] = useState(replaySave), current = useRef(save);
  const [revision, setRevision] = useState(0);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const commit = useCallback((next: GameSave) => { current.current = next; setSave(next); }, []);
  useEffect(() => {
    router.setParams({ difficulty: 'easy', lesson: lesson.id, level: lesson.levels[0].id, replay: '1' });
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, [router]);
  const beginChallenge = useCallback((id: string, mode: 'timed' | 'untimed' = 'timed') => {
    const level = getPathLocation(id)?.level;
    if (!level) return false;
    const now = Date.now(), progress = beginTimedChallenge(current.current.progress, level, `qa-${now}`, now, mode);
    if (!progress) return false;
    commit({ ...current.current, progress }); return true;
  }, [commit]);
  const expireChallenge = useCallback((id: string) => {
    commit({ ...current.current, progress: settleChallengeTimeout(current.current.progress, Date.now(), id) });
  }, [commit]);
  if (!__DEV__) return <Redirect href="/" />;
  const game = { ...realGame, pet: save.pet, wallet: save.wallet, progress: save.progress, isReady: true, hasCompletedOnboarding: true,
    recordInteraction() { return 0; }, recordLearningHelp() {}, purchaseVisualHelp: () => true,
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, puzzle, correct, id);
      if (!result.accepted) return null;
      commit(result.save); return result.coins;
    },
    beginChallenge, expireChallenge,
  };
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale: 'en', isReady: true, setLocale: async () => {} }}><GameContext.Provider value={game}>
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1 }}>{params.lesson ? <PlayScreen key={revision} /> : null}</View>
      <Text>{`QA level 2 ${isPathAvailable(second, save.progress) ? 'open' : 'locked'}, lives ${save.progress.lives.current}, run ${save.progress.challengeAttempt?.status ?? 'none'}`}</Text>
      <Text>{`QA baskets ${save.progress.decorationQuantities?.kitchenBreadBasket ?? 0}, coins ${save.wallet.coins}`}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 24 }}>
        {['Replay', 'Timed', 'Resume', 'Reopen', 'Expire'].map(label => <Pressable key={label} accessibilityRole="button" accessibilityLabel={`QA ${label}`} style={{ padding: 10 }} onPress={() => {
          if (label === 'Expire') {
            const run = current.current.progress.challengeAttempt;
            if (run) {
              const deadlineAt = Date.now() - 1, seconds = lesson.levels[7].timeLimitSeconds!;
              const progress = { ...current.current.progress, challengeAttempt: { ...run, startedAt: deadlineAt - seconds * 1000, deadlineAt } };
              commit({ ...current.current, progress: settleChallengeTimeout(progress) });
            }
            return;
          }
          if (label === 'Reopen') commit(parseGameSaveFromValue(JSON.stringify(current.current))!.save);
          if (label === 'Resume' || label === 'Reopen') {
            const entry = getPathEntry(lesson, current.current.progress)!;
            // Simulate an older resume link without the optional replay flag.
            router.setParams({ difficulty: 'easy', lesson: lesson.id, level: entry.level.id, replay: undefined });
          } else {
            commit(replaySave());
            router.setParams({ difficulty: 'easy', lesson: lesson.id, level: lesson.levels[label === 'Timed' ? 7 : 0].id, replay: '1' });
          }
          setRevision(value => value + 1);
        }}><Text>{label}</Text></Pressable>)}
      </View>
    </View>
  </GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
}
