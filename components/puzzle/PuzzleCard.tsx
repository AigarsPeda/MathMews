import { ModelStage, type ModelStageLayout } from './kit/ModelStage';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { isDifferenceTape, PuzzleContextObjects } from '@/components/puzzle/PuzzleContextObjects';
import { fractionChoiceMechanic, hasClockStoryPrompt } from '@/utils/puzzle-type';
import { StoryHost } from './kit/PracticeAffordances';
import { ProofEquationSlot } from './everyday/ProofEquationSlot';
import { FractionGivenModel } from './fraction/FractionGivenModel';
import { PercentageGivenModel } from './percentage/PercentageGivenModel';
import { getStoryRate, isLimitStory, SequenceGivens, splitNumberSequence, StoryGivens } from './glyphs/StoryGivens';
import { LandingFrame } from './counting/CountingLane';
import { RevealSurface } from './kit/RevealSurface';
import { canSnapshotModel } from './counting/useModelPaint';
import { useRevealBeats, type RevealBeats } from './kit/useRevealBeats';
import { useRef, type ReactNode } from 'react';
import { ProofMotion, PuzzleColors } from "@/constants/puzzle-theme";
import { QuantityTaskScene } from './QuantityTaskScene';
import type { CountingTask } from '@/utils/quantity-task-scene';
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";

const cardPadding = moderateScale(6);

function storyJoin(puzzle: Puzzle): CountingTask | null {
  if (puzzle.type !== 'multiple_choice' || puzzle.topic !== 'addition' || puzzle.taskVisual || puzzle.everyday ||
      puzzle.fractionExample || puzzle.percentageExample || puzzle.contextObjects?.length !== 2) return null;
  const [start, add] = puzzle.contextObjects;
  if (start.role !== 'start' || add.role !== 'add' || start.object !== add.object ||
      start.count === undefined || add.count === undefined) return null;
  // A missing-addend question can use the same object roles as a question asking for the sum.
  if (Number(puzzle.choices[puzzle.correctIndex]) !== start.count + add.count) return null;
  return { kind: 'join', object: start.object, left: start.count, right: add.count };
}

function missingAddend(puzzle: Puzzle) {
  if (puzzle.type !== 'multiple_choice' || puzzle.taskVisual || puzzle.contextObjects?.length !== 2) return null;
  const [start, add] = puzzle.contextObjects;
  if (start.role !== 'start' || add.role !== 'add' || start.object !== add.object || start.count === undefined ||
    add.count === undefined || Number(puzzle.choices[puzzle.correctIndex]) !== add.count) return null;
  return { start, known: start.count, unknown: add.count, target: start.count + add.count };
}

export function hasStoryAnswerWell(puzzle: Puzzle): boolean {
  if (puzzle.response?.kind !== 'write' || puzzle.type !== 'multiple_choice' || puzzle.taskVisual || puzzle.everyday || puzzle.fractionExample || puzzle.percentageExample) return false;
  return !!(missingAddend(puzzle) || storyJoin(puzzle) || getStoryRate(puzzle) || isDifferenceTape(puzzle.contextObjects ?? []) ||
    (puzzle.topic === 'patterns' && splitNumberSequence(puzzle.question)));
}

export function hasStoryReveal(puzzle: Puzzle) {
  if (puzzle.type !== 'multiple_choice' || puzzle.taskVisual || puzzle.everyday || puzzle.fractionExample || puzzle.percentageExample) return false;
  return !!(storyJoin(puzzle) || missingAddend(puzzle) || (puzzle.topic === 'patterns' && splitNumberSequence(puzzle.question)) || isDifferenceTape(puzzle.contextObjects ?? []) || getStoryRate(puzzle) || isLimitStory(puzzle));
}

function StorySolution({ children, active, difference, steps, onDone }: { active: boolean; difference: boolean; steps: number; children: (landed: number, settled: boolean, beats?: RevealBeats) => ReactNode; onDone?: () => void }) {
  const clock = useRevealBeats(active ? steps : 0, { awaitInitialPaint: active && !difference && canSnapshotModel, onDone: active ? onDone : undefined, reducedSteps: true, lead: 40, minTotal: 0, step: difference ? ProofMotion.beat[300] : ProofMotion.group, hold: n => n === steps ? ProofMotion.settle : 0 });
  return <RevealSurface beats={clock} replayable={active}><LandingFrame step={clock.landed} reduced={clock.reduced}>{children(active ? clock.landed : 0, active && clock.settled, active ? clock : undefined)}</LandingFrame></RevealSurface>;
}

