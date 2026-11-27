import { ProofEquationSlot } from './everyday/ProofEquationSlot';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { PuzzleText } from './PuzzleText';
import { Ink, proofTempo, Quantity } from '@/constants/puzzle-theme';
import { useLocale } from '@/contexts/LocaleProvider';
import { capacityChoiceLevel, jugMeasure, jugScale, type CapacityAttempt, type CapacityInput, type CapacityModel } from '@/utils/puzzle-capacity';
import { PaintedModel } from './everyday/PaintedModel';
import { ProofWindow } from './everyday/ProofWindow';
import { fitScaleLabels } from './everyday/scaleLabels';
import { AdjustableTrace, DiagramSurface } from './everyday/DiagramSurface';
import { DenseLabel, useMeasuredLabels, valueToken } from './kit/DenseLayout';
import { ProofCaption } from './kit/Focus';
import { useRevealBeats, type RevealBeats } from './kit/useRevealBeats';

import { PortionStrip } from './everyday/PortionStrip';
import { JugScaleInput } from './everyday/JugScaleInput';

const water = Quantity.teal;
function FillBand({
  base,
  volume,
  scale,
  progress,
  tint,
}: {
  base: number;
  volume: number;
  scale: number;
  progress: SharedValue<number>;
  tint: string;
}) {
  const fill = useAnimatedStyle(() => ({ height: scale * Math.min(volume, Math.max(0, progress.value - base)) }));
  return <Animated.View style={[styles.band, { bottom: base * scale, backgroundColor: tint }, fill]} />;
}

