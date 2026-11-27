import { FractionLineStage } from './number-line/FractionLineRail';
import { NumberLineTrack } from '@/components/puzzle/NumberLineTrack';
import { IdleHint } from './kit/PracticeAffordances';
import { useFirstQuantityEncounter } from './counting/QuantityPractice';
import { landTick } from './kit/proofHaptics';
import { LineStepButton } from '@/components/puzzle/number-line/LineStepButton';
import type { FractionNumberLinePuzzle } from '@/types/puzzle';
import { Fragment, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

type Props = { puzzle: FractionNumberLinePuzzle; value: number | null; onChange: (tick: number) => void; answered: boolean;
  AnswerRow?: ComponentType<{ children: ReactNode }> };

export function FractionNumberLineTask({ puzzle, value, onChange, answered, AnswerRow = Fragment }: Props) {
  const { t } = useTranslation();
  const { divisions } = puzzle.payload;
  const current = value ?? 0;
  const firstEncounter = useFirstQuantityEncounter('fraction-line-marker', !answered);
  const [touched, setTouched] = useState(false);
  const select = (tick: number) => {
    setTouched(true);
    landTick();
    onChange(tick);
  };
  return <View style={styles.wrap}>
    <FractionLineStage><NumberLineTrack min={0} max={divisions} start={0} value={current} tone="violet"
      testID="fraction-line-track" fit showStart={false} fractionDivisions={divisions} disabled={answered} onSelect={select}
      onTouchModel={() => setTouched(true)} renderMarkerHint={({ x, y, nextX }) => <IdleHint movable={!answered}
        firstEncounter={firstEncounter} interacted={touched || value !== null}
        from={{ x, y }} to={{ x: (x + nextX) / 2, y }} />} /></FractionLineStage>
    <AnswerRow><View style={styles.controls}>
      {([-1, 1] as const).map(direction => (
        <LineStepButton key={direction} direction={direction}
          testID={direction < 0 ? 'fraction-line-left' : 'fraction-line-right'}
          label={t(direction < 0 ? 'puzzleTypes.numberLineLeftButton' : 'puzzleTypes.numberLineRightButton')}
          accessibilityLabel={t(direction < 0 ? 'puzzleTypes.numberLineMoveLeft' : 'puzzleTypes.numberLineMoveRight')}
          disabled={answered || current + direction < 0 || current + direction > divisions}
          onPress={() => select(current + direction)} />
      ))}
    </View></AnswerRow>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  controls: { flexDirection: 'row', gap: 10 },
});
