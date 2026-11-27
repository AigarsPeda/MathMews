import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { DecimalGridPuzzle, PercentageExample, PlaceValuePuzzle } from '@/types/puzzle';
import { changePlaceValue, initialPlaceValue } from '@/utils/place-value';
import { decimalLabel } from '@/utils/decimal-models';
import { percentageShareParts } from '@/utils/percentage-reveal';
import { PlaceValueMat } from '../place-value/PlaceValueMat';
import { PercentageShareBar } from '../percentage/PercentageShareBar';
import { BaseTenGrid } from '../BaseTenGrid';
import { RevealSurface } from '../kit/RevealSurface';
import { ProofLine, useHelpBeats, useHelpCaption } from './helpKit';

type ProofProps = { height: number; onSolutionShown: () => void };
/** How long the whole bar is on screen, alone and labelled, before it splits. */
const WHOLE_HOLD_MS = 1200;

export function HelpBundleProof({ puzzle, height, onSolutionShown }: ProofProps & { puzzle: PlaceValuePuzzle }) {
  const beats = useHelpBeats(2, onSolutionShown, 950, 420);
  const before = initialPlaceValue(puzzle);
  const after = changePlaceValue(puzzle, before, 'bundle');
  return <RevealSurface beats={beats}>
    <PlaceValueMat tens={after.tens} ones={after.ones} checked capacity={{ tens: after.tens, ones: before.ones }}
      transition={{ kind: 'bundle', from: before }} landed={beats.landed} position={beats.position}
      detailVisible={beats.landed < 2} reduced={beats.reduced} matHeight={height} laneHeight={height} />
    <ProofLine equation={beats.settled ? `${after.tens} × 10 + ${after.ones} = ${puzzle.payload.start}` : undefined} />
  </RevealSurface>;
}

/** Tenths first: one column of the hundred square is 1 tenth = 10 hundredths, then the single hundredths are shaded beside it. */
export function HelpHundredthsProof({ puzzle, height, onSolutionShown }: ProofProps & { puzzle: DecimalGridPuzzle }) {
  const { hundredths, digits } = puzzle.payload;
  const { t, i18n } = useTranslation();
  const [width, setWidth] = useState(0);
  const tenths = Math.floor(hundredths / 10), ones = hundredths % 10;
  const stages = [tenths > 0 ? 'tenth' : null, ones > 0 ? 'more' : null].filter((stage): stage is 'tenth' | 'more' => !!stage);
  // Each state is held long enough to read its caption: "1 tenth = 10 hundredths", then the rest.
  const beats = useHelpBeats(stages.length, onSolutionShown, 350, landed => landed < stages.length ? 1500 : 900, 900);
  const stage = stages[beats.landed - 1];
  const caption = beats.settled || !stage ? null : t(`visualHelp.examples.decimals.${stage}`, { count: ones });
  const sheetCaption = useHelpCaption(caption);
  const tenthsShown = stages[0] === 'tenth' && beats.landed >= 1 ? tenths * 10 : 0;
  const onesShown = stages.at(-1) === 'more' && beats.landed >= stages.length ? ones : 0;
  const selected = Array.from({ length: tenthsShown + onesShown }, (_, i) => i);
  const accent = Array.from({ length: onesShown }, (_, i) => tenthsShown + i);
  const lang = i18n.language;
  return <RevealSurface beats={beats}>
    <View onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ alignSelf: 'stretch', alignItems: 'center' }}>
      {width > 0 && <BaseTenGrid size={Math.min(width, Math.max(240, height))} hue="teal" amount={selected.length} selected={selected} accent={accent} />}
    </View>
    <ProofLine caption={sheetCaption ? undefined : caption ?? undefined}
      equation={beats.settled ? `${[tenths && decimalLabel(tenths * 10, 1, lang), ones && decimalLabel(ones, 2, lang)].filter(Boolean).join(' + ')} = ${decimalLabel(hundredths, digits, lang)}` : undefined} />
  </RevealSurface>;
}

/** The whole bar first (labelled with the whole), then split into equal parts, then one part kept. */
export function HelpPercentProof({ example, height, onSolutionShown }: ProofProps & { example: PercentageExample }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  // The whole bar stands alone first: the beats only arm once it has been on screen for a full second.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (width <= 0) return;
    const wait = setTimeout(() => setArmed(true), WHOLE_HOLD_MS);
    return () => clearTimeout(wait);
  }, [width]);
  const beats = useHelpBeats(armed ? 2 : null, onSolutionShown, 350, landed => landed < 2 ? 1400 : 1000);
  const { whole, percent } = example;
  const parts = percentageShareParts(percent);
  const stage = (['whole', 'split', 'take'] as const)[beats.landed];
  const caption = beats.settled ? null : t(`visualHelp.examples.percent.${stage}`, { whole, parts: parts ?? 1 });
  const sheetCaption = useHelpCaption(caption);
  if (!parts) return null;
  return <RevealSurface beats={beats}>
    <View onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))}
      style={{ height, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
      {width > 0 && <PercentageShareBar parts={parts} width={width} whole={whole} helpBeat={beats.landed} />}
    </View>
    <ProofLine caption={sheetCaption ? undefined : caption ?? undefined} equation={beats.settled ? `${percent}% × ${whole} = ${whole / parts}` : undefined} />
  </RevealSurface>;
}