type VesselProps = {
  model: CapacityModel;
  capacity: number;
  amount: number;
  stops: number[];
  progress?: SharedValue<number>;
  beats?: RevealBeats;
  available: number;
  height: number;
  guide?: SharedValue<number>;
  retainedAmount?: number;
  guideAt?: number;
  input?: CapacityInput;
  attempt?: CapacityAttempt;
};
function Vessel({
  model,
  capacity,
  amount,
  stops,
  progress,
  beats,
  available,
  height: preferredHeight,
  guide,
  guideAt,
  retainedAmount, input, attempt,
}: VesselProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const viewport = useProofViewport();
  const solving = !!beats;
  const plan = jugScale(model, capacity);
  // Retain every graduation; space the printed numerals to fit the measured native text.
  const axisUnit = t('jugSolution.axisMl');
  const scaleValues = solving && model.task === 'total' ? [...plan.majors, ...stops] : plan.majors;
  const samples = scaleValues.map(String);
  samples.push(axisUnit);
  const litreReference = t('jugSolution.litres', { value: 1 });
  if (model.task === 'litres' && !solving) samples.push(litreReference);
  const axis = useMeasuredLabels(samples, 'axis');
  const axisH = axis.ready ? axis.height : 18 * fontScale;
  const axisW = axis.ready ? axis.width : (solving ? 60 : 36) * fontScale;
  const stride = Math.max(1, Math.ceil((plan.majors.length - 1) / 5));
  const interval = (plan.majors[1] ?? capacity) * stride;
  const regularLabels = plan.majors.filter(
    (v, i) => v === capacity || (i % stride === 0 && capacity - v >= interval * 0.65),
  );
  // For a sum, label the actual liquid boundaries on the receiver when they fit the scale.
  const pourLabels =
    solving && model.task === 'total' ? [...new Set([0, ...stops, capacity])].sort((a, b) => a - b) : [];
  const spacedPours = pourLabels.length > 1 && pourLabels.every((v, i) => !i || v - pourLabels[i - 1] >= capacity / 5);
  const candidates = spacedPours ? pourLabels : regularLabels;
  const smallestLabelGap = Math.min(...candidates.slice(1).map((v, i) => v - candidates[i]));
  const smallestMarkGap = Math.min(...plan.marks.slice(1).map((v, i) => v - plan.marks[i]));
  // Give the centred jug room for the complete widest number on its left, including at XL.
  const room = Math.max(44, available - 2 * (axisW + 16) - 20);
  const chamber = Math.min(152, room);
  const frameWidth = available;
  const left = (available - chamber - 20) / 2;
  const head = axisH / 2 + 8;
  // Above the physical rim, reserve space for authored estimates and cap unbounded free-entry attempts.
  const attemptedLevel = capacityChoiceLevel(model, attempt?.choice);
  const maximumChoice = Math.max(capacity, ...(input?.choices ?? []).map(choice => capacityChoiceLevel(model, choice) ?? 0),
    Math.min(capacity * 2, attemptedLevel ?? 0));
  const captionSpace = !solving && model.task !== 'read' ? 26 * fontScale : 0;
  const availableHeight = viewport && viewport.availableModelHeight > 0
    ? Math.max(0, viewport.availableModelHeight - 14 - head - axisH / 2 - 6 - captionSpace)
    : Infinity;
  const ideal = Math.max(preferredHeight, ((axisH + 2) * capacity) / smallestLabelGap);
  // Keep the calibrated ticks separated even when there is room for fewer printed numbers.
  const height = Math.max(104, axisH + 2, (4 * capacity) / smallestMarkGap, Math.min(ideal, availableHeight * capacity / maximumChoice));
  const scale = height / capacity;
  const top = head + (maximumChoice - capacity) * scale;
  // A pour that falls between graduations already has a visible water boundary.
  // Give it a ruler mark only if there is room alongside the calibrated ticks.
  const extraMarks = spacedPours ? pourLabels.filter(value =>
    plan.marks.every(mark => Math.abs(value - mark) * scale >= 4),
  ) : [];
  const marks = [...plan.marks, ...extraMarks].sort((a, b) => a - b);
  const eligible = candidates.filter(value => marks.includes(value));
  const priorities = solving && !attempt && model.task === 'read' && guideAt !== undefined ? [guideAt] : [...stops].reverse();
  const printed = height >= ideal ? eligible : fitScaleLabels(eligible, priorities, capacity / height, axisH + 2);
  const isRead = model.task === 'read' && (!solving || !!attempt);
  const guideStyle = useAnimatedStyle(() => ({ top: top + height - Math.min(maximumChoice, guide?.value ?? 0) * scale - 2 }));
  const givenVolume = (value: number) => valueToken(t('jugSolution.ml', { value }));
  const volume = model.task === 'total' && !solving ? model.amounts.map(givenVolume).join(' + ') : givenVolume(amount);
  const description = isRead
    ? t('everyday.jugAxis', {
        capacity: t('jugSolution.ml', { value: capacity }),
        step: t('jugSolution.ml', { value: plan.minor }),
      })
    : model.task === 'total' && !solving ? volume : model.label;
  return (
    <View style={{ alignItems: 'center', maxWidth: available }}>
      {axis.probe}
      <PaintedModel
        beats={beats}
        ready={axis.ready}
        nativeID={solving ? 'play-proof-model' : 'play-entry-model'}
        testID={solving ? 'play-proof-model' : 'play-entry-model'}
        accessible={solving || (!isRead && !input)}
        accessibilityRole="image"
        accessibilityLabel={solving || (!isRead && !input) ? description : undefined}
        style={{ width: frameWidth, height: top + height + axisH / 2 + 4 }}
      >
        <View style={[styles.handle, { left: left + chamber - 10, top: top + height * 0.17, height: height * 0.42 }]} />
        <View style={[styles.chamber, { top, left, width: chamber, height }]}>
          {!!retainedAmount && <View style={[styles.band, { bottom: 0, height: retainedAmount * scale, backgroundColor: water.fill }]} />}
          {progress && stops.slice(1).map((v, i) => (
            <FillBand
              key={i}
              base={stops[i]}
              volume={v - stops[i]}
              scale={scale}
              progress={progress}
              tint={i % 2 ? water.light : water.fill}
            />
          ))}
        </View>
        <View style={[styles.lip, { left: left - 5, top: top - 2, width: chamber + 10 }]} />
        {marks.map((mark) => {
          const y = top + height - mark * scale;
          const litreMark = model.task === 'litres' && !solving && mark === 1000;
          const referenceOnRight = litreMark && !printed.includes(mark);
          const major = printed.includes(mark) || litreMark;
          return (
            <View pointerEvents="none" key={mark} style={StyleSheet.absoluteFill}>
              <View
                testID={'jug-tick-' + mark}
                style={[styles.tick, { left: referenceOnRight ? left + chamber : left - (major ? 11 : 5), top: y - (major ? 2.5 : 1.5), width: major ? 11 : 5, height: major ? 5 : 3 }]}
              />
              {major && (
                <View
                  style={{ position: 'absolute', left: referenceOnRight ? left + chamber + 14 : left - axisW - 15, width: axisW, flexDirection: 'row', justifyContent: referenceOnRight ? 'flex-start' : 'flex-end', top: y - axisH / 2 }}
                >
                  <DenseLabel role="axis">{litreMark ? litreReference : mark}</DenseLabel>
                </View>
              )}
            </View>
          );
        })}
        {guide && <Animated.View style={[styles.guide, { left: left - 6, width: chamber * .78 }, guideStyle]} />}
        {isRead && !solving && (
          <AdjustableTrace
            selectedValue={input?.selectedIndex == null ? undefined : capacityChoiceLevel(model, input.choices[input.selectedIndex])}
            onMark={n => {
              const index = input?.choices.findIndex(choice => capacityChoiceLevel(model, choice) === n) ?? -1;
              if (index >= 0 && index !== input?.selectedIndex) input?.onSelect(index);
            }}
            marks={plan.marks}
            majors={printed}
            target={amount}
            height={height}
            width={chamber}
            label={(n) => n + ' ' + axisUnit}
            name={t('everyday.traceJug')}
            hint={description}
            jugGrip
            contact={t('everyday.waterline')}
            style={{ position: 'absolute', left, top: top - 8 }}
          />
        )}
        {input && !isRead && <JugScaleInput model={model} input={input} width={chamber} height={top + height + 8}
          left={left} rim={top + height} initial={model.task === 'space' || model.task === 'total' ? model.amounts[0] : 0}
          scale={scale} description={model.label} />}
      </PaintedModel>
      {!solving && !isRead && <DenseLabel role="value">{volume}</DenseLabel>}
    </View>
  );
}