function StoryQuestion({ text, onPromptLayout, readAgain }: {
  text: string;
  onPromptLayout?: (bottom: number) => void;
  readAgain?: { label: string; hint: string; onPress: () => void };
}) {
  const layout = useRef<{ wrapperY?: number; textBottom?: number }>({});
  function reportLayout() {
    const { wrapperY, textBottom } = layout.current;
    if (wrapperY !== undefined && textBottom !== undefined) onPromptLayout?.(wrapperY + textBottom);
  }
  function onWrapperLayout(event: LayoutChangeEvent) {
    layout.current.wrapperY = event.nativeEvent.layout.y;
    reportLayout();
  }
  function onTextLayout(bottom: number) {
    layout.current.textBottom = bottom;
    reportLayout();
  }
  const host = <StoryHost text={text} onPromptLayout={onPromptLayout && onTextLayout} />;
  const wrapperProps = { testID: 'puzzle-question', onLayout: onPromptLayout && onWrapperLayout };
  return readAgain ? <Pressable {...wrapperProps} accessibilityRole="button" accessibilityLabel={readAgain.label}
    accessibilityHint={readAgain.hint} onPress={readAgain.onPress}>{host}</Pressable> : <View {...wrapperProps}>{host}</View>;
}

export function PuzzleCard({ puzzle, stageLayout, showIdleCue = false, checked = false, checkedIndex, showObjects = true, solved = false, onSolutionShown, onPromptLayout, hideQuestion = false, writtenAnswer, submittedStoryValue }: { stageLayout?: ModelStageLayout; showIdleCue?: boolean; checked?: boolean; writtenAnswer?: ReactNode; submittedStoryValue?: string; puzzle: Puzzle; onPromptLayout?: (bottom: number) => void; hideQuestion?: boolean; checkedIndex?: number | null; showObjects?: boolean; solved?: boolean; onSolutionShown?: () => void }) {
  const { t } = useTranslation();
  // Budget prompts otherwise repeat a generic request and put the actual givens below it.
  const array = puzzle.type === 'multiple_choice' && puzzle.taskVisual?.kind === 'array' ? puzzle.taskVisual : undefined;
  const mouseArray = array?.object === 'mouse' && !puzzle.response?.prompt;
  const question = mouseArray ? t('objectScenes.countMice', { rows: array.rows, columns: array.columns }) : puzzle.type === 'budget_plan'
    ? t('challenges.budgetGoal', { budget: puzzle.payload.budget, count: puzzle.payload.pickCount, remaining: puzzle.payload.remaining })
    : puzzle.type === 'fair_share' && puzzle.payload.object === 'cookie' && !puzzle.response
      ? t('cookieShare.goal', { cookies: t('cookieShare.cookies', { count: puzzle.payload.items }), plates: puzzle.payload.people })
      : puzzle.question;
  const plainStory = showObjects && puzzle.type === 'multiple_choice' && !puzzle.taskVisual && !puzzle.everyday;
  const compactExample = plainStory && (puzzle.fractionExample || puzzle.percentageExample);
  const sequence = plainStory && puzzle.topic === 'patterns' ? splitNumberSequence(question) : null;
  const gap = plainStory ? missingAddend(puzzle) : null;
  const join = plainStory ? storyJoin(puzzle) : null;
  const rate = plainStory && getStoryRate(puzzle);
  const difference = isDifferenceTape(puzzle.contextObjects ?? []);
  const clockStory = !checked && hasClockStoryPrompt(puzzle);
  const moneyStory = puzzle.type === 'budget_plan' || ('everyday' in puzzle && puzzle.everyday?.model.kind === 'money');
  const storyPrompt = moneyStory || !!fractionChoiceMechanic(puzzle) || puzzle.type === 'fair_share' || !!puzzle.taskVisual || puzzle.type === 'compare' || hasStoryReveal(puzzle);
  const limitAttempt = checked && !solved && checkedIndex != null && isLimitStory(puzzle);
  const attemptValue = !solved && checked ? submittedStoryValue ?? (checkedIndex != null && puzzle.type === 'multiple_choice' ? puzzle.choices[checkedIndex] : undefined) : undefined;
  const storySteps = rate ? 1 + Math.min(4, Math.abs(rate.wanted - rate.given)) : 2;
  const renderGivens = (landed: number, settled: boolean, beats?: RevealBeats) => <>
      {sequence && <SequenceGivens idle={showIdleCue} attemptValue={attemptValue} writtenAnswer={!solved ? writtenAnswer : undefined} beats={beats} terms={sequence.terms} revealing={solved} landed={landed} settled={settled} solution={puzzle.type === 'multiple_choice' ? puzzle.choices[puzzle.correctIndex] : undefined} />}
      {plainStory && !sequence && !compactExample && <StoryGivens idle={showIdleCue} writtenAnswer={writtenAnswer} attemptValue={attemptValue} beats={beats} puzzle={puzzle} checkedIndex={checkedIndex} solved={settled} revealing={solved || limitAttempt} landed={landed} />}
      {compactExample && <View style={styles.example}>
        {puzzle.fractionExample ? <FractionGivenModel attempt={checked && !solved && checkedIndex != null}
          miss={attemptValue !== undefined && puzzle.type === 'multiple_choice' ? `${attemptValue} ≠ ${puzzle.choices[puzzle.correctIndex]}` : undefined} example={puzzle.fractionExample} contextObjects={puzzle.contextObjects} /> :
          puzzle.percentageExample && <PercentageGivenModel example={puzzle.percentageExample} />}
      </View>}
      {gap && <View style={styles.example}><PuzzleContextObjects beats={beats} objects={[gap.start]} />
        {solved ? <ProofEquationSlot settled={settled}><Text style={styles.question}>{landed > 0
          ? `${gap.target} − ${gap.known} = ${settled ? gap.unknown : '?'}`
          : `${gap.known} + ? = ${gap.target}`}</Text></ProofEquationSlot>
          : writtenAnswer ? <View style={styles.equation}><Text style={styles.question}>{gap.known} +</Text>{writtenAnswer}<Text style={styles.question}>= {gap.target}</Text></View> : null}
      </View>}
      {showObjects && !gap && !rate && !compactExample && !puzzle.fractionExample && !puzzle.percentageExample && puzzle.contextObjects?.length ? <PuzzleContextObjects idle={showIdleCue} attemptValue={attemptValue} writtenAnswer={!solved ? writtenAnswer : undefined} objects={puzzle.contextObjects} solved={settled} revealing={solved} landed={landed} /> : null}
    </>;
  return (
    <View style={styles.card}>
      {!hideQuestion && (clockStory && 'everyday' in puzzle && puzzle.everyday?.model.kind === 'clock' ?
        <StoryQuestion key={`question:${puzzle.id}`} onPromptLayout={onPromptLayout}
          text={puzzle.everyday.model.duration == null ? question : t(puzzle.everyday.model.task === 'start' ? 'clockSolution.shortStart' : 'clockSolution.shortFinish', { minutes: puzzle.everyday.model.duration })}
          readAgain={{ label: question, hint: t('everyday.readQuestionAgain'),
            onPress: () => Alert.alert(t('play.questionLabel'), question, [{ text: t('common.close') }]) }} />
        : storyPrompt ? <StoryQuestion key={`question:${puzzle.id}`} text={sequence?.question ?? question} onPromptLayout={onPromptLayout} /> : <Text testID="puzzle-question" style={styles.question} accessibilityRole="header"
        onLayout={onPromptLayout ? ({nativeEvent: {layout}}) => onPromptLayout(layout.y + layout.height) : undefined}>{sequence?.question ?? question}</Text>)}
      <ModelStage layout={stageLayout && { ...stageLayout, intrinsicWidth: sequence ? sequence.terms.length * 64 : undefined }}>
      <View collapsable={!stageLayout} testID={stageLayout ? 'play-proof-area' : undefined}>
      {join ? <>
        {!solved && writtenAnswer && <View style={styles.equation}><Text style={styles.question}>{join.left} + {join.right} =</Text>{writtenAnswer}</View>}
        <QuantityTaskScene key={puzzle.id} model={join} disabled={checked || solved || puzzle.response?.kind !== 'write'}
        showExpression={puzzle.difficulty !== 'hard' && (solved || !writtenAnswer)} solved={solved} onSolutionShown={solved ? onSolutionShown : undefined} /></>
        : showObjects && hasStoryReveal(puzzle) ? <StorySolution active={solved || limitAttempt} key={`model:${puzzle.id}`} difference={difference} steps={storySteps} onDone={onSolutionShown}>{renderGivens}</StorySolution> : renderGivens(0, solved)}
      </View></ModelStage>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: cardPadding },
  equation: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 },
  example: { alignItems: "center", paddingTop: 12 },
  question: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: PuzzleColors.text,
    lineHeight: moderateScale(32),
  },
});
