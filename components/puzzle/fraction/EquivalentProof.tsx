import { useProofViewport } from '../PlayProofCaption';
import { ProofFinale } from '../kit/ProofFeedback';
import { RevealSurface } from '../kit/RevealSurface';
import { useRevealBeats } from '../kit/useRevealBeats';
import { Caption } from '../kit/Focus';
import { EquivalentBar } from './EquivalentBar';
import { FractionNotation } from './FractionNotation';
import type { FractionDiagram } from '@/utils/fraction-reveal';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

export function EquivalentProof({ given, target, submitted, submittedFraction, onSolutionShown }: {
  given: FractionDiagram; target: FractionDiagram; submitted?: number;
  submittedFraction?: Pick<FractionDiagram, 'numerator' | 'denominator'>; onSolutionShown: () => void;
}) {
  const viewport = useProofViewport();
  const { width: screen, fontScale } = useWindowDimensions();
  const width = Math.min(328, viewport?.innerWidth ?? screen - 60);
  const groups = given.denominator, fills = given.numerator;
  const count = groups + (submittedFraction ? 0 : fills);
  const beats = useRevealBeats(count, { lead: 100, minTotal: 0, reducedSteps: true,
    step: i => i < groups ? 1300 / groups : 800 / Math.max(1, fills),
    hold: i => i === count ? 340 : 0, onDone: onSolutionShown });
  const counted = Math.max(0, beats.landed - groups);
  const shown = submittedFraction ?? target;
  const top = beats.settled ? shown.numerator : !counted ? '?' : Math.round(counted * shown.denominator / groups);
  const relation = beats.settled && submittedFraction ? '≠' : '=';
  return <RevealSurface beats={beats}>
    <View testID="play-proof-model" nativeID="play-proof-model" style={styles.board}>
      <View nativeID={beats.settled ? 'play-proof-equation' : undefined} testID={beats.settled ? 'play-proof-equation' : undefined}>
        <ProofFinale settled={beats.settled}><View style={styles.equation} accessible
          accessibilityLabel={`${given.numerator}/${given.denominator} ${relation} ${top}/${shown.denominator}`}>
          <FractionNotation numerator={given.numerator} denominator={given.denominator} compact={fontScale >= 1.5} />
          <Caption strong>{relation}</Caption>
          <FractionNotation numerator={top} denominator={shown.denominator} compact={fontScale >= 1.5} />
        </View></ProofFinale>
      </View>
      <EquivalentBar width={width} given={given} denominator={shown.denominator} position={beats.position}
        reduced={beats.reduced} submitted={submittedFraction?.numerator ?? submitted} />
    </View>
  </RevealSurface>;
}
const styles = StyleSheet.create({
  board: { alignItems: 'center', gap: 6 },
  equation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
