/** Production play UI with a QA-only selector and disposable in-memory save. */
import { PlaySession, type PuzzleLayoutMeasurement } from '@/app/play';
import { PUZZLE_PATHS } from '@/constants/puzzle-path';
import { getPuzzlesByDifficulty } from '@/constants/puzzles';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import i18n from '@/i18n';
import type { AppLocale } from '@/types/locale';
import type { Puzzle, PuzzleDifficulty } from '@/types/puzzle';
import { applyPuzzleAnswer } from '@/utils/game-operations';
import { createDefaultGameSave } from '@/utils/game-storage';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, TurboModuleRegistry, useWindowDimensions, View, type TurboModule } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PREVIOUS_FAST_REFRESH = true;
const cases: Record<string, { difficulty: PuzzleDifficulty; match: (puzzle: Puzzle) => boolean }> = {
  'ratio-easy': { difficulty: 'easy', match: p => p.type === 'ratio_table' && p.payload.a === 1 && p.payload.b === 2 && p.payload.targetA === 2 },
  'ratio-medium': { difficulty: 'medium', match: p => p.type === 'ratio_table' && p.payload.a === 2 && p.payload.b === 3 && p.payload.targetA === 4 },
  'ratio-hard': { difficulty: 'hard', match: p => p.type === 'ratio_table' && p.payload.a === 3 && p.payload.b === 12 && p.payload.targetA === 1 },
  'ratio-dense': { difficulty: 'medium', match: p => p.type === 'ratio_table' && p.payload.targetA === 20 },
  'equation-easy': { difficulty: 'easy', match: p => p.type === 'equation_board' && p.payload.a === 1 && p.payload.b === 1 && p.payload.c === 4 },
  'equation-medium': { difficulty: 'medium', match: p => p.type === 'equation_board' && p.payload.a === 2 && p.payload.b === 0 && p.payload.c === 12 },
  'equation-hard': { difficulty: 'hard', match: p => p.type === 'equation_board' && p.payload.a === 2 && p.payload.b === 3 && p.payload.c === 9 },
  'equation-dense': { difficulty: 'hard', match: p => p.type === 'equation_board' && p.payload.a === 4 && p.payload.b === 5 && p.payload.c === 13 },
  'equation-multiple-divide': { difficulty: 'medium', match: p => p.type === 'equation_board' && p.payload.a === 4 && p.payload.b === 0 && p.payload.c === 28 },
  'equation-divide-first': { difficulty: 'hard', match: p => p.type === 'equation_board' && p.payload.a === 3 && p.payload.b === -3 && p.payload.c === 12 },
  'equation-zero': { difficulty: 'easy', match: p => p.type === 'equation_board' && p.payload.a === 1 && p.payload.b === p.payload.c },
  'equation-negative': { difficulty: 'medium', match: p => p.type === 'equation_board' && p.payload.a === 1 && p.payload.b === -2 && p.payload.c === 0 },
};

