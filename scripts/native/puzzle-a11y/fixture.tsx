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
import { Text, View, Pressable } from 'react-native';
type ReviewCase = { id: string; locale: AppLocale; difficulty: 'easy' | 'medium' | 'hard'; variant: string };
const cases: ReviewCase[] = [
  {
    "id": "v2-easy-multiplication-lesson-5-boss-3",
    "variant": "balance",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-hard-percentages-lesson-1-challenge-1",
    "variant": "budget_plan",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-easy-easy-numbers-explore-4-path-review-2",
    "variant": "compare",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-medium-operations-explore-9-path-review-2",
    "variant": "coordinate_map_distance",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-numbers-lesson-9-boss-1",
    "variant": "coordinate_map_plot",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-operations-lesson-9-boss-2",
    "variant": "coordinate_map_translate",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-fractions-explore-9-4",
    "variant": "decimal_grid",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-fractions-lesson-7-challenge-1",
    "variant": "decimal_place_value_build",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-fractions-explore-9-2",
    "variant": "decimal_place_value_bundle",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-fractions-explore-9-3",
    "variant": "decimal_place_value_split",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-addition-explore-8-1",
    "variant": "equation_board",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-hard-measurement-explore-4-3",
    "variant": "estimate",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-medium-division-equal-1",
    "variant": "fair_share",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-addition-expedition-10-1",
    "variant": "find_all_pairs",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-addition-explore-9-4",
    "variant": "fix_mistake",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-fractions-lesson-4-boss-3",
    "variant": "fraction_build",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-fractions-explore-6-4",
    "variant": "fraction_equivalent",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-fractions-fountain-3",
    "variant": "fraction_match",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-fractions-explore-6-2",
    "variant": "fraction_number_line",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-fractions-explore-3-1",
    "variant": "fraction_strip_build",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-fractions-lesson-6-challenge-1",
    "variant": "fraction_strip_equivalent",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-easy-multiplication-explore-9-path-review-2",
    "variant": "function_machine",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-hard-measurement-lesson-1-challenge-1",
    "variant": "geometry_measure_area",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-hard-measurement-explore-6-4",
    "variant": "geometry_measure_compare",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-hard-measurement-lesson-6-challenge-1",
    "variant": "geometry_measure_missing_area",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-hard-measurement-lesson-6-boss-3",
    "variant": "geometry_measure_missing_perimeter",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-hard-measurement-explore-3-3",
    "variant": "geometry_measure_perimeter",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-easy-patterns-lesson-3-boss-3",
    "variant": "multiple_choice_",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-multiplication-lesson-7-boss-1",
    "variant": "multiple_choice_array",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-data-lesson-7-1",
    "variant": "multiple_choice_bars_difference",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-data-lesson-5-7",
    "variant": "multiple_choice_bars_least",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-hard-data-lesson-5-7",
    "variant": "multiple_choice_bars_mean",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-medium-data-lesson-10-4",
    "variant": "multiple_choice_bars_missing",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-data-lesson-3-7",
    "variant": "multiple_choice_bars_most",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-hard-data-lesson-3-7",
    "variant": "multiple_choice_bars_range",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-medium-data-lesson-1-7",
    "variant": "multiple_choice_bars_read",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-data-lesson-8-7",
    "variant": "multiple_choice_bars_total",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-capacity-lesson-10-4",
    "variant": "multiple_choice_capacity_containers",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-capacity-lesson-2-4",
    "variant": "multiple_choice_capacity_litres",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-capacity-lesson-1-7",
    "variant": "multiple_choice_capacity_read",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-capacity-lesson-7-1",
    "variant": "multiple_choice_capacity_servings",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-capacity-lesson-6-4",
    "variant": "multiple_choice_capacity_space",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-capacity-lesson-9-4",
    "variant": "multiple_choice_capacity_total",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-time-lesson-4-4",
    "variant": "multiple_choice_clock_elapsed",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-time-lesson-10-10",
    "variant": "multiple_choice_clock_finish",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-time-lesson-3-4",
    "variant": "multiple_choice_clock_read",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-time-lesson-7-7",
    "variant": "multiple_choice_clock_start",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-hard-logic-explore-4-4",
    "variant": "multiple_choice_ctx_help-string",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-medium-subtraction-lift-1",
    "variant": "multiple_choice_ctx",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-hard-fractions-explore-10-1",
    "variant": "multiple_choice_fractionEx_ctx_help-string",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-easy-fractions-lesson-1-boss-2",
    "variant": "multiple_choice_fractionEx_help-string",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-spatial-lesson-3-1",
    "variant": "multiple_choice_grid_reflect",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-spatial-lesson-9-7",
    "variant": "multiple_choice_grid_rotate",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-spatial-lesson-7-1",
    "variant": "multiple_choice_grid_translate",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-hard-measurement-explore-7-2",
    "variant": "multiple_choice_help-string",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-easy-addition-explore-7-1",
    "variant": "multiple_choice_join",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-hard-money-lesson-7-4",
    "variant": "multiple_choice_money_afford",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-easy-money-lesson-10-7",
    "variant": "multiple_choice_money_change",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-hard-money-lesson-1-7",
    "variant": "multiple_choice_money_discount",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-easy-money-lesson-5-4",
    "variant": "multiple_choice_money_total",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-money-lesson-8-4",
    "variant": "multiple_choice_money_unit",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-hard-percentages-explore-10-1",
    "variant": "multiple_choice_pctEx_ctx_help-string",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-easy-spatial-lesson-3-10",
    "variant": "multiple_choice_shapes_corners",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-spatial-lesson-2-4",
    "variant": "multiple_choice_shapes_sides",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-spatial-lesson-2-4",
    "variant": "multiple_choice_shapes_symmetry",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-hard-fractions-apply-1",
    "variant": "multiple_choice_share",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-hard-capacity-lesson-2-4",
    "variant": "multiple_choice_solid",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-easy-subtraction-explore-9-1",
    "variant": "multiple_choice_take_away",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-subtraction-explore-10-4",
    "variant": "number_line",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-operations-lesson-6-boss-1",
    "variant": "operation_path",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-numbers-explore-10-1",
    "variant": "order_numbers",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-addition-lesson-6-boss-2",
    "variant": "pair_sum",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-patterns-lesson-6-boss-1",
    "variant": "pattern_next",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-addition-tens-4",
    "variant": "place_value_add",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-addition-tens-1",
    "variant": "place_value_build",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-addition-tens-2",
    "variant": "place_value_bundle",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-subtraction-parts-2",
    "variant": "place_value_split",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-subtraction-parts-4",
    "variant": "place_value_subtract",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-multiplication-explore-8-1",
    "variant": "ratio_table",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-patterns-stepping-stones-1",
    "variant": "repair_pattern",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-hard-operations-expedition-5-1",
    "variant": "route_grid",
    "difficulty": "hard",
    "locale": "en"
  },
  {
    "id": "v2-medium-subtraction-lesson-8-challenge-1",
    "variant": "signed_line_move",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-easy-numbers-explore-8-3",
    "variant": "signed_line_place",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-easy-fractions-lesson-7-challenge-1",
    "variant": "sort_buckets",
    "difficulty": "easy",
    "locale": "en"
  },
  {
    "id": "v2-medium-operations-lesson-8-boss-2",
    "variant": "target_build",
    "difficulty": "medium",
    "locale": "en"
  },
  {
    "id": "v2-medium-subtraction-explore-6-3",
    "variant": "true_false",
    "difficulty": "medium",
    "locale": "en"
  }
];

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
  const challenge = item ? getTimedChallengeLevel(item.id) : undefined;
  const level = challenge ?? { ...base.levels[0], puzzleIds: item ? [item.id] : base.levels[0].puzzleIds };
  const lesson = {...base, levels:[level]};
  const measured = useCallback((metrics:PuzzleLayoutMeasurement)=>{
    if(sent.current || !item || metrics.puzzleId!==item.id) return;
    if(timer.current) clearTimeout(timer.current);
    timer.current=setTimeout(()=>{
      sent.current=true;
      setRows(current => [...current, {...metrics,...item}]);
      
    },180);
  },[index,item,params.single,params.example]);
  if (!__DEV__) return <Redirect href="/" />;
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: async () => {} }}><PuzzlePreviewGame>
    <View style={{ flex: 1 }}>{item ? ready && <><PlaySession key={params.example ?? index} session={{ lesson, level, phase: 0 }} onLayoutMeasured={measured} /><Text testID="audit-variant" style={{position:"absolute",left:0,top:0,width:1,height:1,opacity:0.01}}>{item.variant}</Text><Pressable testID="audit-next" accessibilityLabel="Audit next" accessibilityRole="button" onPress={() => setStep(index+1)} style={{position:"absolute",left:"45%",top:56,width:44,height:44}} /></> : <View><Text testID="layout-done">Audit complete</Text>
      <Text testID="layout-summary">{rows.filter(row => row.contentHeight > row.viewportHeight + 1).length} overflowing screens</Text>
      <Text testID="layout-count">{rows.length}</Text>
      <Text testID="layout-report" style={{position:'absolute',width:1,height:1,color:'transparent'}}>{JSON.stringify(rows)}</Text></View>}</View>
  </PuzzlePreviewGame></LocaleContext.Provider></I18nextProvider>;
}
