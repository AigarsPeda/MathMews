import { canSnapshotModel, useModelPaint } from './counting/useModelPaint';
import { RatioBottles } from './RatioTableModel';
import { PuzzleText } from './PuzzleText';
import { PlayProofCaption } from './PlayProofCaption';
import { ProofCaption } from './kit/Focus';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';
import { Ink, ProofMotion } from '@/constants/puzzle-theme';
import type { RatioTablePuzzle } from '@/types/puzzle';
import { ratioGroups } from '@/utils/bridge-models';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export function RatioReveal({ puzzle, submitted, onSolutionShown }: { puzzle: RatioTablePuzzle; submitted?: number; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const { b } = puzzle.payload;
  const { start, end, bottles, litres } = ratioGroups(puzzle.payload);
  const changes = Math.abs(end - start);
  const count = changes + 1;
  const beats = useRevealBeats(count, { awaitInitialPaint: canSnapshotModel, lead: ProofMotion.lead, step: ProofMotion.group, hold: ProofMotion.repeatHold,
    minTotal: 0, reducedSteps: true, onDone: onSolutionShown });
  const modelRef = useModelPaint(start > 0 && bottles > 0, beats);
  const groups = start + Math.sign(end - start) * Math.min(changes, beats.landed);
  const amount = (value: number) => t('jugSolution.litres', { value });
  const final = end % start === 0 ? `${end / start} × ${amount(b)} = ${amount(end * litres)}`
    : start % end === 0 ? `${amount(b)} ÷ ${start / end} = ${amount(end * litres)}`
      : `${end} × ${amount(litres)} = ${amount(end * litres)}`;
  const attempted = beats.landed >= changes && beats.landed > 0 ? submitted : undefined;
  const caption = beats.settled ? final : '';
  return <RevealSurface beats={beats}>
    <View ref={modelRef} collapsable={false} nativeID="play-proof-model" testID="play-proof-model" accessible accessibilityLabel={t('bridge.ratioGroup', { count: groups * bottles, litres: t('bridge.litreAmount', { count: groups * litres }) })}>
      <RatioBottles puzzle={puzzle} filled={groups} settled={beats.settled} submitted={attempted}
        answer={<PuzzleText style={{ fontSize: 20, fontWeight: '800', color: Ink.text }}>{beats.landed === 0 ? '?' : amount(attempted ?? groups * litres)}</PuzzleText>} />
    </View>
    <PlayProofCaption><View testID={beats.settled ? "play-proof-equation" : undefined} nativeID={beats.settled ? "play-proof-equation" : undefined}><ProofCaption text={caption} /></View></PlayProofCaption>
  </RevealSurface>;
}
