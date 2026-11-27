import type { CheckedAttempt } from '@/utils/checked-attempt';
import { fractionRevealPlan } from '@/utils/fraction-reveal';
import { numberLineRoute } from '@/utils/number-line-reveal';
import { percentageRevealPlan } from '@/utils/percentage-reveal';
import { fractionChoiceMechanic } from '@/utils/puzzle-type';
import { responseContent } from '@/utils/puzzle-response';
import { decimalPlaceGroups, integerPlaceGroups } from '@/utils/place-value-words';
import { submittedLabel } from '@/utils/submitted-response';
import { OperationsReveal, hasOperationsReveal } from './OperationsReveal';
import { BudgetPlanReveal } from './BudgetPlanTask';
import { CompareReveal } from './CompareTask';
import { DecimalReveal } from './DecimalReveal';
import { EverydayDiagram } from './EverydayDiagram';
import { FairShareReveal } from './FairShareTask';
import { FractionNumberLineReveal } from './fraction/FractionNumberLineReveal';
import { FractionReveal } from './FractionReveal';
import { GeometryMeasureTask } from './GeometryMeasureTask';
import { NumberLineReveal } from './NumberLineReveal';
import { PercentageReveal } from './PercentageReveal';
import { PlaceValueBuildReveal, placeValueFixtureAnswer } from './PlaceValueTask';
import { hasStoryReveal, PuzzleCard } from './PuzzleCard';
import { PuzzleResponseModel } from './PuzzleResponseTask';
import { QuantityTaskScene } from './QuantityTaskScene';
import { BridgeTask } from './BridgeTask';
import { RatioReveal } from './RatioReveal';
import { SortBucketsReveal } from './SortBucketsTask';
import { GridAnswerChoices, GridResponseChoices } from './everyday/GridAnswerChoices';
import { isLimitStory, StoryGivens } from './glyphs/StoryGivens';
import { Caption, ProofCaption } from './kit/Focus';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';
import { useTranslation } from 'react-i18next';

const noop = () => {};
type Props = { snapshot: CheckedAttempt; mode: 'attempt' | 'worked'; onSolutionShown: () => void };

export function GridAttemptCaption({ snapshot }: { snapshot: CheckedAttempt }) {
  const { t, i18n } = useTranslation();
  const answer = submittedLabel(snapshot, t, i18n?.language?.split('-')[0]);
  return <Caption strong>{snapshot.responseMode === 'judge' ? answer : t('play.answerLabel', { answer })}</Caption>;
}

function AnswerCaption({ snapshot, mode, onSolutionShown }: Props) {
  const { t, i18n } = useTranslation();
  const beats = useRevealBeats(1, { step: 180, lead: 100, hold: 120, minTotal: 0, reducedSteps: true, onDone: onSolutionShown });
  const label = submittedLabel(snapshot, t, i18n?.language?.split('-')[0]);
  const checked = mode === 'worked' ? snapshot.puzzle.explanation : t('play.answerLabel', { answer: label });
  return <RevealSurface beats={beats}><ProofCaption text={beats.landed ? checked : label} reserveTexts={[label, checked]} /></RevealSurface>;
}

function CheckedLimit({ snapshot, onSolutionShown }: Props) {
  const beats = useRevealBeats(2, { step: 240, hold: 120, minTotal: 0, reducedSteps: true, onDone: onSolutionShown });
  return <RevealSurface beats={beats}><StoryGivens puzzle={snapshot.puzzle} checkedIndex={snapshot.answer.kind === 'choice' ? snapshot.answer.index : null} revealing landed={beats.landed} /></RevealSurface>;
}

