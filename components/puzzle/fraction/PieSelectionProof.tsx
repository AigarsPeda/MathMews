import { ProofFinale } from '../kit/ProofFeedback';
import { RevealSurface } from '../kit/RevealSurface';
import { useRevealBeats } from '../kit/useRevealBeats';
import { useProofCanvasPaint } from '../ProofCanvas';
import { Quantity } from '@/constants/puzzle-theme';
import type { FractionDiagram } from '@/utils/fraction-reveal';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { FractionNotation } from './FractionNotation';
import { TappableFractionPie, usePieSize } from './TappableFractionPie';
import { Caption } from '../kit/Focus';

export function PieSelectionProof({ diagrams, halves, onSolutionShown }: {
  diagrams: FractionDiagram[]; halves?: number; onSolutionShown: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const paired = diagrams.length > 1;
  const masks = diagrams.map(part => [...(part.selected ?? Array.from({ length: part.numerator }, (_, i) => i))].sort((a, b) => a - b));
  const count = Math.max(1, masks.reduce((sum, mask) => sum + mask.length, 0));
  const miss = diagrams.some((part, i) => (halves ?? masks[i].length) !== (part.targetCount ?? part.numerator));
  const beats = useRevealBeats(miss ? 0 : count, { awaitInitialPaint: true, lead: 100, minTotal: 0,
    reducedSteps: true, step: Math.min(500, Math.floor((paired ? 1800 : 1400) / count)),
    hold: landed => landed === count ? 400 : 0, onDone: onSolutionShown });
  const trackCanvas = useProofCanvasPaint(beats, true, diagrams.map((_, i) => i));
  const size = usePieSize(Math.min(2, diagrams.length));
  return <RevealSurface beats={beats}>
    <View style={styles.pair} testID="play-proof-model" nativeID="play-proof-model">
      {diagrams.map((part, i) => {
        const mask = masks[i];
        const preceding = masks.slice(0, i).reduce((sum, earlier) => sum + earlier.length, 0);
        const local = Math.min(mask.length, Math.max(0, beats.landed - preceding));
        const submitted = halves ?? mask.length;
        const target = part.targetCount ?? part.numerator;
        const mismatch = submitted !== target;
        const trace = !beats.settled && local > 0 && beats.landed <= preceding + mask.length ? [mask[local - 1]] : undefined;
        const difference = submitted > target ? mask.slice(target)
          : Array.from({ length: part.denominator }, (_, j) => j).filter(j => !mask.includes(j)).slice(0, target - submitted);
        if (halves !== undefined && submitted > part.denominator) difference.push(part.denominator - 1);
        const shown = beats.settled || miss ? mask.length : local;
        return <View key={i} style={styles.diagram}>
          <TappableFractionPie denominator={part.denominator} size={size} trackCanvas={trackCanvas} canvasIndex={i}
            shaded={shown} selectedSlices={halves !== undefined && !miss && !beats.settled ? mask.slice(0, local) : mask}
            traced={miss ? undefined : trace} discrepancies={mismatch ? difference : undefined} />
          <View testID={!i && beats.settled ? 'play-proof-equation' : undefined}
            nativeID={!i && beats.settled ? 'play-proof-equation' : undefined}>
            <ProofFinale settled={beats.settled}><View style={[styles.equation, mismatch && beats.settled && styles.miss]}
              accessible accessibilityLabel={`${shown}/${part.denominator}${halves === 2 && beats.settled ? ' = 1' : ''}`}>
              <FractionNotation numerator={shown} denominator={part.denominator} compact={fontScale >= 1.5} />
              {halves === 2 && beats.settled ? <Caption strong style={styles.equals}>= 1</Caption> : null}
            </View></ProofFinale>
          </View>
        </View>;
      })}
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  diagram: { alignItems: 'center', gap: 4 },
  equation: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  equals: { fontSize: 26, lineHeight: 32 },
  miss: { borderRadius: 8, backgroundColor: Quantity.amber.soft },
});