function StaticVessel({ amount, ...props }: Omit<VesselProps, 'progress' | 'stops'>) {
  return <Vessel {...props} amount={amount} retainedAmount={amount} stops={[0, amount]} />;
}
export function JugPour({ model, onSolutionShown, capacityInput, capacityAttempt }: {
  model: CapacityModel; onSolutionShown?: () => void; capacityInput?: CapacityInput; capacityAttempt?: CapacityAttempt;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const window = useWindowDimensions();
  const viewport = useProofViewport();
  const [width, setWidth] = useState(0);
  const available = Math.min(width || window.width - 48, onSolutionShown ? viewport?.innerWidth ?? Infinity : Infinity);
  const solving = !!onSolutionShown,
    read = model.task === 'read',
    litres = model.task === 'litres',
    total = model.task === 'total',
    space = model.task === 'space';
  const proposedLevel = capacityChoiceLevel(model, capacityAttempt?.choice);
  const wrong = solving && !!capacityAttempt;
  const portionTask = model.task === 'servings' || model.task === 'containers';
  const { start, end, capacity, portions, remainder } = jugMeasure(model);
  const lower =
    jugScale(model, capacity)
      .majors.filter((v) => v < end)
      .at(-1) ?? 0;
  const ml = (n: number) => valueToken(t('jugSolution.ml', { value: n }));
  const litre = (n: number) =>
    valueToken(t('jugSolution.litres', { value: String(n / 1000).replace('.', locale === 'en' ? '.' : ',') }));
  const divisions = portionTask ? Math.ceil(end / model.portion) : 0;

  const bands = total
    ? [0, ...model.amounts.map((_, i) => model.amounts.slice(0, i + 1).reduce((a, b) => a + b, 0))]
    : litres
      ? [0, ...Array.from({ length: Math.ceil(end / 1000) }, (_, i) => Math.min(end, (i + 1) * 1000))]
      : read ? [0, lower, end] : space
        ? [0, start, end]
        : [0, end];
  // A free-entry attempt can be far beyond what the screen can physically measure.
  const count = (proposedLevel ?? 0) / model.portion;
  const drawable = portionTask ? Number.isInteger(count) && count <= divisions + 2 : (proposedLevel ?? 0) <= capacity * 2;
  const attemptedLevel = drawable ? proposedLevel : undefined;
  const attemptedCount = attemptedLevel === undefined ? 0 : count;
  const stops = wrong
    ? portionTask ? [0, attemptedCount] : [model.amounts[0], attemptedLevel ?? model.amounts[0]]
    : portionTask ? Array.from({ length: divisions + 1 }, (_, i) => i)
    : read ? [lower, end] : total ? bands.slice(1)
    : space ? [start, end] : bands;
  const tempo = proofTempo({ rounds: stops.length - 1, kind: 'pour' });
  const stationary = wrong && (attemptedLevel === undefined || stops[0] === stops[stops.length - 1]);
  const beatCount = stationary ? 0 : tempo.count;
  const beats = useRevealBeats(solving && width === 0 ? null : solving ? beatCount : 0, {
    ...tempo,
    awaitInitialPaint: solving,
    onDone: onSolutionShown,
    easing: 'inOut',
    step: (i) => (portionTask ? tempo.step(i) : read ? 400 : 520),
  });
  const { landed, reduced, position, settled } = beats;
  const batchSize = tempo.batchSize;
  const value = useDerivedValue(() => {
    const at = reduced ? landed : position.value,
      i = Math.floor(at);
    const from = Math.min(stops.length - 1, i * batchSize);
    const to = Math.min(stops.length - 1, (i + 1) * batchSize);
    return stops[from] + (at - i) * (stops[to] - stops[from]);
  });
  const level = useDerivedValue(() => (wrong ? model.amounts[0] : value.value));
  const height = Math.max(128, Math.min(window.height * (window.fontScale >= 1.5 ? .22 : .26), 224));
  const entryScale = useSharedValue(1);
  const entryReady = width > 0 && !solving;
  useLayoutEffect(() => {
    if (!entryReady || reduced) return;
    let frame = requestAnimationFrame(() => {
      entryScale.value = .90;
      frame = requestAnimationFrame(() => { entryScale.value = withTiming(1, { duration: 360 }); });
    });
    return () => { cancelAnimationFrame(frame); entryScale.value = 1; };
  }, [entryReady, entryScale, reduced]);
  const arrival = useAnimatedStyle(() => ({ transform: [{ scale: entryScale.value }] }));
  const current = stops[tempo.roundsAt(landed)] ?? end;
  let equation = ml(end);
  if (total) equation = model.amounts.map(ml).join(' + ') + ' = ' + ml(end);
  else if (read) equation = lower + ' + ' + (end - lower) + ' = ' + ml(end);
  else if (litres) equation = ml(end) + ' = ' + litre(end);
  else if (space) equation = end + ' − ' + start + ' = ' + ml(end - start);
  else if (model.task === 'containers')
    equation = t('jugSolution.bottleCount', { full: Math.floor(end / model.portion), extra: remainder ? 1 : 0, count: portions });
  else if (portionTask)
    equation = remainder
      ? ml(end) + ' = ' + Math.floor(end / model.portion) + ' × ' + ml(model.portion) + ' + ' + ml(remainder)
      : ml(end) + ' ÷ ' + ml(model.portion) + ' = ' + portions;
  const final = settled || landed === tempo.count;
  const interim = read
    ? ''
    : portionTask ? ''
      : total
        ? landed > 0
          ? ml(current)
          : ml(model.amounts[0])
        : litres ? '' : ml(start);
  const selectedPortions = capacityInput?.selectedIndex == null ? 0 : Number(capacityInput.choices[capacityInput.selectedIndex]);
  const editorPortions = useDerivedValue(() => reduced ? selectedPortions : withTiming(selectedPortions, { duration: 145 }));
  const portionStrip = portionTask && <PortionStrip amount={end} unit={model.portion} available={available}
    unitLabel={ml(model.portion)} count={Math.max(divisions, wrong ? attemptedCount : 0)} progress={solving ? value : editorPortions}
    landed={final && solving && !wrong} vessel={model.portionContainer ?? (model.task === 'containers' ? 'bottle' : 'cup')} input={solving ? undefined : capacityInput} beats={solving ? beats : undefined}
    ready={width > 0} label={solving && !wrong && final ? equation : ml(end)} />;
  useProofAnnouncement(beats, wrong ? capacityAttempt?.choice ?? '' : final ? equation : interim, solving);
  const finalCaption = model.task === 'containers'
    ? <PuzzleText accessible accessibilityLabel={equation} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.bottleEquation}>{equation}</PuzzleText>
    : <ProofCaption text={equation} />;
  const tankSpace = { minHeight: Math.max(0, (viewport?.availableModelHeight ?? 0) - 28), justifyContent: 'center' as const };
  return (
    <View style={styles.stage} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <DiagramSurface beats={beats} playing={solving} replayable={!stationary}>
        <View style={styles.scene}>
          {!solving ? (
            <Animated.View style={[styles.editor, portionTask && tankSpace, arrival]}>{portionTask ? <>{portionStrip}<DenseLabel role="value">{ml(end)}</DenseLabel></> : <StaticVessel
              input={capacityInput}
              model={model}
              capacity={total ? capacity : model.capacities[0]}
              amount={model.amounts[0]}
              available={available}
              height={height}
            />}</Animated.View>
          ) : (
            <>
              <ProofWindow inset={10} focus={portionTask ? current / Math.max(1, divisions) : 1 - current / capacity}>
                {portionTask ? <View style={tankSpace}>{portionStrip}</View> : (
                  <Vessel
                    model={model}
                    available={available}
                    height={height}
                    capacity={capacity}
                    amount={end}
                    beats={beats}
                    attempt={wrong && !drawable ? {} : capacityAttempt}
                    stops={wrong ? [0, model.amounts[0]] : bands}
                    progress={level}
                    retainedAmount={read || litres || total || space ? model.amounts[0] : 0}
                    guide={wrong && attemptedLevel !== undefined ? value : undefined}
                    guideAt={lower}
                  />
                )}
              </ProofWindow>
              {wrong && total && <ProofEquationSlot settled={false}><ProofCaption text={model.amounts.map(ml).join(' + ')} /></ProofEquationSlot>}
              {!wrong && <ProofEquationSlot settled={settled}>
                <View testID="jug-solution-caption" style={styles.caption}>
                  {(window.fontScale >= 2 || portionTask) && !final ? <>
                    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.reserve}>
                      {finalCaption}
                    </View>
                    <View style={styles.currentCaption}><ProofCaption text={interim} /></View>
                  </> : final ? finalCaption : <ProofCaption text={interim} />}
                </View>
              </ProofEquationSlot>}
            </>
          )}
        </View>
      </DiagramSurface>
    </View>
  );
}
const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch' },
  scene: { alignItems: 'center', gap: 8, paddingVertical: 5 },
  chamber: {
    position: 'absolute',
    backgroundColor: water.soft,
    overflow: 'hidden',
    borderRadius: 14,
  },
  handle: { position: 'absolute', width: 32, borderRadius: 12, backgroundColor: water.edge },
  lip: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: water.edge },
  band: { position: 'absolute', left: 0, right: 0 },
  tick: { position: 'absolute', height: 3, borderRadius: 2, backgroundColor: water.edge },
  guide: { position: 'absolute', height: 5, borderRadius: 3, backgroundColor: Quantity.berry.edge },
  editor: { alignItems: 'center', gap: 4 },
  reserve: { opacity: 0 },
  currentCaption: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  bottleEquation: { textAlign: 'center', fontSize: 19, fontWeight: '800', color: Ink.text },
  caption: { alignSelf: 'stretch', alignItems: 'stretch' },
});
