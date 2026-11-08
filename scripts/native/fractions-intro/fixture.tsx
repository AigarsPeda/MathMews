/** Capture the actual first Fractions path using disposable progress only. */
import { PlaySession } from '@/app/play';
import { getPathLesson } from '@/constants/puzzle-path';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import i18n from '@/i18n';
import type { GameSave } from '@/types/save';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import { createDefaultGameSave } from '@/utils/game-storage';
import { beginTimedChallenge } from '@/utils/timed-challenge';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';

const PREVIOUS_FAST_REFRESH = true;
const lesson = getPathLesson('easy', 'easy-fractions-parts')!;

function TaskPreview({ index }: { index: number }) {
  const realGame = useGame();
  const level = lesson.levels[index];
  const [save, setSave] = useState(() => {
    const local = createDefaultGameSave();
    local.progress.completedPuzzleIds = lesson.levels.slice(0, index).flatMap(item => item.puzzleIds);
    if (level.kind === 'challenge') {
      local.progress = beginTimedChallenge(local.progress, level, 'fractions-preview', Date.now(), 'untimed') ?? local.progress;
    }
    return local;
  });
  const current = useRef(save);
  const commit = (next: GameSave) => { current.current = next; setSave(next); };
  const game = {
    ...realGame, pet: save.pet, wallet: save.wallet, progress: save.progress,
    isReady: true, hasCompletedOnboarding: true,
    recordInteraction() { return 0; }, recordLearningHelp() {}, requestRoomDecoration() {},
    purchaseVisualHelp: () => true, buyLife: async () => false,
    beginChallenge: () => false, expireChallenge() {},
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, puzzle, correct, id);
      if (!result.accepted) return null;
      commit(result.save); return result.coins;
    },
  };
  return <GameContext.Provider value={game}><PlaySession session={{ lesson, level, phase: 0 }} /></GameContext.Provider>;
}

export default function FractionsIntroPreview() {
  const [index, setIndex] = useState(0);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const [ready, setReady] = useState(false);
  useEffect(() => { void language.changeLanguage('en').then(() => setReady(true)); }, [language]);
  useEffect(() => {
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale: 'en', isReady: true, setLocale: async () => {} }}>
    <View style={{ flex: 1 }}>
      {ready && <TaskPreview key={index} index={index} />}
      <Text testID="fractions-preview-index" style={{ position: 'absolute', width: 1, height: 1, color: 'transparent' }}>{index}</Text>
      <Pressable testID="fractions-preview-next" accessibilityRole="button" accessibilityLabel="Next preview" onPress={() => setIndex(value => (value + 1) % lesson.levels.length)} style={{ position: 'absolute', bottom: 2, left: 0, width: 44, height: 44 }} />
    </View>
  </LocaleContext.Provider></I18nextProvider>;
}
