import { Fragment, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { PuzzleColors as C, Quantity, Shape } from '@/constants/puzzle-theme';
import type { MultipleChoicePuzzle } from '@/types/puzzle';
import { gridChoiceLetter, type GridModel } from '@/utils/puzzle-grid';
import type { ResponseValue } from '@/utils/puzzle-response';
import { GridDiagram } from '../GridDiagram';
import { ResultMark } from '../kit/PuzzleKit';
import { ChoiceButton } from '../ChoiceButton';
import { GridPoint } from '../GridPoint';

type State = { answered: boolean; isCorrect: boolean; incorrectAttempt: boolean; onSolutionShown?: () => void; mode?: 'attempt' | 'worked' };
type Choices = State & { model: GridModel; choices: string[]; selectedIndex: number | null; correctIndex: number; onSelect: (index: number) => void };
type BoardProps = Choices & { free?: boolean; claim?: boolean };

export function GridAnswerChoices({ model, choices, selectedIndex, correctIndex, answered, incorrectAttempt, isCorrect, onSelect, onSolutionShown, mode, free, claim }: BoardProps) {
  const { t } = useTranslation();
  const action = model.task === 'translate' ? [model.dx && `${model.dx < 0 ? '←' : '→'} ${Math.abs(model.dx)}`, model.dy && `${model.dy < 0 ? '↑' : '↓'} ${Math.abs(model.dy)}`].filter(Boolean).join('   ') : undefined;
  const prompt = t(claim ? 'everyday.gridClaim' : free ? 'everyday.gridTapCell' : 'everyday.gridTapMark');
  const locked = !!mode || answered || !!onSolutionShown;
  const attemptedCell = (mode === 'attempt' || (!mode && answered && incorrectAttempt)) && selectedIndex !== null && selectedIndex >= 0
    ? Number(choices[selectedIndex]) : undefined;
  return <GridDiagram playback={!!mode} attemptedCell={attemptedCell} model={model} onSolutionShown={onSolutionShown} instruction={claim && model.task !== 'translate' ? prompt : action}
    renderCells={({ pad, pitch }) => choices.map((choice, index) => {
      const square = Number(choice), row = Math.floor((square - 1) / model.size), column = (square - 1) % model.size;
      const letter = gridChoiceLetter(choices, square);
      const selected = index === selectedIndex;
      const result = !claim && (answered || incorrectAttempt) && selected ? isCorrect && index === correctIndex ? 'correct' : 'wrong' : null;
      const accessibleName = [claim ? t('everyday.gridSquare', { number: square }) : t('play.answerLabel', { answer: free ? choice : letter }), t('everyday.gridLocation', { row: row + 1, column: column + 1 })].filter(Boolean).join(', ');
      if (free && locked && !selected) return null;
      const inset = Shape.space.seam / 2;
      const face = pitch - 2 * inset;
      const diameter = Math.min(42, face - Shape.lip);
      const disc = { left: (pitch - diameter) / 2, top: (pitch - Shape.lip - diameter) / 2 };
      const marker = !free || selected ? <>
        <GridPoint diameter={diameter} style={{ position: 'absolute', ...disc }} label={free ? undefined : letter}
          hue={attemptedCell === square || result === 'wrong' ? Quantity.amber : result === 'correct' ? { fill: C.successSurface, edge: C.success } : Quantity.violet}>
          {free && (result ? <ResultMark kind={result} size={18} /> : <View style={styles.dot} />)}
        </GridPoint>
        {!free && result === 'correct' && <View style={[styles.result, { right: inset, bottom: inset + Shape.lip }]}>
          <ResultMark kind={result} size={12} />
        </View>}
      </> : null;
      const placement = { top: pad + row * pitch, left: pad + column * pitch, height: pitch, width: pitch };
      if (claim || locked) return <View key={choice} accessible accessibilityLabel={accessibleName} style={[styles.cell, placement]}>{marker}</View>;
      return <Pressable key={choice} testID={'grid-choice-' + choice} accessibilityRole="button" accessibilityLabel={accessibleName}
        accessibilityState={{ selected, disabled: answered }} accessibilityHint={prompt} disabled={answered} onPress={() => onSelect(index)}
        style={[styles.cell, placement]}>{marker}</Pressable>;
    })} />;
}

export function GridResponseChoices({ AnswerRow = Fragment, model, choices, response, value, onChange, ...state }: State & {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  model: GridModel; choices: string[]; response: NonNullable<MultipleChoicePuzzle['response']>;
  value: ResponseValue; onChange: (value: ResponseValue) => void;
}) {
  const { t } = useTranslation();
  if (response.kind === 'judge') return <View style={styles.judge}>
    <GridAnswerChoices {...state} model={model} choices={[response.proposed]} selectedIndex={null} correctIndex={-1} claim onSelect={() => {}} />
    {!state.mode && <AnswerRow>
      <View style={styles.buttons}>{[true, false].map(answer => <ChoiceButton key={String(answer)} label={t(answer ? 'puzzleTypes.trueLabel' : 'puzzleTypes.falseLabel').replace(/\s*[✓✔✗✘]\s*$/u, '')}
        selected={value === answer} disabled={state.answered} onPress={() => onChange(answer)}
        result={(state.answered || state.incorrectAttempt) && value === answer ? state.isCorrect ? 'correct' : 'wrong' : null} style={styles.option} />)}</View>
    </AnswerRow>}
  </View>;
  if (response.kind === 'write') {
    const cells = Array.from({ length: model.size ** 2 }, (_, i) => String(i + 1));
    return <GridAnswerChoices {...state} free model={model} choices={cells} selectedIndex={typeof value === 'string' ? cells.indexOf(value) : null}
      correctIndex={cells.indexOf(response.answer)} onSelect={index => onChange(cells[index])} />;
  }
  return <GridAnswerChoices {...state} model={model} choices={response.options ?? choices} correctIndex={response.correctIndex}
    selectedIndex={value === null ? null : Number(value)} onSelect={index => onChange(String(index))} />;
}

const styles = StyleSheet.create({
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  result: { position: 'absolute', backgroundColor: C.card, borderRadius: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Quantity.berry.edge },
  judge: { gap: 8 }, buttons: { flexDirection: 'row', gap: 8 }, option: { flex: 1, minHeight: 52 },
});
