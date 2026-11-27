import { createPlayProofAudit, PlayProofAuditLog } from '@/components/dev/PlayProofAudit';
import { puzzleQADraft } from '@/utils/puzzle-qa-draft';
import { PuzzlePreviewGame } from '@/components/dev/PuzzlePreviewGame';
import { CountingAnnouncementLog } from '@/components/dev/CountingAnnouncementLog';
/** Production screens with disposable local progress. No player save is written. */
import { type PuzzleLayoutMeasurement, PlaySession } from '@/app/play';
import { PuzzleFixtureLocale, fixtureLocale } from '@/components/dev/PuzzleFixtureLocale';
import type { Puzzle } from '@/types/puzzle';
import { getPuzzlesByDifficulty, PUZZLE_DIFFICULTIES } from '@/constants/puzzles';
import { getPuzzleType } from '@/utils/puzzle-type';
import { getTimedChallengeLevel } from '@/constants/curriculum';
import { getPathLesson } from '@/constants/puzzle-path';
import type { AppLocale } from '@/types/locale';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const params = useLocalSearchParams<{ single?: string; example?: string; countingLog?: string; locale?: string; autoAnswer?: string; auditFrames?: string }>();
  const [step,setStep] = useState(0);
  const index = params.single === undefined ? step : Number(params.single);
  const [rows,setRows] = useState<(ReviewCase & PuzzleLayoutMeasurement)[]>([]);
  const item = useMemo(() => {
    const example = params.example;
    const difficulty = example && PUZZLE_DIFFICULTIES.find(level => getPuzzlesByDifficulty('en', level).some(p => p.id === example));
    if (example && !difficulty && !example.startsWith('challenge:')) return undefined;
    const exampleLocale = fixtureLocale(params.locale);
    return example && difficulty ? { id: example, locale: exampleLocale, difficulty, variant: 'solution' } : cases[index];
  }, [index, params.example, params.locale]);
  const outcome = params.autoAnswer === 'wrong' || params.autoAnswer === 'correct' ? params.autoAnswer : undefined;
  const proofAudit = useMemo(() => item && outcome ? createPlayProofAudit(item.id, params.auditFrames === '1') : undefined, [item, outcome, params.auditFrames]);
  const qaDraft = useMemo(() => outcome ? (puzzle: Puzzle) => puzzleQADraft(puzzle, outcome) : undefined, [outcome]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sent = useRef(false);
  const locale: AppLocale = item?.locale ?? 'en';
  useEffect(() => {
    sent.current=false;
    return () => { if(timer.current) clearTimeout(timer.current); };
  }, [index, item, locale]);
  const base = getPathLesson(item?.difficulty ?? 'easy', `${item?.difficulty ?? 'easy'}-cat-plans-picnic`)!;
  const challenge = params.example && params.example.startsWith("challenge:") ? getTimedChallengeLevel(params.example.slice(10)) : undefined;
  const level = challenge ?? { ...base.levels[0], kind: "practice" as const, timeLimitSeconds: undefined, puzzleIds: item ? [item.id] : base.levels[0].puzzleIds };
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
  if (params.example && !item) return <Text>Unknown puzzle fixture.</Text>;
  return <PuzzleFixtureLocale key={locale} locale={locale}><PuzzlePreviewGame initialChallenge={item && params.example === item.id ? getTimedChallengeLevel(item.id) : undefined} key={`${item?.id}-${locale}-${outcome}`}>
    <View style={{ flex: 1 }}>{item ? <PlaySession key={`${params.example ?? index}-${params.locale ?? ""}`} session={{ lesson, level, phase: 0 }} onLayoutMeasured={measured} qaDraft={qaDraft} proofAudit={proofAudit} /> : <View><Text testID="layout-done">Audit complete</Text>
      <Text testID="layout-summary">{rows.filter(row => row.contentHeight > row.viewportHeight + 1).length} overflowing screens</Text>
      <Text testID="layout-count">{rows.length}</Text>
      <Text testID="layout-report" style={{position:'absolute',width:1,height:1,color:'transparent'}}>{JSON.stringify(rows)}</Text></View>}</View>
    {proofAudit && <PlayProofAuditLog audit={proofAudit} />}
    {params.countingLog === '1' && <CountingAnnouncementLog />}
  </PuzzlePreviewGame></PuzzleFixtureLocale>;
}
