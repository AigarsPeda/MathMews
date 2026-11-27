import { ProofEquationSlot } from './everyday/ProofEquationSlot';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useDerivedValue, useAnimatedStyle, useSharedValue, useReducedMotion, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { PaintedModel } from './everyday/PaintedModel';
import { ProofWindow } from './everyday/ProofWindow';
import { fitScaleLabels } from './everyday/scaleLabels';
import { AdjustableTrace, DiagramSurface } from './everyday/DiagramSurface';
import { PuzzleText } from './PuzzleText';
import { ProofCaption } from './kit/Focus';
import { useRevealBeats } from './kit/useRevealBeats';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import { barAnswer, groupLetter, type BarModel } from '@/utils/puzzle-bars';

// Bar labels are 20 pt bold navy on every axis and group, kept near 20 pt at accessibility sizes too.
const LABEL_PT = 20;
const labelStyle = (fontScale: number) => ({
  color: Ink.text, fontSize: LABEL_PT / Math.max(1, fontScale), fontWeight: '800' as const, fontVariant: ['tabular-nums' as const],
});
function BarLabel({ children, ...props }: { children: ReactNode; onLayout?: TextProps['onLayout'] }) {
  const { fontScale } = useWindowDimensions();
  return <PuzzleText {...props} numberOfLines={1} style={labelStyle(fontScale)}>{children}</PuzzleText>;
}
/** One native probe per label set: ready once every string has a layout. */
function useBarLabels(labels: readonly string[]) {
  const { fontScale, height } = useWindowDimensions();
  const strings = [...new Set(labels)];
  const key = JSON.stringify([fontScale, strings]);
  const [cache, setCache] = useState<{ key: string; sizes: Record<number, { width: number; height: number }> }>({ key: '', sizes: {} });
  const bounds = cache.key === key ? Object.values(cache.sizes) : [];
  const probe = (
    <ScrollView key={key} horizontal scrollEnabled={false} pointerEvents="none" accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', opacity: 0, height }} contentContainerStyle={{ alignItems: 'flex-start' }}>
      {strings.map((label, i) => (
        <BarLabel key={label} onLayout={({ nativeEvent: { layout } }) => {
          const next = { width: Math.ceil(layout.width), height: Math.ceil(layout.height) };
          setCache((previous) => {
            const sizes = previous.key === key ? previous.sizes : {};
            if (sizes[i]?.width === next.width && sizes[i]?.height === next.height) return previous;
            return { key, sizes: { ...sizes, [i]: next } };
          });
        }}>{label}</BarLabel>
      ))}
    </ScrollView>
  );
  return {
    probe, ready: bounds.length === strings.length,
    width: Math.max(0, ...bounds.map((b) => b.width)), height: Math.max(0, ...bounds.map((b) => b.height)),
  };
}

function Column({
  height,
  width,
  progress,
  grow,
  highlighted,
  muted,
  compared,
  entryIndex,
}: {
  height: number;
  width: number;
  progress: SharedValue<number>;
  grow: boolean;
  highlighted: boolean;
  muted: boolean;
  compared: boolean;
  entryIndex?: number;
}) {
  const finish = compared ? Quantity.violet : highlighted ? Quantity.amber : Quantity.teal;
  const reduced = useReducedMotion();
  const entry = useSharedValue(1);
  useEffect(() => {
    if (entryIndex === undefined || reduced) { entry.value = 1; return; }
    entry.value = 0.15;
    entry.value = withDelay(entryIndex * 70, withTiming(1, { duration: 260 }));
  }, [entryIndex, reduced, entry]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: height * (1 - (grow ? progress.value : entry.value)) }] }));
  return (
    <Animated.View style={[styles.clip, { height, width }]}>
      <Animated.View
        style={[
          styles.fill,
          motion,
          {
            borderTopLeftRadius: Shape.barTop(width, height),
            borderTopRightRadius: Shape.barTop(width, height),
            backgroundColor: muted ? finish.light : finish.fill,
            borderColor: finish.edge,
            borderBottomWidth: 3,
          },
        ]}
      />
    </Animated.View>
  );
}

type Transfer = { from: number; to: number; amount: number; sourceBottom: number; targetBottom: number };

