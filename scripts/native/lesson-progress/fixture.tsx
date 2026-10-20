/** Production lesson list under isolated progress and language contexts. */
import PuzzlesScreen from '@/app/puzzles';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import { getLevelPuzzles, getPracticeIds, getTopicLessons } from '@/constants/curriculum';
import { GameColors } from '@/constants/game';
import { createDefaultGameSave, parseGameSaveFromValue } from '@/utils/game-storage';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import type { GameSave } from '@/types/save';
import type { AppLocale } from '@/types/locale';
import type { PuzzleDifficulty } from '@/types/puzzle';
import i18n from '@/i18n';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';

const PREVIOUS_FAST_REFRESH = true;
const actionNames = ['Reset', 'Reopen', 'Fresh', 'Wrong', 'LV', 'Narrow', 'easy', 'medium', 'hard'];
const topicFor = (tier: PuzzleDifficulty) => tier === 'hard' ? 'patterns' : 'addition';
function mixedSave(tier: PuzzleDifficulty): GameSave {
  const save = createDefaultGameSave(), lessons = getTopicLessons(tier, topicFor(tier));
  const ids = lessons.flatMap((lesson, index) => {
    const practice = getPracticeIds(lesson), boss = lesson.levels.find(level => level.kind === 'boss')!, challenge = lesson.levels.find(level => level.kind === 'challenge')!;
    if (index === 0) return [...practice, ...boss.puzzleIds, ...challenge.puzzleIds];
    if (index === 1) return practice.slice(0, 2);
    if (index === 2) return [...practice, ...challenge.puzzleIds];
    if (index === 3) return [...practice, boss.puzzleIds[0]];
    if (index === 4) return [...practice, ...boss.puzzleIds];
    return [];
  });
  return { ...save, progress: { ...save.progress, completedPuzzleIds: ids } };
}

export default function LessonProgressFixture() {
  const realGame = useGame(), router = useRouter();
  const [tier, setTier] = useState<PuzzleDifficulty>('easy'), [save, setSave] = useState(() => mixedSave('easy'));
  const [revision, setRevision] = useState(0), [narrow, setNarrow] = useState(false), [locale, setLocale] = useState<AppLocale>('en');
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const current = useRef(save);
  useEffect(() => {
    if (!__DEV__) return;
    router.setParams({ difficulty: 'easy', topic: 'addition', lesson: undefined });
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, [router]);
  function commit(next: GameSave) { current.current = next; setSave(next); setRevision(n => n + 1); }
  async function changeLocale(next: AppLocale) { setLocale(next); await language.changeLanguage(next); setRevision(n => n + 1); }
  function selectTier(next: PuzzleDifficulty) {
    setTier(next); commit(mixedSave(next)); router.setParams({ difficulty: next, topic: topicFor(next), lesson: undefined });
  }
  if (!__DEV__) return <Redirect href="/" />;
  const actions: Record<string, () => void> = {
    Reset: () => { setNarrow(false); setTier('easy'); commit(mixedSave('easy')); void changeLocale('en'); router.setParams({ difficulty: 'easy', topic: 'addition', lesson: undefined }); },
    Reopen: () => commit(parseGameSaveFromValue(JSON.stringify(current.current))!.save),
    Fresh: () => commit(createDefaultGameSave()),
    Wrong: () => {
      const first = getTopicLessons(tier, topicFor(tier))[0];
      const puzzle = getLevelPuzzles('en', first, first.levels.find(level => level.kind === 'practice')!)[0];
      commit(applyPuzzleAnswer(createDefaultGameSave(), puzzle, false, `progress-qa-${Date.now()}`).save);
    },
    LV: () => { void changeLocale('lv'); }, Narrow: () => setNarrow(true),
    easy: () => selectTier('easy'), medium: () => selectTier('medium'), hard: () => selectTier('hard'),
  };
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: changeLocale }}>
    <GameContext.Provider value={{ ...realGame, progress: save.progress, wallet: save.wallet, isReady: true, hasCompletedOnboarding: true }}>
      <View style={{ flex: 1, backgroundColor: GameColors.background }}>
        <View style={{ flex: 1, width: narrow ? 320 : '100%', alignSelf: 'center' }}><PuzzlesScreen key={revision} /></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 4, paddingRight: 80, backgroundColor: '#E8FAF8' }}>
          {actionNames.map(label => <Pressable key={label} accessibilityRole="button" onPress={() => actions[label]()} style={{ padding: 8 }}><Text>{label}</Text></Pressable>)}
        </View>
      </View>
    </GameContext.Provider>
  </LocaleContext.Provider></I18nextProvider>;
}
