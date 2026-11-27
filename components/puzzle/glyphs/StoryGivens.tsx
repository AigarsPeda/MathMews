import { LineDot, placeLineLabels } from '../number-line/LineMarks';
import { ProofEquationSlot } from '../everyday/ProofEquationSlot';
import { useProofViewport } from '../PlayProofCaption';
import { Canvas, Path } from '@shopify/react-native-skia';
import { useContext, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Motion, Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import { DenseLabel, useMeasuredLabels, valueToken } from '../kit/DenseLayout';
import { useModelPaint } from '../counting/useModelPaint';
import { ProofPlaybackContext } from '../kit/ProofFeedback';
import type { RevealBeats } from '../kit/useRevealBeats';
import { Caption } from '../kit/Focus';
import { storyAnswerUnit } from '@/utils/story-answer-unit';
import type { Puzzle } from '@/types/puzzle';
import { moderateScale } from '@/utils/scale';
import { PuzzleText } from '../PuzzleText';
import { EntryBuild, StoryIdleCue } from '../kit/PracticeAffordances';

export function splitNumberSequence(question: string) {
  const match = /(?:^|\s)((?:[−-]?\d+|\?)(?:,\s*(?:[−-]?\d+|\?)){2,7})[.!]?\s*$/.exec(question);
  if (!match || !match[1].split(',').some(value => value.trim() === '?')) return null;
  return { question: question.slice(0, match.index).trim(), terms: match[1].split(/,\s*/) };
}

export function SequenceGivens({ idle = false, terms, solution, attemptValue, settled, writtenAnswer, revealing, landed, beats }: { idle?: boolean; attemptValue?: string; writtenAnswer?: ReactNode; beats?: RevealBeats; terms: string[]; solution?: string; settled: boolean; revealing: boolean; landed: number }) {
  const [width, setWidth] = useState(0);
  const {fontScale} = useWindowDimensions();
  const measure = useMeasuredLabels([...terms, ...(solution ? [solution] : [])], 'sequence');
  const answer = revealing && landed >= 2 ? solution : attemptValue;
  const drawing = useModelPaint(measure.ready && width > 0, beats);
  const columns = Math.max(1, Math.min(terms.length, Math.floor((width + 4) / (Math.max(56, measure.width + 24) + 4))));
  const tileWidth = Math.min(width, Math.max(64, measure.width + 24), (width - 4 * (columns - 1)) / columns);
  const rows = Array.from({ length: Math.ceil(terms.length / columns) }, (_, i) => terms.slice(i * columns, (i + 1) * columns));
  const known = terms.map((term, i) => ({ i, n: Number(term.replace('−', '-')) })).filter(term => Number.isFinite(term.n));
  const steps = known.slice(1).map((term, i) => (term.n - known[i].n) / (term.i - known[i].i));
  const step = steps.length && steps.every(d => Number.isInteger(d) && d === steps[0]) ? steps[0] : 0;
  const ratios = known.slice(1).map((v, i) => (v.n / known[i].n) ** (1 / (v.i - known[i].i)));
  const ratio = ratios[0];
  const multiplier = ratio > 0 && ratio !== 1 && ratios.every(r => Math.abs(r - ratio) < 1e-7)
    && (Number.isInteger(ratio) || Number.isInteger(1 / ratio));
  const delta = step ? (step > 0 ? '+' + step : String(step).replace('-', '−')) :
    multiplier ? (ratio > 1 ? '×' + ratio : '÷' + (1 / ratio)) : '';
  const example = terms.findIndex((term, i) => i % columns > 0 && term !== '?' && terms[i - 1] !== '?') - 1;
  const hopHeight = 30 * fontScale + 24;
  return <View ref={drawing} collapsable={false} nativeID={beats ? "play-proof-model" : "play-entry-model"} testID={beats ? "play-proof-model" : "play-entry-model"} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {measure.probe}
    {measure.ready && width > 0 && rows.map((row, r) => {
      const start = r * columns;
      const hop = delta && example >= start && example < start + row.length - 1;
      const x = (example - start) * (tileWidth + 4) + tileWidth / 2;
      return <View key={start} style={styles.sequenceRow}>
        {hop && <View testID="sequence-proof-hops" style={{height: hopHeight}}>
          <Canvas accessible={false} style={StyleSheet.absoluteFill}>
            {/* friendly-ok: This band connects the two terms that demonstrate the step. */}
            <Path color={Quantity.violet.fill} style="stroke" strokeWidth={10} strokeCap="round" path={`M${x} ${hopHeight - 5} Q${x + (tileWidth + 4) / 2} ${hopHeight - 32} ${x + tileWidth + 4} ${hopHeight - 5}`} />
          </Canvas>
          <PuzzleText style={[styles.hop, {left: x, width: tileWidth + 4}]}>{delta}</PuzzleText>
        </View>}
        <View style={styles.terms}>{row.map((term, i) => {
          const palette = term !== '?' ? Quantity.teal : revealing && answer ? Quantity.violet : Quantity.amber;
          const label = <DenseLabel role="sequence">{term === '?' ? answer ?? '?' : term}</DenseLabel>;
          return <EntryBuild key={i} index={start + i}><View style={[styles.termLip, {width: tileWidth, backgroundColor: palette.edge}]}>
            <View style={[styles.termFace, {backgroundColor: palette.fill}]}>
              {term === '?' ? <StoryIdleCue active={idle}>{writtenAnswer ?? label}</StoryIdleCue> : label}
            </View>
          </View></EntryBuild>;
        })}</View>
      </View>;
    })}
    {delta !== '' && terms.indexOf('?') > 0 && <View accessibilityElementsHidden={!revealing || !landed} importantForAccessibility={!revealing || !landed ? 'no-hide-descendants' : 'auto'}
      nativeID={settled ? 'play-proof-equation' : undefined} testID={settled ? 'play-proof-equation' : undefined} style={{marginTop: 18, opacity: revealing && landed ? 1 : 0}}>
      <Caption strong>{revealing && landed ? `${terms[terms.indexOf('?') - 1]} ${delta[0]} ${delta.slice(1)} = ${answer ?? '?'}` : ' '}</Caption>
    </View>}
  </View>;
}

function LimitLine({ missed, limit, choices, description, answer, revealing, landed, beats }: { missed: boolean; beats?: RevealBeats; limit: number; choices: string[]; description: string; answer: number; revealing: boolean; landed: number }) {
  const [width, setWidth] = useState(0);
  const {fontScale} = useWindowDimensions();
  const candidates = choices.map(Number).filter(Number.isFinite);
  const { settled } = useContext(ProofPlaybackContext);
  const modelID = revealing ? 'play-proof-model' : 'play-entry-model';
  // Zoom to consecutive integers around the boundary, including all nearby choices.
  const low = Math.max(0, 2 * Math.floor((Math.min(limit - 3, ...candidates) - 1) / 2));
  const high = 2 * Math.ceil(Math.max(limit + 2, ...candidates) / 2);

  const drawing = useModelPaint(width > 0, beats);
  const count = high - low + 1;
  const ticks = Array.from({ length: count }, (_, i) => low + i);
  const scale = Math.min(1.65, fontScale);
  const inset = Math.min(width / 2, Math.max(14, 2 + String(high).length * 7 * scale));
  const x = (n: number) => inset + (n - low) * (width - 2 * inset) / (high - low);
  const major = [...new Set([limit, low, high, ...ticks.filter(n => n % 2 === 0)])];
  const labels = placeLineLabels(major.map(n => ({ n, center: x(n), width: 4 + 14 * String(n).length * scale })), width, 1);
  const baseline = moderateScale(58);
  const dot = (n: number, palette: {fill: string; edge: string}) => (
    <View style={[styles.lineDot, {left: x(n) - 14, top: baseline - 14}]}>
      <LineDot palette={palette} />
    </View>
  );
  return <View accessible accessibilityLabel={description} style={styles.sequence}>
    <View ref={drawing} collapsable={false} nativeID={modelID} testID={modelID} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <EntryBuild ready={width > 0} lead={Motion.lead}>
        <View style={{ height: Math.max(moderateScale(132), baseline + 20 + 30 * scale) }}>
          {width > 0 && <>
            {/* One 20 pt rail: empty grey for the whole range, teal up to the limit. No thin ticks (wave 13). */}
            <View style={[styles.limitBand, styles.limitRail, { top: baseline - 10, left: x(low), width: x(high) - x(low) }]} />
            {labels.map(label => <PuzzleText key={label.n} numberOfLines={1} maxFontSizeMultiplier={1.65}
              style={[styles.limitLabel, { top: baseline + 18, left: label.left, width: label.width }]}>{label.n}</PuzzleText>)}
            <View style={[styles.limitBand, {top: baseline - 10, left: x(low), width: x(limit) - x(low)}]} />
            {dot(limit, Quantity.teal)}
            {revealing && landed >= 2 && dot(answer, missed ? Quantity.amber : Quantity.violet)}
          </>}
        </View>
      </EntryBuild>
    </View>
    {revealing && <ProofEquationSlot settled={settled}><Caption strong>{landed >= 2 ? `${answer} ${answer === limit ? '=' : answer > limit ? '>' : '<'} ${limit}` : ' '}</Caption></ProofEquationSlot>}
  </View>;
}

export function getStoryRate(puzzle: Puzzle) {
  if (puzzle.type === 'multiple_choice' && puzzle.topic === 'multiplication' && puzzle.contextObjects?.length && !puzzle.taskVisual) {
    const equation = /^(\d+)\s*×\s*(\d+)\s*=\s*(\d+)/.exec(puzzle.explanation);
    if (equation && puzzle.contextObjects[0].object !== 'planting_tile') {
      const [groups, unitRate, product] = equation.slice(1).map(Number);
      if (groups > 0 && groups <= 20 && unitRate > 0 && groups * unitRate === product && product === Number(puzzle.choices[puzzle.correctIndex])) {
        return { amount: unitRate, given: 1, wanted: groups, knownUnit: true };
      }
    }
  }
  const numerals = puzzle.question.match(/\d+/g)?.map(Number) ?? [];
  if (puzzle.helpTemplate !== 'rate' || numerals.length !== 3) return null;
  const operands = /^(\d+)\s*÷\s*(\d+)\s*×\s*(\d+)\s*=/.exec(puzzle.explanation);
  if (!operands || operands.slice(1).map(Number).sort((a, b) => a - b).join() !== [...numerals].sort((a, b) => a - b).join()) return null;
  const [amount, given, wanted] = operands.slice(1).map(Number);
  return given > 0 && wanted > 0 && Math.max(given, wanted) <= 20 && amount % given === 0 ? { amount, given, wanted, knownUnit: false } : null;
}

export function isLimitStory(puzzle: Puzzle) {
  return puzzle.type === 'multiple_choice' && puzzle.helpTemplate === 'number_range' && puzzle.question.match(/\d+/g)?.length === 1 && /fewer than|mazāk nekā|меньше/i.test(puzzle.question);
}

export function StoryGivens({ idle = false, puzzle, checkedIndex, attemptValue, writtenAnswer, solved = false, revealing = false, landed = 0, beats }: { idle?: boolean; attemptValue?: string; writtenAnswer?: ReactNode; beats?: RevealBeats; puzzle: Puzzle; checkedIndex?: number | null; solved?: boolean; revealing?: boolean; landed?: number }) {
  const { t, i18n } = useTranslation();

  const [measuredWidth, setTrackWidth] = useState(0);
  const viewport = useProofViewport();
  const { width: screenWidth } = useWindowDimensions();
  const trackWidth = measuredWidth || viewport?.innerWidth || Math.max(1, screenWidth - 48);

  const rate = getStoryRate(puzzle);
  const drawing = useModelPaint(!!rate && measuredWidth > 0, beats);
  if (rate) {
    const { amount, given, wanted } = rate;
    const max = Math.max(given, wanted);
    const suffix = storyAnswerUnit(puzzle, i18n.language) || (puzzle.contextObjects?.[0] && (rate.knownUnit || puzzle.contextObjects[0].object === 'plant')
      ? t('taskObjects.' + puzzle.contextObjects[0].object) : '');
    const unit = suffix ? ' ' + suffix : '';
    const value = amount / given;

    const delta = wanted - given;
    const parts = landed < 2 ? given : given + Math.sign(delta) * Math.round(Math.abs(delta) * (landed - 1) / Math.max(1, Math.min(4, Math.abs(delta))));
    const equation = !revealing || landed === 0 ? valueToken(`${amount}${unit}`) : landed === 1 && !solved ?
      t('objectScenes.perPart', { value: valueToken(`${value}${unit}`) }) :
      `${parts} × ${value} = ${parts * value}${unit}`;
    const modelID = revealing ? 'play-proof-model' : 'play-entry-model';
    const attempted = attemptValue == null ? undefined : Number(attemptValue);
    const marker = attempted !== undefined && Number.isFinite(attempted) ? Math.min(1, Math.max(0, attempted / (max * value))) : undefined;
    const maxColumns = Math.max(1, Math.floor((trackWidth + 4) / (44 + 4)));
    const rows = Math.ceil(max / maxColumns);
    const columns = Math.ceil(max / rows);
    const tileWidth = Math.min(84, Math.floor((trackWidth - (columns - 1) * 4) / columns));
    const tapeWidth = columns * tileWidth + (columns - 1) * 4;
    const markerUnits = marker === undefined ? undefined : marker * max;
    const markerIndex = markerUnits === undefined ? -1 : Math.max(0, Math.min(max - 1, Math.ceil(markerUnits) - 1));
    const submitted = attemptValue === undefined ? undefined : `${valueToken(`${amount}${unit}`)} → ${valueToken(`${attemptValue}${unit}`)}`;
    return <View ref={drawing} collapsable={false} nativeID={modelID} testID={modelID} style={styles.rates} onLayout={e => setTrackWidth(e.nativeEvent.layout.width)} accessible={!writtenAnswer} accessibilityLabel={revealing ? equation : submitted ?? puzzle.question}>
      <View style={{alignItems: 'center'}}>
      <EntryBuild ready={measuredWidth > 0} lead={Motion.lead}><View style={[styles.rateTape, {width: tapeWidth}]}>
        {Array.from({length: max}, (_, i) => {
          const hue = (landed === 1 && i === 0) || i >= given ? Quantity.violet : Quantity.teal;
          const filled = markerUnits === undefined ? i < parts : i < markerUnits;
          const fill = i === markerIndex ? Quantity.amber.fill : filled ? hue.fill : Shape.empty;
          return <View key={i} style={[styles.rateTile, {width: tileWidth, backgroundColor: fill}]} />;
        })}
      </View></EntryBuild>
      </View>
      <View style={styles.rateLabels} nativeID={solved ? 'play-proof-equation' : undefined} testID={solved ? 'play-proof-equation' : undefined}>
        {revealing || submitted ? <Caption strong style={styles.bagLabel}>{solved ? `${valueToken(`${amount}${unit}`)} → ${valueToken(`${wanted * value}${unit}`)}` : revealing ? equation : submitted}</Caption> : <><Caption strong style={styles.bagLabel}>{valueToken(`${amount}${unit}`)} →</Caption>
          <StoryIdleCue active={idle && measuredWidth > 0}>{writtenAnswer ?? <Caption strong>?{unit}</Caption>}</StoryIdleCue></>}
      </View>
    </View>;
  }
  if (puzzle.type === 'multiple_choice' && isLimitStory(puzzle)) {
    return <LimitLine missed={checkedIndex != null && checkedIndex !== puzzle.correctIndex} beats={beats} limit={Number(puzzle.question.match(/\d+/)?.[0])} choices={puzzle.choices} description={solved ? puzzle.explanation : puzzle.question} revealing={revealing} landed={landed} answer={Number(puzzle.choices[checkedIndex ?? puzzle.correctIndex])} />;
  }
  return null;
}
const styles = StyleSheet.create({
  sequence: { justifyContent: 'center', paddingVertical: 14 },
  sequenceRow: {alignSelf: 'center', marginVertical: 2},
  terms: {flexDirection: 'row', gap: 4, justifyContent: 'center'},
  termLip: {paddingBottom: 3, borderRadius: 14},
  termFace: {minHeight: 57, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 14},
  rateTape: {flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center'},
  rateTile: {height: 64, borderRadius: 10},
  bagLabel: {fontSize: 20, fontWeight: '800', textAlign: 'center'},
  hop: { position: 'absolute', top: 0, textAlign: 'center', color: Ink.text, fontWeight: '800', fontSize: 20 },
  rates: { alignSelf: 'stretch', alignItems: 'center', marginVertical: 6, paddingTop: 4, gap: 8, justifyContent: 'center' },
  rate: { gap: 4 },
  each: { fontSize: 16, textAlign: 'left' },
  rateLabels: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, alignItems: 'center', justifyContent: 'center' },
  limitLabel: { position: 'absolute', color: Ink.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  limitBand: {position: 'absolute', height: 20, borderRadius: 10, backgroundColor: Quantity.teal.fill},
  limitRail: {backgroundColor: Shape.empty},
  lineDot: {position: 'absolute', width: 28, height: 31},
});
