/** Production screens with disposable local progress. No player save is written. */
import PuzzlesScreen from '@/app/puzzles';
import { PlaySession } from '@/app/play';
import { GameHeaderStats } from '@/components/economy/GameHeaderStats';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import { getPathLocation, getPathLesson } from '@/constants/puzzle-path';
import { createDefaultGameSave } from '@/utils/game-storage';
import { buyOneLife, canBuyLife } from '@/utils/lives';
import { getStoreCoinPrice } from '@/utils/store-catalog';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import { beginTimedChallenge, settleChallengeTimeout } from '@/utils/timed-challenge';
import type { GameSave } from '@/types/save';
import type { AppLocale } from '@/types/locale';
import i18n from '@/i18n';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
export default function CatPlansFixture() {
  const realGame = useGame(), router = useRouter();
  const params = useLocalSearchParams<{ level?: string; lesson?: string }>();
  const [mode, setMode] = useState('topics'), [locale, setLocale] = useState<AppLocale>('en');
  const [save, setSave] = useState(createDefaultGameSave), current = useRef(save);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const lesson = getPathLesson('easy', params.lesson ?? 'easy-cat-plans-picnic')!;
  const level = lesson.levels.find(l => l.id === params.level) ?? lesson.levels[7];
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
  if (!__DEV__) return <Redirect href="/" />;
  const game = { ...realGame, pet: save.pet, wallet: save.wallet, progress: save.progress, isReady: true, hasCompletedOnboarding: true,
    recordInteraction() { return 0; }, recordLearningHelp() {}, purchaseVisualHelp: () => true,
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, puzzle, correct, id);
      if (!result.accepted) return null;
      commit(result.save); return result.coins;
    },
    async buyLife(cost = getStoreCoinPrice('life', 'one')!) {
      if (!canBuyLife(current.current.progress.lives, current.current.wallet.coins)) return false;
      commit({ ...current.current, wallet: { ...current.current.wallet, coins: current.current.wallet.coins - cost },
        progress: { ...current.current.progress, lives: buyOneLife(current.current.progress.lives) } });
      return true;
    },
    beginChallenge, expireChallenge,
  };
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: async () => {} }}><GameContext.Provider value={game}>
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1, width: locale === 'en' ? '100%' : 320, alignSelf: 'center' }}>
        {mode === 'play' ? <PlaySession key={locale} session={{ lesson, level, phase: 0 }} /> : mode === 'home' ? <View style={{ padding: 24, paddingTop: 100 }}><GameHeaderStats layout="home" coins={save.wallet.coins} streak={3} lives={save.progress.lives} /></View> : <PuzzlesScreen />}
      </View>
      <Text testID="qa-earned">{`Bread baskets ${save.progress.decorationQuantities?.kitchenBreadBasket ?? 0}`}</Text>
      <Text testID="qa-lives">{`Lives ${save.progress.lives.current}`}</Text>
      <Text testID="qa-run">{`Run ${save.progress.challengeAttempt?.status ?? 'none'}`}</Text>
      <Text testID="qa-coins">{`Coins ${save.wallet.coins}`}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingBottom: 20 }}>
        {['Topics', 'Timer', 'Reading', 'Party', 'Home', 'Language', 'Last life'].map(label => <Pressable accessibilityRole="button" testID={`qa-${label}`} key={label} style={{ minHeight: 44, padding: 10 }} onPress={async () => {
          if (label === 'Last life') { commit({ ...current.current, progress: { ...current.current.progress, lives: { current: 1, nextRegenAt: Date.now() + 1800000 } } }); return; }
          if (label === 'Language') { const next = locale === 'en' ? 'lv' : locale === 'lv' ? 'ru' : 'en'; await language.changeLanguage(next); setLocale(next); return; }
          if (label === 'Home') { setMode('home'); return; }
          if (label === 'Topics') { router.setParams({ topic: undefined, lesson: undefined, level: undefined }); setMode('topics'); return; }
          const id = label === 'Timer' ? 'picnic' : label === 'Reading' ? 'reading-corner' : 'cat-party';
          const selected = getPathLesson('easy', `easy-cat-plans-${id}`)!, step = label === 'Timer' ? 7 : 0;
          const fresh = createDefaultGameSave(); fresh.progress.completedPuzzleIds = selected.levels.slice(0, step).flatMap(l => l.puzzleIds);
          fresh.progress.unlockedPathLessonIds = [selected.id]; commit(fresh);
          router.setParams({ lesson: selected.id, level: selected.levels[step].id }); setMode('play');
        }}><Text>{label}</Text></Pressable>)}
      </View>
    </View>
  </GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
}
