/** Production play screen with an isolated in-memory game. No wallet or save writes. */
import PuzzlesScreen from "@/app/puzzles";
import { LocaleContext } from "@/contexts/LocaleProvider";
import PlayScreen from "@/app/play";
import { GameContext, useGame } from "@/contexts/GameProvider";
import { getLearningLevelLocation, LEARNING_CATALOG } from "@/constants/curriculum";
import { getPathLesson } from "@/constants/puzzle-path";
import { createDefaultGameSave, parseGameSaveFromValue } from "@/utils/game-storage";
import { beginTimedChallenge, settleChallengeTimeout } from "@/utils/timed-challenge";
import { applyPuzzleAnswer } from "@/utils/game-operations";
import { buyOneLife, canBuyLife } from "@/utils/lives";
import { getStoreCoinPrice } from "@/utils/store-catalog";
import type { GameSave } from "@/types/save";
import type { AppLocale } from "@/types/locale";
import i18n from "@/i18n";
import { Redirect, Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from "react-native";

const PREVIOUS_FAST_REFRESH = true;
const lesson = LEARNING_CATALOG.lessons.find(l => l.id === "easy-patterns-jumps")!;
const level = lesson.levels[0];
const timedLesson = getPathLesson("easy", "easy-addition-join")!;
const timedLevel = timedLesson.levels.find(level => level.kind === "challenge")!;
export default function BerryFixture() {
  const router = useRouter();
  const [mode, setMode] = useState("selection"), [narrow, setNarrow] = useState(false), [locale, setLocale] = useState<AppLocale>("en");
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & {setHotLoadingEnabled(enabled:boolean):void}>("DevSettings");
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const realGame = useGame();
  const [save, setSave] = useState(createDefaultGameSave), [revision, setRevision] = useState(0);
  const current = useRef(save);
  const [language] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const commit = useCallback((next: GameSave) => { current.current = next; setSave(next); }, []);
  const beginChallenge = useCallback((id: string, mode: "timed" | "untimed" = "timed") => {
    const level = getLearningLevelLocation(id)?.level;
    if (!level) return false;
    const progress = beginTimedChallenge(current.current.progress, level, `qa-${Date.now()}`, Date.now(), mode);
    if (!progress) return false;
    commit({ ...current.current, progress }); return true;
  }, [commit]);
  const expireChallenge = useCallback((id: string) => { commit({ ...current.current, progress: settleChallengeTimeout(current.current.progress, Date.now(), id) }); }, [commit]);
  if (!__DEV__) return <Redirect href="/" />;
  const game = { ...realGame, pet: save.pet, wallet: save.wallet, progress: save.progress, isReady: true, hasCompletedOnboarding: true,
    recordInteraction() { return 0; }, purchaseVisualHelp: () => true,
    beginChallenge,
    expireChallenge,
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, puzzle, correct, id);
      if (!result.accepted) return null;
      commit(result.save); return result.coins;
    },
    async buyLife(cost = getStoreCoinPrice("life", "one")!) {
      const old = current.current;
      if (!canBuyLife(old.progress.lives, old.wallet.coins)) return false;
      commit({ ...old, wallet: { coins: old.wallet.coins-cost }, progress: { ...old.progress, lives: buyOneLife(old.progress.lives) } });
      return true;
    },
  };
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{locale,isReady:true,setLocale:async next => {setLocale(next); await language.changeLanguage(next);}}}><GameContext.Provider value={game}>
    <Stack.Screen options={{statusBarStyle:"dark",contentStyle:{backgroundColor:"#FFFFFF"}}} />
    <View style={{flex:1,backgroundColor:"#FFFFFF"}}><View style={{flex:1,width:narrow ? 320 : "100%",alignSelf:"center"}}>{mode === "selection" ? <PuzzlesScreen key={revision}/> : <PlayScreen key={revision} />}</View>
      <View style={{padding:6,backgroundColor:"#F3EEFF",flexDirection:"row",flexWrap:"wrap",justifyContent:"space-around"}}>
        {['Selection','Play','Timed','Fast','Reopen','Narrow','LV'].map(label => <Pressable key={label} accessibilityRole="button" onPress={() => {
          if(label==='Selection') {setMode('selection');router.setParams({topic:undefined,lesson:undefined,difficulty:'easy'});}
          if(label==='Play') {router.setParams({difficulty:lesson.difficulty,lesson:lesson.id,level:level.id,phase:undefined,replay:undefined});setMode('play');commit(createDefaultGameSave());setRevision(n=>n+1);}
          if(label==='Timed') {
            const next=createDefaultGameSave();next.progress.completedPuzzleIds=timedLesson.levels.slice(0,7).flatMap(level=>level.puzzleIds);
            next.progress.unlockedPathLessonIds=[timedLesson.id];commit(next);
            router.setParams({difficulty:'easy',lesson:timedLesson.id,level:timedLevel.id,phase:undefined,replay:undefined});setMode('play');setRevision(n=>n+1);
          }
          if(label==='Fast') {
            const run=current.current.progress.challengeAttempt;
            if(run?.status==='active') {const deadlineAt=Date.now()+5000;commit({...current.current,progress:{...current.current.progress,challengeAttempt:{...run,deadlineAt,startedAt:deadlineAt-timedLevel.timeLimitSeconds!*1000}}});}
          }
          if(label==='Reopen') {commit(parseGameSaveFromValue(current.current)!.save);setRevision(n=>n+1);}
          if(label==='Narrow') setNarrow(true);
          if(label==='LV') {setLocale('lv');void language.changeLanguage('lv');}
        }} style={{padding:10}}><Text>{label}</Text></Pressable>)}
        <Text>{`QA coins ${save.wallet.coins}`}</Text>
      </View>
    </View>
  </GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
}
