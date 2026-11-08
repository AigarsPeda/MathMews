/** Real GameProvider actions and disk persistence. Only the onboarding gate is bypassed. */
import PlayScreen from '@/app/play';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import { getPathEntry, getTopicPaths, isPathAvailable } from '@/constants/puzzle-path';
import { createDefaultGameSave, loadGameSave } from '@/utils/game-storage';
import { grantCatPlanRewards } from '@/utils/cat-plan-rewards';
import { DEFAULT_CAT_SKIN_ID } from '@/constants/cat-skins';
import { useGraphicsMode } from '@/lib/graphics-mode';
import type { Progress } from '@/types/game';
import i18n from '@/i18n';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Platform, Pressable, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';

const PREVIOUS_FAST_REFRESH = true;
const [lesson, second] = getTopicPaths('easy', 'cat-plans');
function checkpoint(progress: Progress) {
  const run = progress.challengeAttempt;
  return JSON.stringify([run?.id, run?.deadlineAt, run?.puzzleId, run?.status, run?.solvedPuzzleIds,
    progress.completedPuzzleIds, progress.lives.current, progress.catPlanRewardsClaimed]);
}
export default function ColdReplayFixture() {
  const game = useGame(), router = useRouter(), params = useLocalSearchParams<{ lesson?: string }>();
  const graphicsMode = useGraphicsMode();
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const [revision, setRevision] = useState(0), [disk, setDisk] = useState('');
  const expected = checkpoint(game.progress), run = game.progress.challengeAttempt;
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'ios') return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  useEffect(() => {
    let active = true, timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      const saved = await loadGameSave();
      if (!active) return;
      const actual = saved ? checkpoint(saved.save.progress) : '';
      setDisk(actual);
      if (actual !== expected) timer = setTimeout(() => { void read(); }, 100);
    };
    void read();
    return () => { active = false; clearTimeout(timer); };
  }, [expected]);
  if (!__DEV__) return <Redirect href="/" />;
  if (!game.isReady) return <Text>QA loading production save</Text>;
  const resume = () => {
    const entry = getPathEntry(lesson, game.progress)!;
    router.setParams({ difficulty: 'easy', lesson: lesson.id, level: entry.level.id, replay: undefined });
    setRevision(value => value + 1);
  };
  const seed = async (step: number) => {
    if (Platform.OS === 'android' && !game.hasCompletedOnboarding) {
      if (!await game.completeOnboarding({ name: 'Replay QA', catSkinId: DEFAULT_CAT_SKIN_ID })) return;
    }
    const fresh = createDefaultGameSave();
    fresh.progress.completedPuzzleIds = lesson.levels.flatMap(level => level.puzzleIds);
    game.setProgress(() => grantCatPlanRewards(fresh).progress);
    router.setParams({ difficulty: 'easy', lesson: lesson.id, level: lesson.levels[step].id, replay: '1' });
    setRevision(value => value + 1);
  };
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale: 'en', isReady: true, setLocale: async () => {} }}>
    <GameContext.Provider value={{ ...game, hasCompletedOnboarding: true }}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flex: 1 }}>{params.lesson ? <PlayScreen key={revision} /> : null}</View>
        <Text testID="cold-run">{`QA run ${run?.id ?? 'none'}|${run?.deadlineAt ?? 0}|${run?.puzzleId ?? 'none'}|${run?.status ?? 'none'}|${run?.solvedPuzzleIds?.length ?? 0}`}</Text>
        <Text testID="cold-unlock">{`QA level 2 ${isPathAvailable(second, game.progress) ? 'open' : 'locked'}, lives ${game.progress.lives.current}`}</Text>
        <Text testID="cold-disk">{`QA disk ${disk === expected ? 'matches' : 'pending'}`}</Text>
        <Text testID="cold-graphics">{`QA graphics ${graphicsMode}`}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 24 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="QA Seed replay" style={{ padding: 10 }} onPress={() => { void seed(7); }}><Text>Seed replay</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="QA Seed full replay" style={{ padding: 10 }} onPress={() => { void seed(0); }}><Text>Full replay</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="QA Resume disk replay" style={{ padding: 10 }} onPress={resume}><Text>Resume</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="QA Near deadline" style={{ padding: 10 }} onPress={() => {
            game.setProgress(progress => {
              const attempt = progress.challengeAttempt;
              if (!attempt || attempt.status !== 'active') return progress;
              const deadlineAt = Date.now() + 20000;
              return { ...progress, challengeAttempt: { ...attempt, deadlineAt,
                startedAt: deadlineAt - lesson.levels[7].timeLimitSeconds! * 1000 } };
            });
          }}><Text>Near deadline</Text></Pressable>
        </View>
      </View>
    </GameContext.Provider>
  </LocaleContext.Provider></I18nextProvider>;
}