function Evidence(props: Props & { modelOnly?: boolean }) {
  const { snapshot, mode, onSolutionShown } = props;
  const { puzzle, answer, arrangement } = snapshot;
  const index = answer.kind === 'choice' ? answer.index : null;
  const choice = answer.kind === 'response' ? responseContent(puzzle.response, answer.value)
    : index !== null && 'choices' in puzzle ? puzzle.choices[index] : undefined;
  const value = answer.kind === 'value' ? answer.value : answer.kind === 'bridge' ? answer.state.value
    : choice ? Number(choice.replace('−', '-').replace(',', '.')) : undefined;
  const submittedNumber = mode === 'attempt' && typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if ((puzzle.type === 'multiple_choice' || !puzzle.type) && puzzle.everyday?.model.kind === 'grid') {
    const state = { mode, answered: true, isCorrect: snapshot.correct, incorrectAttempt: !snapshot.correct, onSolutionShown };
    const model = puzzle.everyday.model;
    return <>
      {puzzle.response?.kind === 'judge'
        ? <GridAnswerChoices {...state} model={model} choices={[puzzle.response.proposed]} selectedIndex={mode === 'attempt' ? 0 : null} correctIndex={-1} claim onSelect={noop} />
        : puzzle.response && answer.kind === 'response'
        ? <GridResponseChoices {...state} model={model} choices={puzzle.choices} response={puzzle.response} value={answer.value} onChange={noop} />
        : <GridAnswerChoices {...state} model={model} choices={puzzle.choices} selectedIndex={index} correctIndex={puzzle.correctIndex} onSelect={noop} />}
      {!props.modelOnly && mode === 'attempt' && <GridAttemptCaption snapshot={snapshot} />}
    </>;
  }
  if (hasOperationsReveal(puzzle) && (mode === 'worked' || answer.kind !== 'response')) return <OperationsReveal
    puzzle={puzzle} answer={answer} isCorrect={snapshot.correct} mode={mode} onSolutionShown={onSolutionShown} />;
  if (puzzle.type === 'budget_plan' && answer.kind === 'budget') return <BudgetPlanReveal puzzle={puzzle} answer={answer} onSolutionShown={onSolutionShown} />;
  if (puzzle.type === 'sort_buckets' && answer.kind === 'sort') return <SortBucketsReveal puzzle={puzzle} answer={answer} onSolutionShown={onSolutionShown} />;
  if (puzzle.type === 'place_value') {
    const groups = choice && integerPlaceGroups(choice);
    const submitted = groups ? { kind: 'place_value' as const, state: groups }
      : answer.kind === 'place_value' ? answer : mode === 'worked' ? placeValueFixtureAnswer(puzzle) : null;
    if (submitted) return <PlaceValueBuildReveal mode={mode} puzzle={puzzle} answer={submitted} onSolutionShown={onSolutionShown} />;
  }
  if (puzzle.type === 'decimal_grid' || puzzle.type === 'decimal_place_value') {
    const submitted = answer.kind === 'decimal_place' ? answer.state
      : choice && puzzle.type === 'decimal_place_value' ? decimalPlaceGroups(choice) ?? undefined : undefined;
    if (answer.kind === 'decimal_grid' || submitted || mode === 'worked') return <DecimalReveal puzzle={puzzle} mode={mode} selected={answer.kind === 'decimal_grid' ? arrangement.decimalCells : undefined} submitted={submitted} onSolutionShown={onSolutionShown} />;
  }
  if (answer.kind === 'fraction' || answer.kind === 'fraction_strip' || answer.kind === 'fraction_match'
    || puzzle.type === 'fraction_equivalent' || fractionChoiceMechanic(puzzle) === 'whole-choice') {
    const masks = answer.kind === 'fraction_match' && 'selectedByPair' in answer ? answer.selectedByPair : undefined;
    const choiceIndex = mode === 'attempt' ? index ?? undefined : undefined;
    const plan = fractionRevealPlan(puzzle, snapshot.draft.fractionStrip, arrangement.selectedSlices, mode, arrangement.matchedIds, masks, choiceIndex);
    if (plan) return <FractionReveal plan={plan} onSolutionShown={onSolutionShown} />;
  }
  if (puzzle.type === 'compare') return <CompareReveal puzzle={puzzle} mode={mode} selectedIndex={index} onSolutionShown={onSolutionShown} />;
  if (puzzle.type === 'fair_share' && (mode === 'worked' || answer.kind === 'distribution' || index !== null)) return <FairShareReveal puzzle={puzzle} mode={mode} selectedIndex={index} distribution={arrangement.distribution} onSolutionShown={onSolutionShown} />;
  if (mode === 'attempt' && (puzzle.type === 'multiple_choice' || !puzzle.type) && (puzzle.everyday?.model.kind === 'money' || puzzle.everyday?.model.kind === 'capacity' || puzzle.everyday?.model.kind === 'solid' || (puzzle.everyday?.model.kind === 'shapes' && puzzle.everyday.model.task === 'symmetry'))) {
    if (answer.kind === 'response') return <PuzzleResponseModel puzzle={puzzle} value={answer.value} checked onSolutionShown={onSolutionShown} />;
    if (puzzle.everyday.model.kind === 'solid' || puzzle.everyday.model.kind === 'shapes') {
      return <EverydayDiagram model={puzzle.everyday.model} submitted={choice} onSolutionShown={onSolutionShown} />;
    }
    const attempt = { choice };
    return <EverydayDiagram model={puzzle.everyday.model} {...(puzzle.everyday.model.kind === 'money' ? { moneyAttempt: attempt } : { capacityAttempt: attempt })} onSolutionShown={onSolutionShown} />;
  }
  if (mode === 'attempt' && index !== null && isLimitStory(puzzle)) return <CheckedLimit {...props} />;
  const submittedTick = answer.kind === 'fraction_point' ? answer.tick : undefined;
  if (puzzle.type === 'fraction_number_line' && (mode === 'worked' || submittedTick !== undefined)) {
    return <FractionNumberLineReveal puzzle={puzzle} submitted={mode === 'attempt' ? submittedTick : undefined} onSolutionShown={onSolutionShown} />;
  }
  const route = mode === 'worked' || submittedNumber !== undefined ? numberLineRoute(puzzle) : null;
  if (route) return <NumberLineReveal route={route} submitted={submittedNumber} onSolutionShown={onSolutionShown} />;
  if (puzzle.type === 'ratio_table') return <RatioReveal puzzle={puzzle} submitted={submittedNumber} onSolutionShown={onSolutionShown} />;
  if (puzzle.type === 'coordinate_map') return puzzle.response
    ? <PuzzleResponseModel puzzle={puzzle} value={answer.kind === 'response' ? answer.value : null} checked solved={mode === 'worked'} onSolutionShown={onSolutionShown} />
    : <BridgeTask onSolutionShown={onSolutionShown} puzzle={puzzle} value={snapshot.draft.bridge ?? null} submitted={mode === 'attempt' ? snapshot.draft.bridge?.value ?? snapshot.draft.bridge?.point ?? undefined : undefined} solved answered readOnly onChange={noop} />;
  const percentage = percentageRevealPlan(puzzle, snapshot.draft.challenge);
  if (percentage) return <PercentageReveal plan={percentage} submitted={submittedNumber} onSolutionShown={onSolutionShown} />;
  if (mode === 'attempt') return <AnswerCaption {...props} />;
  if (puzzle.type === 'geometry_measure') return <GeometryMeasureTask puzzle={puzzle} value={snapshot.draft.geometry ?? null} onChange={noop} answered readOnly onSolutionShown={onSolutionShown} />;
  if (puzzle.type === 'multiple_choice' || !puzzle.type) {
    const model = puzzle.everyday?.model;
    if (model) return <EverydayDiagram model={model} onSolutionShown={onSolutionShown} />;
    if (puzzle.taskVisual) return <QuantityTaskScene model={puzzle.taskVisual} selectedGroups={puzzle.fractionExample?.numerator} disabled solved showExpression={puzzle.difficulty !== 'hard'} onSolutionShown={onSolutionShown} />;
  }
  const fraction = fractionRevealPlan(puzzle);
  if (fraction) return <FractionReveal plan={fraction} onSolutionShown={onSolutionShown} />;
  return <AnswerCaption {...props} />;
}

/** Only this component receives checked work. Editors keep their own interaction state. */
export function CheckedPuzzleReveal(props: Props & { modelOnly?: boolean }) {
  const { t, i18n } = useTranslation();
  const { snapshot, mode, onSolutionShown } = props;
  const puzzle = snapshot.prompt === snapshot.puzzle.question ? snapshot.puzzle : { ...snapshot.puzzle, question: snapshot.prompt };
  const story = mode === 'worked' && hasStoryReveal(puzzle);
  const gridAttempt = mode === 'attempt' && 'everyday' in puzzle && puzzle.everyday?.model.kind === 'grid';
  return <>
    {!props.modelOnly && <PuzzleCard checked puzzle={puzzle} solved={story} showObjects={story} checkedIndex={snapshot.answer.kind === 'choice' ? snapshot.answer.index : null} onSolutionShown={story ? onSolutionShown : undefined} />}
    {!story && <Evidence {...props} />}
    {!props.modelOnly && !gridAttempt && snapshot.responseMode === 'judge' && <Caption>{submittedLabel(snapshot, t, i18n?.language?.split('-')[0])}</Caption>}
  </>;
}
