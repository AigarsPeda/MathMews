import { BalanceModel } from './BalanceModel';
import { NumberTile } from './kit/PuzzleKit';
import { Fragment, type ComponentType, type ReactNode } from 'react';
import { useChoicePlacement } from './tiles/ChoicePlacement';
import type { BalancePuzzle } from '@/types/puzzle';
import { Shape } from '@/constants/puzzle-theme';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

type BalanceTaskProps = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  onSolutionShown?: () => void;
  puzzle: BalancePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number | null) => void;
};

export function BalanceTask({ AnswerRow = Fragment, puzzle, onSolutionShown, selectedIndex, answered, onSelect }: BalanceTaskProps) {
  const { t } = useTranslation();
  const { choices } = puzzle.payload;
  const placement = useChoicePlacement(selectedIndex, onSelect);
  const pan = t('placement.pan');
  return <View style={styles.wrap}>
    <View testID="play-entry-model" nativeID="play-entry-model"><BalanceModel model={puzzle.payload} choice={selectedIndex === null ? null : choices[selectedIndex]}
      checked={answered} onSolutionShown={onSolutionShown}
      pan={!answered ? { label: placement.picked === null && selectedIndex !== null ? t('challenges.returnToBank') : pan, active: placement.picked !== null, enabled: placement.enabled, onPress: placement.activate } : undefined} /></View>
    <AnswerRow><View style={styles.rack}>
      {choices.map((choice, index) => <NumberTile key={index} testID={`balance-choice-${index}`} label={choice} disabled={answered}
        selected={placement.picked === index} onPress={() => placement.pick(index)}
        accessibilityActions={[{ name: 'place', label: pan }]}
        onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'place') placement.place(index); }} />)}
    </View></AnswerRow>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: Shape.space.group },
  rack: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Shape.space.group },
});
