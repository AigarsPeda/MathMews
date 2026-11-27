import { BottleRow } from './bridge/Bottle';
import { PuzzleText } from './PuzzleText';
import { EntryBuild } from './kit/PracticeAffordances';
import { UnknownWell } from './kit/PuzzleKit';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import type { RatioTablePuzzle } from '@/types/puzzle';
import { ratioGroups } from '@/utils/bridge-models';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

/** Keep the same bottle groups in their places while the known amount grows or shrinks. */
export function RatioBottles({ puzzle, filled, answer, settled = false, submitted }: {
  puzzle: RatioTablePuzzle; filled: number; answer: ReactNode; settled?: boolean; submitted?: number;
}) {
  const { t } = useTranslation();
  const { start, end, bottles, litres } = ratioGroups(puzzle.payload);
  return <View style={styles.model}>
    <View style={styles.groups} accessibilityLabel={t('bridge.bottleCount', { count: puzzle.payload.targetA })}>
      {Array.from({ length: Math.max(start, end) }, (_, i) =>
        <View key={i} style={[styles.group, i < filled ? styles.full : styles.waiting, end < start && i < end && styles.kept]}>
          <BottleRow count={bottles} submittedFraction={i < end && submitted !== undefined ? Math.max(0, submitted) / (end * litres) : undefined} />
          {/* Every group reserves the tag lane, so all groups are the same height and the bottles share one baseline. */}
          {start === 1 && <View accessibilityElementsHidden={i !== 0} importantForAccessibility={i === 0 ? 'auto' : 'no-hide-descendants'}
            style={[styles.given, styles.firstBottleTag, i !== 0 && styles.hidden]}><PuzzleText style={styles.amount}>{t('jugSolution.litres', { value: puzzle.payload.b })}</PuzzleText></View>}
        </View>)}
    </View>
    {settled && submitted === undefined ? <View style={{ minHeight: 48 }} /> : <View style={styles.values}>
      {start > 1 && <View style={styles.given}><PuzzleText style={styles.amount}>{t('jugSolution.litres', { value: puzzle.payload.b })}</PuzzleText></View>}
      <View style={styles.result}>{answer}</View>
    </View>}
  </View>;
}

export function RatioTableModel({ puzzle, answer, answered = false, checkedModel, answerWell, playbackOwnsControls = false }: {
  puzzle: RatioTablePuzzle; answer: number | null; answered?: boolean; worked?: boolean; checkedModel?: ReactNode; answerWell?: ReactNode; playbackOwnsControls?: boolean;
}) {
  const { t } = useTranslation();
  if (checkedModel != null) return <>{checkedModel}</>;
  const { start } = ratioGroups(puzzle.payload);
  const well = playbackOwnsControls ? <PuzzleText style={styles.amount}>?</PuzzleText> : answerWell ?? <View testID="bridge-value" accessible accessibilityLabel={t('bridge.litresAnswer', { amount: answer ?? '?' })}>
    <UnknownWell label={String(answer ?? '?')} filled={answer != null} active={!answered && !playbackOwnsControls} />
  </View>;
  return <View testID="bridge-ratio-model" nativeID="bridge-ratio-model">
    <EntryBuild><RatioBottles puzzle={puzzle} filled={start} answer={well} /></EntryBuild>
  </View>;
}

const styles = StyleSheet.create({
  model: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  groups: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 4 },
  group: { padding: 4, borderRadius: 10 },
  full: { backgroundColor: Quantity.teal.soft },
  waiting: { backgroundColor: '#F2F4F8', opacity: .5 },
  kept: { backgroundColor: Quantity.violet.soft },
  hidden: { opacity: 0 },
  values: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' },
  given: { backgroundColor: Quantity.amber.fill, borderRadius: 9, alignSelf: 'center', minWidth: 44, minHeight: 32, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  firstBottleTag: { alignSelf: 'flex-start', width: 48 },
  amount: { textAlign: 'center', color: Ink.text, fontSize: 20, fontWeight: '800' },
  result: { backgroundColor: Quantity.amber.soft, borderRadius: 9, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