function levelTransfers(values: number[], mean: number) {
  const levels = [...values],
    pieces: Transfer[] = [];
  values.forEach((value, from) => {
    if (value <= mean) return;
    values.forEach((_, to) => {
      const amount = Math.min(levels[from] - mean, mean - levels[to]);
      if (amount <= 0) return;
      levels[from] -= amount;
      pieces.push({ from, to, amount, sourceBottom: levels[from], targetBottom: levels[to] });
      levels[to] += amount;
    });
  });
  return pieces;
}

function LevelPiece({
  piece,
  order,
  columns,
  unit,
  position,
}: {
  order: number;
  piece: Transfer;
  columns: number;
  unit: number;
  position: SharedValue<number>;
}) {
  const travel = useAnimatedStyle(() => {
    const phase = Math.max(0, Math.min(1, (position.value - order - 0.2) / 0.8));
    return {
      left: `${((piece.from + 0.12 + phase * (piece.to - piece.from)) / columns) * 100}%`,
      bottom: unit * (piece.sourceBottom + phase * (piece.targetBottom - piece.sourceBottom)),
    };
  });
  return <Animated.View style={[styles.band, { width: `${76 / columns}%`, height: piece.amount * unit }, travel]} />;
}

export type BarControls = { onSelectGroup?: (letter: string) => void; selectedGroup?: string; submitted?: string };
export function BarChart({
  model,
  onSolutionShown,
  onSelectGroup,
  selectedGroup,
  submitted,
}: BarControls & { model: BarModel; onSolutionShown?: () => void }) {
  const viewport = useProofViewport();
  const { height, width, fontScale } = useWindowDimensions();
  const [measuredWidth, setAvailable] = useState(0);
  const available = Math.min(measuredWidth || width - 48, onSolutionShown ? viewport?.innerWidth ?? Infinity : Infinity);
  const { t } = useTranslation();
  const [inspected, setInspected] = useState<number | null>(null);
  const solving = !!onSolutionShown;
  const comparing = solving && (model.task === 'difference' || model.task === 'range');
  const solution = useMemo(() => barAnswer(model), [model]);
  const [low = 0, high = low] = solution.marks;
  const transfers = useMemo(
    () => (model.task === 'mean' ? levelTransfers(model.values, solution.marks[0]) : []),
    [model, solution],
  );
  const gap = comparing ? high - low : 0;
  const mean = model.task === 'mean' && solving;
  const missing = model.task === 'missing';
  const read = model.task === 'read',
    extremum = model.task === 'most' || model.task === 'least';
  const known = model.values.map((_, i) => i).filter((i) => i !== model.index);
  const total = model.values.reduce((sum, value) => sum + value, 0);
  const numericChoice = submitted !== undefined && /^-?\d+(?:[.,]\d+)?$/.test(submitted) ? Number(submitted.replace(',', '.')) : null;
  const selectedBar = model.values.findIndex((_, index) => groupLetter(index) === submitted);
  const expectedHeight = extremum ? low : comparing ? high : Number(solution.answer);
  const attemptHeight = selectedBar >= 0 ? model.values[selectedBar] : numericChoice === null ? null : comparing ? low + numericChoice : numericChoice;
  const stackTotal = solving && model.task === 'total' && attemptHeight !== null;
  // A miss: the child's bar turns amber and a 10 pt+ tinted cap spans the gap to the true level on that same bar.
  const miss = solving && attemptHeight !== null && attemptHeight !== expectedHeight;
  const count = missing
    ? known.length + 2
    : mean
      ? Math.max(1, transfers.length)
      : comparing
        ? 2
        : read || extremum
          ? 2
          : model.values.length;
  const givenTotal = model.total ?? total;
  // The scale never changes on a miss: a total task keeps the entry axis; its child's total is a separate side bar.
  const upper = Math.max(missing ? givenTotal : Math.max(...model.values), stackTotal ? 0 : attemptHeight ?? 0);
  const targetStep = Math.max(1, upper / (5 * model.step));
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const stride = model.step * ([1, 2, 5, 10].map((n) => n * magnitude).find((n) => n >= targetStep) ?? targetStep);
  const ceiling = Math.max(stride, Math.ceil(upper / stride) * stride);
  const max = model.task === 'most' && ceiling === upper ? ceiling + stride : ceiling;
  const ticks = Array.from({ length: max / stride + 1 }, (_, i) => i * stride);
  const axis = useBarLabels(ticks.map(String));
  const amounts = useBarLabels((missing && !solving ? known.map((i) => model.values[i]) : model.values).map(String));
  const letters = useBarLabels(model.values.map((_, i) => groupLetter(i)));
  const measured = measuredWidth > 0 && axis.ready && amounts.ready && letters.ready;
  const beats = useRevealBeats(solving ? count : 0, {
    awaitInitialPaint: solving,
    onDone: onSolutionShown,
    reducedSteps: true,
    minTotal: 0,
    lead: 70,
    step: () => Math.min(850, 2600 / Math.max(1, count)),
    hold: n => n === count ? 160 : 65,
  });
  const { landed, reduced } = beats;
  const clock = beats.position;
  const position = useDerivedValue(() => (reduced ? landed : clock.value));
  const settled = solving && beats.settled;
  const progress = useDerivedValue(() => Math.max(0, Math.min(1, position.value - count + 1)));
  const labelHeight = Math.max(letters.height, 24) + 8;
  // The chart fills the model area. The room Play gives is read at entry and kept through Check and both verdicts
  // (Play keeps the stage on a miss), so the plot never changes size and the chart never reflows.
  const captionReserve = fontScale > 1.3 ? 150 : 16; // XL: two caption lines plus the story line a miss brings back // the proof caption sits under the chart; reserved at entry too
  const [entryRoom, setEntryRoom] = useState(0);
  const roomNow = viewport ? viewport.availableModelHeight : 0;
  if (!solving && roomNow && entryRoom !== roomNow) setEntryRoom(roomNow);
  // The miss dock (verdict, Watch again, Try again, Back to path) is about 32 pt taller than Play's reserved checked dock;
  // reserve it in every state so the chart keeps one size and clears the dock on a miss (wave 13).
  const modelRoom = Math.max(0, ((solving && entryRoom) || roomNow) - 32);
  const margin = fontScale > 1.3 ? 36 : 12;
  const totalChip = missing ? (fontScale > 1.3 ? 56 : 36) : 0; // the amber "Total" chip above the plot
  const tallest = Math.max(...model.values, missing ? Number(solution.answer) : 0);
  // Room above the plot for a value label, only as much as the tallest bar does not already leave (same in every state).
  const headroomFor = (plot: number) => Math.ceil(8 + Math.max(0, amounts.height + 4 - (1 - tallest / max) * plot));
  const fixedHeight = captionReserve + labelHeight + totalChip + margin + 6;
  const roomPlot = modelRoom - fixedHeight - headroomFor(modelRoom - fixedHeight - 8 - amounts.height - 4);
  const naturalHeight = viewport
    ? Math.min(Math.max(fontScale > 1.3 ? 96 : 100, roomPlot), 320)
    : Math.max(Math.min(solving ? (fontScale > 1.3 ? 150 : 176) : 208, height * 0.243), (ticks.length - 1) * (axis.height + 4));
  const plotHeight = Math.max(84, axis.height + 4, 4 * max / model.step, naturalHeight);
  const headroom = headroomFor(plotHeight);
  const chartHeight = plotHeight + labelHeight + headroom + 6;
  const y = (value: number) => (value / max) * plotHeight;
  const meanChipHeight = 28;
  const numberedTicks = fitScaleLabels(ticks, solution.marks, max / plotHeight, axis.height + 4)
    .filter(value => !mean || Math.abs(y(value) - y(low)) >= meanChipHeight / 2 + axis.height / 2);
  const axisWidth = axis.width + 8;
  const plotLeft = axisWidth + 8;
  const plotRight = 8;
  const chartWidth = Math.max(
    available,
    plotLeft + plotRight + model.values.length * Math.max(amounts.width + 12, letters.width + 12, 48),
  );
  const plotWidth = chartWidth - plotLeft - plotRight;
  const title = t(model.subject === 'cats' ? 'everyday.catCount' : 'everyday.toyCount');
  const axes = t('everyday.barAxes', {
    ticks: ticks.join(', '),
    groups: model.values.map((_, i) => groupLetter(i)).join(', '),
  });
  const givens = read ? t('everyday.barStep', { step: model.step }) : model.label;
  const description = settled ? [title, solution.caption].join(', ') : [title, axes, givens].join(' ');
  const lowIndex = model.values.indexOf(low),
    highIndex = model.values.indexOf(high);
  const sequential = model.task === 'total' || missing;
  const sequence = missing ? known : model.values.map((_, i) => i);
  const sequenceIndex = sequence[Math.min(landed, sequence.length - 1)];
  const readIndex = !solving
    ? inspected
    : read
      ? model.index
      : sequential && landed < sequence.length
        ? sequenceIndex
        : null;
  const focusValue = readIndex !== null ? model.values[readIndex]
    : comparing && landed > 0 ? high
    : missing ? model.values[model.index]
    : solution.marks[0] ?? Math.max(...model.values) / 2;
  const horizontalScroll = useRef<ScrollView>(null);
  const focusColumn = readIndex ?? (comparing ? (landed ? highIndex : lowIndex) : solution.columns[0]);
  useEffect(() => {
    if (!solving || !viewport || chartWidth <= available || focusColumn === undefined) return;
    const center = plotLeft + (focusColumn + 0.5) * plotWidth / model.values.length;
    const x = Math.max(0, Math.min(chartWidth - available, center - available / 2));
    horizontalScroll.current?.scrollTo({ x, animated: false });
  }, [solving, viewport, chartWidth, available, focusColumn, plotLeft, plotWidth, model.values.length]);
  const traceRead = useAnimatedStyle(() => {
    const distance = plotLeft - axisWidth + (((readIndex ?? 0) + 0.5) / model.values.length) * plotWidth;
    const width =
      distance * (solving ? Math.min(1, Math.max(0, position.value - (sequential ? landed : read ? 1 : 0))) : 1);
    return { width, left: axisWidth + distance - width };
  });
  const extremeGuide = useAnimatedStyle(() => {
    const fraction = Math.max(0, Math.min(1, position.value / Math.max(1, count)));
    const initial = model.task === 'most' ? plotHeight : 0;
    return { bottom: labelHeight - 7 + initial + ((plotHeight * low) / max - initial) * fraction };
  });
  const captions = Array.from({ length: count + 1 }, (_, n) => (n === count ? solution.caption : ''));
  useProofAnnouncement(beats, landed === count ? solution.caption : '', solving);
  // The highlighted gap grows up from the low bar (no fade, so it is never a see-through blend).
  const gapHeight = Math.max(0, y(gap) - 4);
  const remainder = useAnimatedStyle(() => ({ height: gapHeight * Math.max(0, Math.min(1, position.value - 1)) }));
  return (
    <DiagramSurface beats={beats} playing={solving}>
      <View style={styles.wrap}>
        {/* Never let the window shorter than the capped chart: when Play measures no room (a tall question at accessibility
            sizes) the whole chart still shows and the page scrolls, instead of an inner window hiding it. */}
        <ProofWindow playing={solving} inset={viewport ? Math.min(16, viewport.availableModelHeight - chartHeight) : 16} focus={1 - focusValue / max}>
          <View style={styles.chart} onLayout={(event) => setAvailable(event.nativeEvent.layout.width)}>
            {missing && <View style={styles.totalBand}><BarLabel>{t('decimalModels.total', { value: givenTotal })}</BarLabel></View>}
            {axis.probe}
            {amounts.probe}
            {letters.probe}
            <ScrollView ref={horizontalScroll} horizontal scrollEnabled={chartWidth > available} contentContainerStyle={{ width: chartWidth }}>
              <View style={{ width: chartWidth }}>
                <PaintedModel
                  beats={solving ? beats : undefined}
                  ready={measured}
                  nativeID={solving ? 'play-proof-model' : 'play-entry-model'}
                  testID={solving ? 'play-proof-model' : 'play-entry-model'}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={description}
                >
                  <View style={{ height: chartHeight - 6, marginTop: 6, marginBottom: 0 }}>
                    {numberedTicks.map(value => <View key={value} testID={'bar-tick-major-' + value}
                      style={[styles.axisLabel, { width: axis.width, bottom: labelHeight + y(value) - axis.height / 2 }]}>
                      <BarLabel>{value}</BarLabel>
                    </View>)}
                    <View style={[styles.bars, { left: plotLeft, right: plotRight }]}>
                      {model.values.map((given, i) => {
                        const value = missing && i === model.index ? Number(solution.answer) : given;
                        const focused = solving
                          ? mean || comparing
                            ? solution.columns.includes(i)
                            : extremum
                              ? landed === count && !miss && solution.columns.includes(i)
                              : read
                                ? i === model.index
                                : missing
                                  ? i === (known[landed] ?? model.index)
                                  : i === landed - 1 && !(miss && model.task === 'total')
                          : extremum
                            ? selectedGroup === groupLetter(i)
                            : inspected === i;
                        const labeled = solving
                          ? !settled && landed > 0 && ((missing && i === known[landed - 1]) || (model.task === 'total' && i === landed - 1))
                          : inspected === i;
                        const height = y(mean ? Math.min(value, low) : missing && i === model.index && numericChoice !== null ? Math.max(0, numericChoice) : value);
                        return (
                          <View key={i} style={styles.column}>
                            {labeled && (
                              <View style={styles.valuePaper}>
                                <BarLabel>{value}</BarLabel>
                              </View>
                            )}
                            {missing && i === model.index && (!solving || landed < known.length) ? (
                              <View style={[styles.unknownSlot, { width: (plotWidth * 0.76) / model.values.length, height: Math.max(56, plotHeight * 0.45) }]}>
                                <PuzzleText style={styles.unknownMark}>?</PuzzleText>
                              </View>
                            ) : (
                              <Column
                                height={mean && landed === count ? y(low) : height}
                                width={(plotWidth * 0.76) / model.values.length}
                                progress={progress}
                                grow={solving && missing && i === model.index}
                                highlighted={(miss && extremum && selectedBar === i) || (read ? i === model.index : focused && !mean && !comparing)}
                                compared={comparing && i === lowIndex}
                                entryIndex={solving ? undefined : i}
                                muted={(comparing || (extremum && settled)) && !solution.columns.includes(i) && i !== selectedBar}
                              />
                            )}
                            {comparing && i === highIndex && gap > 0 && (
                              <Animated.View
                                style={[styles.band, { bottom: labelHeight + y(low) + 4 }, remainder]}
                              />
                            )}
                            <View style={[styles.letter, { height: labelHeight }]}>
                              <BarLabel>{groupLetter(i)}</BarLabel>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                    {miss && attemptHeight !== null && landed > 0 && (() => {
                      // ONE amber difference on the same bars. A total's cap sits on the last bar added; it never adds a bar or a chip.
                      const totalTask = model.task === 'total';
                      const column = totalTask ? model.values.length - 1 : extremum ? selectedBar : read || missing ? model.index : comparing ? highIndex : 0;
                      const slot = plotWidth / model.values.length;
                      // A short total marks the top of the last bar as the uncounted part; an over-count caps above it.
                      const shortBy = expectedHeight - attemptHeight;
                      const base = totalTask
                        ? (shortBy > 0 && shortBy <= model.values[column] ? model.values[column] - shortBy : model.values[column])
                        : Math.max(0, Math.min(expectedHeight, attemptHeight));
                      const room = y(Math.max(0, max - base)) + headroom - 4;
                      return <View pointerEvents="none" style={[styles.attemptGap, totalTask && { backgroundColor: Quantity.amber.fill }, {
                        left: plotLeft + column * slot + slot * 0.12, width: slot * 0.76,
                        bottom: labelHeight + y(base),
                        height: Math.min(Math.max(16, y(Math.abs(expectedHeight - attemptHeight))), totalTask ? Math.max(16, room) : Infinity),
                      }]}><View style={styles.gapSeam} /></View>;
                    })()}
                    {mean && (
                      <>
                        <View pointerEvents="none" style={[styles.meanBand, { left: plotLeft, right: plotRight, bottom: labelHeight + y(low) - 7 }]} />
                        <View pointerEvents="none" testID="bar-mean-chip" style={[styles.meanChip, { width: axis.width + 8, bottom: labelHeight + y(low) - meanChipHeight / 2 }]}>
                          <BarLabel>{String(low)}</BarLabel>
                        </View>
                      </>
                    )}
                    {mean && landed < count && (
                      <View
                        pointerEvents="none"
                        style={[styles.reference, { left: plotLeft, right: plotRight, bottom: labelHeight }]}
                      >
                        {transfers.map((piece, index) => (
                          <LevelPiece
                            key={index}
                            order={index}
                            piece={piece}
                            columns={model.values.length}
                            unit={y(1)}
                            position={position}
                          />
                        ))}
                      </View>
                    )}
                    {extremum && solving && landed < count && (
                      <Animated.View style={[styles.guide, { left: plotLeft, right: plotRight }, extremeGuide]} />
                    )}
                    {!solving && readIndex !== null && (
                      <Animated.View
                        style={[
                          styles.trace,
                          { left: axisWidth, bottom: y(model.values[readIndex]) + labelHeight },
                          traceRead,
                        ]}
                      />
                    )}
                  </View>
                </PaintedModel>
                {!solving && (
                  <View
                    pointerEvents="box-none"
                    style={[
                      styles.hitRow,
                      { left: plotLeft, right: plotRight, bottom: 0, height: plotHeight + labelHeight },
                    ]}
                  >
                    {model.values.map((value, i) => {
                      const letter = groupLetter(i);
                      const select = extremum && !!onSelectGroup;
                      if ((i === model.index && (read || missing)) || (extremum && !select))
                        return <View key={i} style={styles.hit} />;
                      const label = t(select ? 'everyday.selectGroup' : 'everyday.inspectGroup', { group: letter });
                      return (
                        <Pressable
                          key={i}
                          style={styles.hit}
                          accessibilityRole="button"
                          accessibilityLabel={label}
                          accessibilityState={{ selected: select ? selectedGroup === letter : inspected === i }}
                          accessibilityValue={!select && inspected === i ? { text: String(value) } : undefined}
                          onPress={() => (select ? onSelectGroup?.(letter) : setInspected(i))}
                        />
                      );
                    })}
                  </View>
                )}
                {read && !solving && (
                  <AdjustableTrace
                    key={model.index + ':' + model.values.join(',')}
                    marks={Array.from({ length: 1 + Math.round(max / model.step) }, (_, i) => i * model.step)}
                    majors={ticks}
                    target={model.values[model.index]}
                    name={t('everyday.traceBar', { group: groupLetter(model.index) })}
                    contact={t('everyday.barTop')}
                    height={plotHeight}
                    width={plotWidth / model.values.length}
                    label={String} bare
                    style={{ left: plotLeft + (model.index * plotWidth) / model.values.length, bottom: labelHeight - 8 }}
                  />
                )}
              </View>
            </ScrollView>
          </View>
        </ProofWindow>
        {solving && (
          <ProofEquationSlot settled={settled}>
            <View testID="bar-solution-caption" style={{ alignSelf: 'stretch' }}>
              <ProofCaption
                text={settled ? solution.caption : captions[landed]}
                reserveTexts={[...captions, solution.caption]}
              />
            </View>
          </ProofEquationSlot>
        )}
      </View>
    </DiagramSurface>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8 },
  chart: { alignSelf: 'center', width: '100%', maxWidth: 360 },
  totalBand: { alignSelf: 'center', borderRadius: 8, paddingHorizontal: 12, backgroundColor: Quantity.amber.light },
  attemptGap: { position: 'absolute', borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, overflow: 'hidden', backgroundColor: Quantity.amber.light },
  gapSeam: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: '#FFFFFF' },
  trace: { position: 'absolute', height: 14, borderRadius: 7, backgroundColor: Quantity.amber.light },
  hitRow: { position: 'absolute', flexDirection: 'row' },
  hit: { flex: 1, minHeight: 44 },
  axisLabel: { position: 'absolute', left: 0, alignItems: 'flex-end' },
  valuePaper: { paddingHorizontal: 3 },
  bars: { position: 'absolute', right: 24, bottom: 0, flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  clip: { width: '76%', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  unknownSlot: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: Quantity.amber.light, borderBottomWidth: 3, borderBottomColor: Quantity.amber.fill },
  unknownMark: { fontSize: 30, fontWeight: '800', color: Ink.text },
  band: {
    position: 'absolute',
    width: '76%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: Quantity.amber.fill,
  },
  letter: { paddingTop: 4, alignItems: 'center' },
  meanBand: { position: 'absolute', height: 14, borderRadius: 7, backgroundColor: Quantity.violet.fill },
  meanChip: { position: 'absolute', left: 0, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Quantity.violet.fill },
  reference: { position: 'absolute', right: 24, height: 10 },
  guide: { position: 'absolute', height: 14, borderRadius: 7, backgroundColor: Quantity.violet.fill },
});
