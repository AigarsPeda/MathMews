/** Production screens with disposable local progress. No player save is written. */
import { type PuzzleLayoutMeasurement, PlaySession } from '@/app/play';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import type { Puzzle } from '@/types/puzzle';
import { getPuzzlesByDifficulty } from '@/constants/puzzles';
import { getPuzzleType } from '@/utils/puzzle-type';
import { getPathLocation, getPathLesson } from '@/constants/puzzle-path';
import { createDefaultGameSave } from '@/utils/game-storage';
import { buyOneLife, canBuyLife } from '@/utils/lives';
import { getStoreCoinPrice } from '@/utils/store-catalog';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import { beginTimedChallenge, settleChallengeTimeout } from '@/utils/timed-challenge';
import type { GameSave } from '@/types/save';
import type { AppLocale } from '@/types/locale';
import i18n from '@/i18n';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Text, View } from 'react-native';
type ReviewCase = { id: string; locale: AppLocale; difficulty: 'easy' | 'medium' | 'hard'; variant: string };
// Longest prompt and densest payload for every layout variant, in each language.
const cases: ReviewCase[] = (['en', 'lv', 'ru'] as const).flatMap(locale => {
  const groups = new Map<string, Puzzle[]>();
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    for (const puzzle of getPuzzlesByDifficulty(locale, difficulty)) {
      const payload = 'payload' in puzzle ? puzzle.payload : undefined;
      const model = puzzle.type === 'multiple_choice' ? puzzle.everyday?.model : undefined;
      const variant = [getPuzzleType(puzzle), payload && 'mode' in payload ? payload.mode : '', model?.kind, model && 'task' in model ? model.task : ''].filter(Boolean).join(':');
      const group = groups.get(variant) ?? []; group.push(puzzle); groups.set(variant, group);
    }
  }
  return [...groups].flatMap(([variant, puzzles]) => {
    const density = (p: Puzzle) => {
      const payload = 'payload' in p ? p.payload : undefined;
      return JSON.stringify(payload ?? (p.type === 'multiple_choice' ? p.everyday ?? p.taskVisual : undefined) ?? {}).length
        + (payload && 'guided' in payload && payload.guided ? 200 : 0);
    };
    const longest = [...puzzles].sort((a,b) => b.question.length - a.question.length)[0];
    const densest = [...puzzles].sort((a,b) => density(b) - density(a))[0];
    return [...new Set([longest,densest])].map(p => ({ id: p.id, difficulty: p.difficulty, locale, variant }));
  });
});

export default function PuzzleLayoutFixture() {
  const realGame = useGame();
  const params = useLocalSearchParams<{ single?: string }>();
  const [step,setStep] = useState(0);
  const index = params.single === undefined ? step : Number(params.single);
  const [rows,setRows] = useState<(ReviewCase & PuzzleLayoutMeasurement)[]>([]);
  const item = cases[index];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sent = useRef(false);
  const [readyCase,setReadyCase] = useState(-1);
  const ready = readyCase === index;
  const locale: AppLocale = item?.locale ?? 'en';
  const [save, setSave] = useState(createDefaultGameSave), current = useRef(save);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  useEffect(() => {
    sent.current=false;
    void language.changeLanguage(locale).then(()=>setReadyCase(index));
    return () => { if(timer.current) clearTimeout(timer.current); };
  }, [index, locale, language]);
  const base = getPathLesson(item?.difficulty ?? 'easy', `${item?.difficulty ?? 'easy'}-cat-plans-picnic`)!;
  const level = { ...base.levels[0], puzzleIds: item ? [item.id] : base.levels[0].puzzleIds };
  const lesson = {...base, levels:[level]};
  const measured = useCallback((metrics:PuzzleLayoutMeasurement)=>{
    if(sent.current || !item || metrics.puzzleId!==item.id) return;
    if(timer.current) clearTimeout(timer.current);
    timer.current=setTimeout(()=>{
      sent.current=true;
      setRows(current => [...current, {...metrics,...item}]);
      if(!params.single) setStep(index+1);
    },180);
  },[index,item,params.single]);
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
    <View style={{ flex: 1 }}>{item ? ready && <PlaySession key={index} session={{ lesson, level, phase: 0 }} onLayoutMeasured={measured} /> : <View><Text testID="layout-done">Audit complete</Text>
      <Text testID="layout-summary">{rows.filter(row => row.contentHeight > row.viewportHeight + 1).length} overflowing screens</Text>
      <Text testID="layout-count">{rows.length}</Text>
      <Text testID="layout-report" style={{position:'absolute',width:1,height:1,color:'transparent'}}>{JSON.stringify(rows)}</Text></View>}</View>
  </GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
}