export default function BridgeTeachingFixture() {
  const params = useLocalSearchParams<{ case?: string; locale?: string; run?: string }>();
  const insets = useSafeAreaInsets();
  const initialCase = params.case && cases[params.case] ? params.case : 'ratio-easy';
  const initialLocale: AppLocale = params.locale === 'lv' || params.locale === 'ru' ? params.locale : 'en';
  const [selection, setSelection] = useState({ caseName: initialCase, locale: initialLocale, narrow: false, run: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuLocale, setMenuLocale] = useState<AppLocale>(initialLocale);
  const [menuNarrow, setMenuNarrow] = useState(false);
  useEffect(() => {
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1, width: selection.narrow ? 364 : '100%', alignSelf: 'center' }}>
      <ReviewSession key={`${selection.caseName}-${selection.locale}-${selection.run}`} caseName={selection.caseName} locale={selection.locale} />
    </View>
    <Pressable testID="bridge-qa-menu" accessibilityRole="button" accessibilityLabel="Review case"
      onPress={() => { setMenuLocale(selection.locale); setMenuNarrow(selection.narrow); setMenuOpen(true); }}
      style={{ position: 'absolute', left: 12, top: insets.top + 44, minHeight: 22, paddingHorizontal: 6, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7DDE8', borderRadius: 5 }}>
      <Text allowFontScaling={false} style={{ fontSize: 10, color: '#24314B' }}>Review case</Text>
    </Pressable>
    <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#00000066', padding: 20, paddingTop: Math.max(20, insets.top) }}>
        <View style={{ maxHeight: '90%', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>Review case</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['en', 'lv', 'ru'] as const).map(locale => <Pressable key={locale} testID={`bridge-qa-locale-${locale}`} accessibilityRole="button" accessibilityState={{ selected: menuLocale === locale }} onPress={() => setMenuLocale(locale)}
              style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: menuLocale === locale ? '#E5F5FB' : '#FFFFFF', borderWidth: 1, borderColor: '#19758F', borderRadius: 8 }}>
              <Text>{locale.toUpperCase()}</Text>
            </Pressable>)}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[false, true].map(narrow => <Pressable key={String(narrow)} testID={narrow ? 'qa-width-narrow' : 'qa-width-normal'} accessibilityRole="button" accessibilityState={{ selected: menuNarrow === narrow }} onPress={() => setMenuNarrow(narrow)}
              style={{ flex: 1, minHeight: 44, padding: 8, justifyContent: 'center', backgroundColor: menuNarrow === narrow ? '#E5F5FB' : '#FFFFFF', borderWidth: 1, borderColor: '#19758F', borderRadius: 8 }}>
              <Text>{narrow ? '320 pt content' : 'Phone width'}</Text>
            </Pressable>)}
          </View>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {Object.keys(cases).map(caseName => <Pressable key={caseName} testID={`bridge-qa-case-${caseName}`} accessibilityRole="button" onPress={() => {
              setSelection(previous => ({ caseName, locale: menuLocale, narrow: menuNarrow, run: previous.run + 1 })); setMenuOpen(false);
            }} style={{ minHeight: 44, padding: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#D7DDE8', borderRadius: 8 }}>
              <Text>{caseName}</Text>
            </Pressable>)}
          </ScrollView>
          <Pressable testID="bridge-qa-close" accessibilityRole="button" onPress={() => setMenuOpen(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text>Close</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

function ReviewSession({ caseName, locale }: { caseName: string; locale: AppLocale }) {
  const realGame = useGame();
  const { fontScale } = useWindowDimensions();
  const item = cases[caseName];
  const puzzle = getPuzzlesByDifficulty(locale, item.difficulty).find(item.match)!;
  const base = PUZZLE_PATHS.find(lesson => lesson.levels.some(level => level.puzzleIds.includes(puzzle.id)))!;
  const sourceLevel = base.levels.find(level => level.puzzleIds.includes(puzzle.id))!;
  const level = { ...sourceLevel, kind: 'practice' as const, timeLimitSeconds: undefined, puzzleIds: [puzzle.id] };
  // Keep a next step in the isolated session so dismissing a result stays on this fixture route.
  const lesson = { ...base, levels: [level, ...base.levels.filter(candidate => candidate.id !== level.id)] };
  const [save, setSave] = useState(createDefaultGameSave);
  const current = useRef(save);
  const [language] = useState(() => i18n.cloneInstance({ lng: locale }));
  const [ready, setReady] = useState(false);
  const [metrics, setMetrics] = useState<PuzzleLayoutMeasurement | null>(null);
  useEffect(() => {
    let mounted = true;
    void language.changeLanguage(locale).then(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, [language, locale]);
  const measured = useCallback((next: PuzzleLayoutMeasurement) => {
    setMetrics(previous => previous?.puzzleId === next.puzzleId && previous.contentHeight === next.contentHeight && previous.viewportHeight === next.viewportHeight ? previous : next);
  }, []);
  const game = {
    ...realGame, pet: save.pet, wallet: save.wallet, progress: save.progress,
    isReady: true, hasCompletedOnboarding: true,
    recordInteraction() { return 0; }, recordLearningHelp() {}, purchaseVisualHelp: () => true,
    async buyLife() { return false; }, beginChallenge() { return false; }, expireChallenge() {}, requestRoomDecoration() {},
    answerPuzzle(answeredPuzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, answeredPuzzle, correct, id);
      if (!result.accepted) return null;
      current.current = result.save; setSave(result.save); return result.coins;
    },
  };
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: async () => {} }}><GameContext.Provider value={game}>
    <View style={{ flex: 1 }}>
      {ready ? <PlaySession session={{ lesson, level, phase: 0 }} onLayoutMeasured={measured} /> : null}
      <Text testID="bridge-qa-state" pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, fontSize: 1, color: 'transparent' }}>
        {JSON.stringify({ caseName, locale, fontScale, puzzleId: puzzle.id, ready, metrics, lives: save.progress.lives.current, completed: save.progress.completedPuzzleIds?.length ?? 0 })}
      </Text>
    </View>
  </GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
}
