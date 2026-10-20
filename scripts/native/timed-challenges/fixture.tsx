/** Real curriculum and challenge UI, isolated from the player's wallet and save. */
import { PlaySession } from '@/app/play';
import PuzzlesScreen from '@/app/puzzles';
import AchievementsScreen from '@/app/achievements';
import { LearningLevelCard } from '@/components/puzzle/LearningLevelCard';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import type { AppLocale } from '@/types/locale';
import { LEARNING_CATALOG, getLearningLevelLocation, getPracticeIds } from '@/constants/curriculum';
import { createDefaultGameSave, parseGameSaveFromValue } from '@/utils/game-storage';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import { beginTimedChallenge, settleChallengeTimeout } from '@/utils/timed-challenge';
import { buyOneLife, canBuyLife } from '@/utils/lives';
import { getStoreCoinPrice } from '@/utils/store-catalog';
import type { GameSave } from '@/types/save';
import type { PuzzleDifficulty } from '@/types/puzzle';
import i18n from '@/i18n';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, ScrollView, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContext, useNavigation, type NavigationProp, type ParamListBase } from 'expo-router/react-navigation';

const PREVIOUS_FAST_REFRESH = true;
const practiceIds = LEARNING_CATALOG.lessons.flatMap(getPracticeIds);
const locations = LEARNING_CATALOG.lessons.flatMap(lesson => lesson.levels.filter(level => level.kind === 'challenge').map(level => ({ lesson, level })));
const firstIndex = locations.findIndex(location => location.lesson.difficulty === 'easy' && location.level.id.endsWith('pair-hunt'));
const bossLocations=LEARNING_CATALOG.lessons.flatMap(lesson=>lesson.levels.filter(level=>level.kind==='boss').map(level=>({lesson,level})));
function initialSave(): GameSave { const save = createDefaultGameSave(); return { ...save, progress: { ...save.progress, completedPuzzleIds: practiceIds } }; }
const actionNames = ['Reset', 'Fast', 'Reopen', 'LastLife', 'Other', 'LV', 'Catalog', 'Cards', 'Easy', 'Medium', 'Hard', 'Lesson3', 'Lessons', 'Trophies', 'Part', 'Collect', 'AllEndings'];
export default function TimedFixture() {
  const realGame = useGame(), router = useRouter(), navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [save, setSave] = useState(initialSave), [revision, setRevision] = useState(0);
  const [index, setIndex] = useState(firstIndex), [mode, setMode] = useState('play'), [tier, setTier] = useState<PuzzleDifficulty>('easy');
  const [lessonIndex,setLessonIndex]=useState(9), [boss,setBoss]=useState<ReturnType<typeof getLearningLevelLocation>>(), [phase,setPhase]=useState(0);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const [locale, setLocale] = useState<AppLocale>('en');
  async function changeLocale(next: AppLocale) { setLocale(next); await language.changeLanguage(next); setRevision(n => n+1); }
  const current = useRef(save);
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  function commit(next: GameSave) { current.current = next; setSave(next); }
  if (!__DEV__) return <Redirect href="/" />;
  const game = { ...realGame, wallet: save.wallet, pet: save.pet, progress: save.progress, isReady: true, hasCompletedOnboarding: true,
    recordInteraction: () => Date.now(), purchaseVisualHelp: () => true,
    beginChallenge(id: string) {
      const level = getLearningLevelLocation(id)?.level;
      if (!level) return false;
      const progress = beginTimedChallenge(current.current.progress, level, `qa-${Date.now()}`);
      if (!progress) return false;
      commit({ ...current.current, progress }); return true;
    },
    expireChallenge(id: string) { commit({ ...current.current, progress: settleChallengeTimeout(current.current.progress, Date.now(), id) }); },
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, puzzle, correct, id);
      if (result.save !== current.current) commit(result.save);
      return result.accepted ? result.coins : null;
    },
    async buyLife(cost = getStoreCoinPrice('life', 'one')!) {
      const old = current.current;
      if (!canBuyLife(old.progress.lives, old.wallet.coins)) return false;
      commit({ ...old, wallet: { coins: old.wallet.coins-cost }, progress: { ...old.progress, lives: buyOneLife(old.progress.lives) } }); return true;
    },
  };
  const actions: Record<string, () => void> = {
    Reset: () => { commit(initialSave()); setIndex(firstIndex); setBoss(undefined); setPhase(0); setLessonIndex(9); setMode('play'); void changeLocale('en'); },
    Fast: () => {
      const p = current.current.progress, run = p.challengeAttempt;
      if (!run || run.status !== 'active') return;
      const seconds = getLearningLevelLocation(run.levelId)!.level.timeLimitSeconds!;
      const deadlineAt = Date.now()+5000;
      commit({ ...current.current, progress: { ...p, challengeAttempt: { ...run, startedAt: deadlineAt-seconds*1000, deadlineAt } } });
    },
    Reopen: () => { commit(parseGameSaveFromValue(JSON.stringify(current.current))!.save); if(boss) setPhase(Math.max(0,boss.level.puzzleIds.findIndex(id=>!(current.current.progress.completedPuzzleIds??[]).includes(id)))); setRevision(n => n+1); },
    LastLife: () => commit({ ...current.current, progress: { ...current.current.progress, lives: { current: 1, nextRegenAt: null } } }),
    Other: () => { setBoss(undefined); setIndex(locations.findIndex(location => location.lesson.difficulty === 'medium')); setRevision(n => n+1); },
    LV: () => { void changeLocale('lv'); },
    Catalog: () => { setMode('catalog'); router.setParams({ difficulty: tier,topic:undefined,lesson:undefined }); },
    Cards: () => setMode('cards'),
    Easy: () => { setTier('easy'); router.setParams({ difficulty: 'easy',topic:undefined,lesson:undefined }); },
    Medium: () => { setTier('medium'); router.setParams({ difficulty: 'medium',topic:undefined,lesson:undefined }); },
    Hard: () => { setTier('hard'); router.setParams({ difficulty: 'hard',topic:undefined,lesson:undefined }); },
    Lesson3: () => { setLessonIndex(2); setMode('cards'); },
    Lessons: () => { setMode('catalog'); router.setParams({ difficulty:tier,topic:tier==='hard'?'patterns':'addition',lesson:undefined }); },
    Trophies: () => { setMode('trophies'); router.setParams({ boss:undefined }); },
    Part: () => { commit({...current.current,progress:{...current.current.progress,completedPuzzleIds:[...practiceIds,...bossLocations[0].level.puzzleIds.slice(0,2)]}});setRevision(n=>n+1); },
    Collect: () => {
      const chosen=[bossLocations[0],bossLocations[4],bossLocations.find(item=>item.level.id.endsWith('-picnic'))!];
      commit({...current.current,progress:{...current.current.progress,completedPuzzleIds:[...practiceIds,...chosen.flatMap(item=>item.level.puzzleIds)]}});setRevision(n=>n+1);
    },
    AllEndings: () => { commit({...current.current,progress:{...current.current.progress,completedPuzzleIds:[...practiceIds,...bossLocations.flatMap(item=>item.level.puzzleIds)]}});setRevision(n=>n+1); },
  };
  const selected = boss ?? locations[index];
  const localNavigation={...navigation,replace: (_name:string,params:{phase?:string})=>{setPhase(Number(params.phase??0));setRevision(n=>n+1);}};
  const finalLesson = LEARNING_CATALOG.lessons.filter(lesson => lesson.difficulty === tier && lesson.topicId === (tier === 'hard' ? 'patterns' : 'addition'))[lessonIndex];
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: changeLocale }}><GameContext.Provider value={game}><NavigationContext.Provider value={localNavigation}>
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>{mode === 'play' ? <PlaySession key={revision} session={{ ...selected, phase }} /> : mode === 'catalog' ? <PuzzlesScreen /> : mode === 'trophies' ? <AchievementsScreen key={revision} /> :
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF5EB' }}><ScrollView contentContainerStyle={{ padding: 16 }}>
          {finalLesson.levels.filter(level => level.kind !== 'practice').map(level => <LearningLevelCard key={level.id} level={level} state="current" completedIds={[]} onPress={() => {
            if(level.kind==='boss') setBoss(getLearningLevelLocation(level.id));
            else { setBoss(undefined); setIndex(locations.findIndex(location=>location.level.id===level.id)); }
            setPhase(0);setMode('play');setRevision(n=>n+1);
          }} />)}
        </ScrollView></SafeAreaView>}
      </View>
      <View style={{ padding: 4, paddingRight: 84, backgroundColor: '#E8FAF8', flexDirection: 'row', flexWrap: 'wrap' }}>
        {actionNames.map(label => <Pressable key={label} accessibilityRole="button" onPress={() => actions[label]()} style={{ padding: 8 }}><Text>{label}</Text></Pressable>)}
        <Text>{`QA coins ${save.wallet.coins}`}</Text>
      </View>
    </View>
  </NavigationContext.Provider></GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
}
