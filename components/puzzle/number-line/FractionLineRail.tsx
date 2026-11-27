import { LineDot } from './LineMarks';
import { PuzzleText } from '../PuzzleText';
import { useProofViewport } from '../PlayProofCaption';
import { useContext, type ReactNode } from 'react';
import { HelpProofContext } from '../kit/HelpProofContext';
import { Ink, Quantity } from '@/constants/puzzle-theme';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

export const fractionMarkerSize = 28;
export const fractionHopHeight = 34;
export const fractionLineBaseline = 76;
export const fractionLineLabelOffset = 19;

/** The rail fills the model: end ticks sit one gutter from each side, ticks are evenly pitched between. */
export const fractionLineGutter = 20;
export function fractionLineSpacing(viewport: number, count: number, endpointWidth: number) {
  return Math.max(44, endpointWidth, (viewport - 2 * fractionLineGutter) / Math.max(1, count - 1));
}
export const fractionLineWidth = (spacing: number, count: number) => 2 * fractionLineGutter + (count - 1) * spacing;
export function fractionLineX(spacing: number, index: number) { 'worklet'; return fractionLineGutter + index * spacing; }

// Anchor the rail inside the stage even when the verdict changes the dock height.
export function FractionLineStage({ children }: { children: ReactNode }) {
  const viewport = useProofViewport();
  const { fontScale } = useWindowDimensions();
  const paddingTop = viewport ? Math.min(viewport.innerWidth * (fontScale > 1.65 ? .08 : .30),
    Math.max(0, viewport.availableModelHeight - fractionLineBaseline - fractionLineLabelOffset - 32 * fontScale)) : 0;
  return <View style={{ paddingTop }}>{children}</View>;
}

export function FractionLineRail({ baseline, spacing, count, testPrefix, labels = [] }: {
  baseline: number; spacing: number; count: number; testPrefix?: string; labels?: readonly number[];
}) {
  const help = useContext(HelpProofContext);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={[styles.rail, help && styles.helpRail, { left: fractionLineGutter, right: fractionLineGutter, top: baseline - 6 }]} />
    {Array.from({ length: count }, (_, index) => <View key={index}
      testID={testPrefix ? `${testPrefix}${index}` : undefined}
      style={[styles.tick, help && styles.helpTick, { left: fractionLineX(spacing, index) - (help ? 6 : 5), top: baseline - (help ? 13 : 9) }]} />)}
    {labels.filter(tick => tick > 0 && tick < count - 1).map(tick => <PuzzleText key={tick} numberOfLines={1} adjustsFontSizeToFit
      maxFontSizeMultiplier={1.4} style={[styles.label, help && { fontSize: 26 }, { left: fractionLineX(spacing, tick) - spacing / 2, width: spacing, top: baseline + fractionLineLabelOffset }]}>
      {`${tick}/${count - 1}`}
    </PuzzleText>)}
  </View>;
}

export function FractionLineMarker({ amber = false }: { amber?: boolean } = {}) {
  return <LineDot palette={amber ? Quantity.amber : Quantity.violet} />;
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', height: 12, borderRadius: 6, backgroundColor: Quantity.teal.light },
  label: { position: 'absolute', textAlign: 'center', fontSize: 20, fontWeight: '800', color: Ink.text },
  tick: { position: 'absolute', width: 10, height: 18, borderRadius: 5, backgroundColor: Quantity.teal.fill },
  // Picture help: a solid rail like the puzzles' number lines, with small solid notches instead of pale ticks.
  helpRail: { backgroundColor: Quantity.teal.fill },
  helpTick: { width: 12, height: 26, borderRadius: 6, backgroundColor: Quantity.teal.edge },
});
