import { PuzzlePreviewGame } from '@/components/dev/PuzzlePreviewGame';
/** Production screens with disposable local progress. No player save is written. */
import { type PuzzleLayoutMeasurement, PlaySession } from '@/app/play';
import { LocaleContext } from '@/contexts/LocaleProvider';
import type { Puzzle } from '@/types/puzzle';
import { getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES } from '@/constants/puzzles';
import { getPuzzleType } from '@/utils/puzzle-type';
import { getTimedChallengeLevel } from '@/constants/curriculum';
import { getPathLesson } from '@/constants/puzzle-path';
import type { AppLocale } from '@/types/locale';
import i18n from '@/i18n';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const params = useLocalSearchParams<{ single?: string; example?: string }>();
  const [step,setStep] = useState(0);
  const index = params.single === undefined ? step : Number(params.single);
  const [rows,setRows] = useState<(ReviewCase & PuzzleLayoutMeasurement)[]>([]);
  const item = useMemo(() => {
    const example = params.example;
    const difficulty = example && PUZZLE_DIFFICULTIES.find(level => getPuzzlesByDifficulty('en', level).some(p => p.id === example));
    return example && difficulty ? { id: example, locale: 'en' as const, difficulty, variant: 'solution' } : cases[index];
  }, [index, params.example]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sent = useRef(false);
  const [readyCase,setReadyCase] = useState(-1);
  const ready = readyCase === index;
  const locale: AppLocale = item?.locale ?? 'en';
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  useEffect(() => {
    sent.current=false;
    void language.changeLanguage(locale).then(()=>setReadyCase(index));
    return () => { if(timer.current) clearTimeout(timer.current); };
  }, [index, locale, language]);
  const base = getPathLesson(item?.difficulty ?? 'easy', `${item?.difficulty ?? 'easy'}-cat-plans-picnic`)!;
  const challenge = params.example ? getTimedChallengeLevel(params.example) : undefined;
  const level = challenge ?? { ...base.levels[0], puzzleIds: item ? [item.id] : base.levels[0].puzzleIds };
  const lesson = {...base, levels:[level]};
  const measured = useCallback((metrics:PuzzleLayoutMeasurement)=>{
    if(sent.current || !item || metrics.puzzleId!==item.id) return;
    if(timer.current) clearTimeout(timer.current);
    timer.current=setTimeout(()=>{
      sent.current=true;
      setRows(current => [...current, {...metrics,...item}]);
      if(!params.single && !params.example) setStep(index+1);
    },180);
  },[index,item,params.single,params.example]);
  if (!__DEV__) return <Redirect href="/" />;
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: async () => {} }}><PuzzlePreviewGame>
    <View style={{ flex: 1 }}>{item ? ready && <PlaySession key={params.example ?? index} session={{ lesson, level, phase: 0 }} onLayoutMeasured={measured} /> : <View><Text testID="layout-done">Audit complete</Text>
      <Text testID="layout-summary">{rows.filter(row => row.contentHeight > row.viewportHeight + 1).length} overflowing screens</Text>
      <Text testID="layout-count">{rows.length}</Text>
      <Text testID="layout-report" style={{position:'absolute',width:1,height:1,color:'transparent'}}>{JSON.stringify(rows)}</Text></View>}</View>
  </PuzzlePreviewGame></LocaleContext.Provider></I18nextProvider>;
}
