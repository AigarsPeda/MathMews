import { MachineLane } from './MachineLane';
import { PuzzleText } from './PuzzleText';
import { EntryBuild } from './kit/PracticeAffordances';
import { NumberTile, UnknownWell } from './kit/PuzzleKit';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';
import { useChoiceLayout } from './useChoiceLayout';
import { useChoicePlacement } from './tiles/ChoicePlacement';
import { Ink } from '@/constants/puzzle-theme';
import type { FunctionMachinePuzzle } from '@/types/puzzle';
import { machinePlan } from '@/utils/operations-reveal';
import { Fragment, useMemo, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

type FunctionMachineTaskProps = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  puzzle: FunctionMachinePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number | null) => void;
};

/** Apply a rule such as "×4" or "+4−3" left to right; null if it does not parse. */
export function applyRule(input: number, rule: string): number | null {
  const steps = [...rule.replace(/\s/g, '').matchAll(/([+\-−×÷])(\d+)/g)];
  if (!steps.length || steps.map(m => m[0]).join('') !== rule.replace(/\s/g, '')) return null;
  return steps.reduce((value, [, op, n]) => {
    const k = Number(n);
    return op === '+' ? value + k : op === '×' ? value * k : op === '÷' ? value / k : value - k;
  }, input);
}

const RULE_ACTIONS: Record<string, string> = { '+': 'add', '-': 'subtract', '−': 'subtract', '×': 'multiply', '÷': 'divide' };

/** "×4" read as "Multiply by 4", "+4−3" as "Add 4, then subtract 3": a choice names its action in words. */
export function ruleWords(rule: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const steps = [...rule.replace(/\s/g, '').matchAll(/([+\-−×÷])(\d+)/g)];
  if (!steps.length || steps.map(m => m[0]).join('') !== rule.replace(/\s/g, '')) return rule;
  return steps.map(([, op, n]) => t(`bridge.action_${RULE_ACTIONS[op]}`, { amount: n }))
    .reduce((first, next) => t('puzzleTypes.ruleThen', { first, next: next.charAt(0).toLocaleLowerCase() + next.slice(1) }));
}

export function FunctionMachineTask({ AnswerRow = Fragment, puzzle, selectedIndex, answered, onSelect }: FunctionMachineTaskProps) {
  const { t } = useTranslation();
  const { input, output, choices } = puzzle.payload;
  const layout = useChoiceLayout(choices);
  const placement = useChoicePlacement(selectedIndex, onSelect);
  const socket = t('placement.socket');
  const rule = selectedIndex === null ? null : choices[selectedIndex];
  const plan = useMemo(() => answered && selectedIndex !== null ? machinePlan(puzzle, selectedIndex) : null, [answered, puzzle, selectedIndex]);
  const beats = useRevealBeats(plan?.steps.length ?? 0);
  const lane = <MachineLane input={input} output={output} proof={plan ? { plan, beats } : undefined}
    socket={<Pressable testID="machine-rule-socket" accessibilityRole="button" accessibilityLabel={placement.picked === null && rule !== null ? t('challenges.returnToBank') : socket}
      accessibilityValue={{ text: rule ?? '?' }} disabled={answered || !placement.enabled} onPress={placement.activate}>
      <UnknownWell label={rule ?? '?'} filled={rule !== null} active={placement.picked !== null} />
    </Pressable>} />;
  return <View style={{ gap: 10 }}>
    <RevealSurface beats={beats} replayable={!!plan}>
      <View testID="play-entry-model" nativeID="play-entry-model">{plan ? lane : <EntryBuild>{lane}</EntryBuild>}</View>
    </RevealSurface>
    {plan && beats.settled && <PuzzleText style={{ textAlign: 'center', fontWeight: '800', color: Ink.text }}>{plan.final}</PuzzleText>}
    {!answered && <AnswerRow><View onLayout={layout.onLayout} style={layout.container}>
      {choices.map((choice, index) => <NumberTile key={index} testID={`machine-rule-${choice}`} label={choice} accessibilityLabel={ruleWords(choice, t)}
        style={layout.item} selected={placement.picked === index} accessibilityActions={[{ name: 'place', label: socket }]}
        onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'place') placement.place(index); }} onPress={() => placement.pick(index)} />)}
    </View></AnswerRow>}
  </View>;
}
