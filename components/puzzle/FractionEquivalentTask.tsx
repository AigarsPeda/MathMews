import { FractionNotation } from '@/components/puzzle/fraction/FractionNotation';
import { EquivalentBar } from './fraction/EquivalentBar';
import { Caption } from './kit/Focus';
import { useProofViewport } from './PlayProofCaption';
import { ResultMark } from '@/components/puzzle/kit/PuzzleKit';
import { PuzzleColors as Colors, Radius, Shape } from '@/constants/puzzle-theme';
import type { FractionEquivalentPuzzle } from '@/types/puzzle';
import { Fragment, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

type Props = {
  puzzle: FractionEquivalentPuzzle;
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  checkedModel?: ReactNode;
  checkedResult?: 'correct' | 'wrong';
  playbackOwnsControls?: boolean;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

export function FractionEquivalentTask({ puzzle, AnswerRow, checkedModel, checkedResult, playbackOwnsControls = false, selectedIndex, isCorrect, answered, incorrectAttempt, onSelect }: Props) {
  const { t } = useTranslation();
  const { numerator, denominator, choices } = puzzle.payload;
  const Row = AnswerRow ?? Fragment;
  const locked = answered || checkedModel != null || checkedResult !== undefined;
  const viewport = useProofViewport();
  const { width, fontScale } = useWindowDimensions();
  const denoms = choices.map(choice => Number(choice.split('/')[1]));
  const knownDenominator = denoms.every(value => value === denoms[0]) ? denoms[0] : undefined;
  const missed = (checkedResult === 'wrong' || (answered || incorrectAttempt) && !isCorrect) && selectedIndex !== null;
  const submitted = missed ? choices[selectedIndex]?.split('/').map(Number) : undefined;
  const parts = submitted?.[1] ?? knownDenominator ?? denominator;
  return <View style={styles.wrap}>
    {checkedModel ?? <View testID={missed ? 'play-proof-model' : 'play-entry-model'} nativeID={missed ? 'play-proof-model' : 'play-entry-model'} style={styles.model}>
      <View style={styles.equation}>
        <FractionNotation numerator={numerator} denominator={denominator} compact={fontScale >= 1.5} />
        {knownDenominator || submitted ? <><Caption strong>{submitted ? '≠' : '='}</Caption><FractionNotation numerator={submitted?.[0] ?? '?'} denominator={parts} compact={fontScale >= 1.5} /></> : null}
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={t('fractionModels.shaded', { count: submitted?.[0] ?? numerator, total: submitted?.[1] ?? denominator })}>
        <EquivalentBar given={puzzle.payload} denominator={parts} submitted={submitted?.[0]} width={Math.min(328, viewport?.innerWidth ?? width - 60)} enter={!missed} />
      </View>
    </View>}
    {!playbackOwnsControls && <Row>
      <View style={styles.choices}>
        {choices.map((choice, index) => {
          const [top, bottom] = choice.split('/');
          const selected = selectedIndex === index;
          const correct = checkedResult ? selected && checkedResult === 'correct' : answered && isCorrect && index === puzzle.correctIndex;
          const wrong = checkedResult ? selected && checkedResult === 'wrong' : Boolean((answered || incorrectAttempt) && !isCorrect && selected);
          return <Pressable key={index} accessibilityRole="button" accessibilityLabel={choice}
            accessibilityState={{ selected, disabled: locked }} disabled={locked} onPress={() => onSelect(index)}
            style={({ pressed }) => [styles.option, selected && styles.selected, correct && styles.correct,
              wrong && styles.wrong, pressed && styles.pressed, locked && !selected && !correct && styles.muted]}>
            <FractionNotation numerator={top} denominator={bottom} />
            {correct || wrong ? <ResultMark kind={correct ? 'correct' : 'wrong'} size={16} /> : null}
          </Pressable>;
        })}
      </View>
    </Row>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  model: { alignItems: 'center', gap: 6 },
  equation: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  option: {
    flexGrow: 1, flexBasis: 76, minHeight: 64, padding: 8, flexDirection: 'row', gap: 4,
    justifyContent: 'center', alignItems: 'center', borderRadius: Radius.control,
    borderBottomWidth: Shape.lip, borderColor: Colors.cardBorder, backgroundColor: Colors.card,
  },
  selected: { borderColor: Colors.primary, backgroundColor: Colors.selectedSurface },
  correct: { borderColor: Colors.success, backgroundColor: Colors.successSurface },
  wrong: { borderColor: Colors.incorrect, backgroundColor: Colors.incorrectSurface },
  pressed: { transform: [{ translateY: 2 }] },
  muted: { opacity: .65 },
});
