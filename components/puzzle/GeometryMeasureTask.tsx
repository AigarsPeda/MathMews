import { useKeepModelOrigin } from './kit/ModelStage';
import { ProofWindow, usePlaybackViewport } from './counting/ProofWindow';
import { makeImageFromView } from '@shopify/react-native-skia';
import { ProofGeometry } from './kit/ProofFeedback';
import { modelInk, verifySnapshot } from './counting/useModelPaint';
import { CompactKeypad } from './CompactKeypad';
import { useQuantityPractice } from './counting/QuantityPractice';
import { CoverGrid } from './counting/CoverGrid';
import { GeometryMeasureReveal, MeasureInk } from '@/components/puzzle/GeometryMeasureReveal';
import { ResultMark, UnknownWell } from './kit/PuzzleKit';
import { countabilityFloor, DenseLabel, useMeasuredLabels } from './kit/DenseLayout';
import { RoundedTile, UnitRun } from './kit/FriendlyShapes';
import { PressFace } from './kit/PressFace';
import type { SharedValue } from 'react-native-reanimated';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors, Shape, Quantity } from '@/constants/puzzle-theme';
import type { GeometryMeasurePuzzle } from '@/types/puzzle';
import { appendGeometryDigit, geometryMeasurement } from '@/utils/geometry-models';
import { Fragment, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { TapeBars, tapeLaneHeight, type TapePiece, type TapeSpec } from './PerimeterTape';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

type Props = { puzzle: GeometryMeasurePuzzle; value: number | null; onChange: (value: number | null) => void; answered: boolean; readOnly?: boolean; playbackOwnsControls?: boolean; explore?: boolean; onSolutionShown?: () => void; checkedModel?: ReactNode; checkedResult?: 'correct' | 'wrong'; AnswerRow?: ComponentType<{ children: ReactNode }> };
export function GeometryMeasureTask({ puzzle, value, onChange, answered, readOnly = false, playbackOwnsControls = false, explore = false, onSolutionShown, checkedModel, checkedResult, AnswerRow = Fragment }: Props) {
  const { t } = useTranslation();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const viewport = usePlaybackViewport();
  const available = measuredWidth || viewport?.innerWidth || 280;
  const hasCheckedModel = checkedModel != null;
  const showControls = !readOnly && !playbackOwnsControls;
  const locked = answered || hasCheckedModel || !!checkedResult;
  const practice = useQuantityPractice();
  const [covered, updateCovered] = useState(() => practice.snapshot?.coveredSquares ?? new Set<number>());
  const [marked, updateMarked] = useState(() => practice.snapshot?.tracedEdges ?? 0);
  function setCovered(cells: Set<number>) {
    practice.saveCoveredSquares?.(cells);
    updateCovered(cells);
  }
  function setMarked(count: number) {
    practice.saveTracedEdges?.(count);
    updateMarked(count);
  }
  const { mode, width, height, other, guided } = puzzle.payload;
  const { height: screen, fontScale } = useWindowDimensions();
  const largeType = fontScale >= 2;
  useKeepModelOrigin(largeType && mode === 'missing_perimeter');
  const choices = mode === 'compare' ? ['A', 'B', largeType ? '=' : t('geometryModels.equal')] : [];
  const choiceLabels = useMeasuredLabels(choices, 'value');
  const stackChoices = (choiceLabels.width + 24 + 18 + 4) * 3 + 16 > available;
  const missing = mode === 'missing_area' || mode === 'missing_perimeter';
  const measure = mode === 'area' || mode === 'missing_area' ? 'area' : 'perimeter';
  const dimension = (n: number) => n === 1 ? t('geometryModels.oneUnit') : t('geometryModels.manyUnits', { value: n });
  const longestSide = Math.max(dimension(height).length, other ? dimension(other.height).length : 0);
  const fullSideWidth = Math.max(55, Math.ceil(longestSide * 10 * fontScale + 4));
  const floor = countabilityFloor('cell', fontScale > 1.3, true) + Shape.space.seam;
  const pairUnits = other ? width + other.width : 0;
  const largestWidth = Math.max(width, other?.width ?? 0);
  const compactDimensions = available < (other ? pairUnits : width) * floor + (other ? 3 : 2) * (fullSideWidth + 10);
  const sideWidth = compactDimensions ? Math.ceil(String(Math.max(height, other?.height ?? 0)).length * 12 * fontScale + 5) : fullSideWidth;
  const sideSpace = sideWidth + 10;
  // A's side label sits to its left, B's to its right, so only B's wider top label needs a gap between them.
  const pairGap = 40;
  const stacked = !!other && pairUnits * floor + 2 * sideSpace + pairGap > available;
  const hasSideRoom = largestWidth * floor + 2 * sideSpace <= available;
  const horizontal = other && !stacked ? (available - 2 * sideSpace - pairGap) / pairUnits
    : (available - (hasSideRoom ? 2 * sideSpace : 0)) / largestWidth;
  const maxRows = Math.max(height, other?.height ?? 0);
  const proofHeight = viewport ? Math.max(1, viewport.availableModelHeight - 8) : undefined;
  const figureCount = stacked ? 2 : 1;
  const editableArea = !viewport && !playbackOwnsControls && measure === 'area' && !onSolutionShown && !checkedResult && (explore || !locked && !readOnly);
  const traceEdges = showControls && !onSolutionShown && guided && mode === 'perimeter';
  // Choose one scale for the editor, the checked drawing and the retry.
  const perimeterTape = measure === 'perimeter';
  const laneRows = mode === 'compare' ? 2 : 1;
  const laneHeight = perimeterTape ? tapeLaneHeight(laneRows) : 0;
  const widthInside = largeType && mode === 'missing_perimeter';
  const figureBudget = (widthInside ? Math.min(78, screen * .09) : Math.min(missing ? 185 : 220, screen * .26)) - laneHeight * (largeType ? 1 : .5);
  const cellFloor = mode === 'area' ? 44 : measure === 'perimeter' ? (mode === 'compare' && !largeType ? 28 : 24) : floor;
  const unit = Math.max(cellFloor, Math.min(88, figureBudget / (maxRows * figureCount), horizontal));
  const tallFigure = maxRows * unit * figureCount + (stacked ? 64 * fontScale : 0) > screen * .36;
  const firstShape = useRef<View>(null), secondShape = useRef<View>(null), stageRef = useRef<View>(null);
  // Where each shape and the tape lane sit inside the stage, so the sides can lift off and slide into the tape.
  const [rects, setRects] = useState<{ A?: { x: number; y: number }; B?: { x: number; y: number }; laneY: number | null }>({ laneY: null });
  const remeasure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    for (const [key, node] of [['A', firstShape.current], ['B', secondShape.current]] as const) {
      node?.measureLayout(stage, (x, y) => setRects(r => r[key]?.x === x && r[key]?.y === y ? r : { ...r, [key]: { x, y } }), () => {});
    }
  }, []);
  const fullTape = useSharedValue(1e6), tracedTape = useSharedValue(0);
  useEffect(() => { tracedTape.value = withTiming(marked, { duration: 220 }); }, [marked, tracedTape]);
  const confirmFigures = async () => {
    const figures = [{ ref: firstShape, w: width, h: height }, ...(other ? [{ ref: secondShape, w: other.width, h: other.height }] : [])];
    for (const { ref, w, h } of figures) {
      if (!ref.current || !await verifySnapshot(makeImageFromView(ref), image => {
        const wide = w * unit, high = h * unit, ink = modelInk(image, wide, high);
        if (measure !== 'area') {
          const face = ref === secondShape ? Quantity.violet.light : Quantity.teal.light;
          // The width label sits in the middle at XL, so sample beside it.
          return ink(widthInside ? wide * .12 : wide / 2, high / 2, parseInt(face.slice(1), 16));
        }
        const face = parseInt(Shape.empty.slice(1), 16);
        const seam = parseInt(Shape.seamColor.slice(1), 16);
        const filledFace = parseInt(Quantity.teal.fill.slice(1), 16);
        if (mode === 'missing_area') {
          const fullRows = Math.floor(covered.size / w);
          for (let row = 0; row < h; row++) {
            if (!ink(unit / 2, high - (row + .5) * unit, row < fullRows ? filledFace : face)) return false;
          }
          return true;
        }
        for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
          const x = (col + .5) * unit, y = (row + .5) * unit;
          if (!ink(x, y, covered.has(row * w + col) ? filledFace : face) || (row > 0 && !ink(x, row * unit, seam))) return false;
        }
        return true;
      })) return false;
    }
    return true;
  };
  const picture = (w: number, h: number, name: string, progress?: SharedValue<number>, done = false, phase = 0) => {
    const hideUnits = missing;
    const paint = editableArea && !missing;
    const fillRows = editableArea && missing;
    const areaMiss = mode === 'area' && checkedResult === 'wrong';
    const rowMiss = mode === 'missing_area' && checkedResult === 'wrong';
    const claimed = Math.max(0, value ?? covered.size);
    // Start the submitted count on the exact squares the child painted.
    const claimedCells = new Set<number>();
    if (areaMiss) {
      for (const id of covered) {
        if (claimedCells.size >= claimed) break;
        claimedCells.add(id);
      }
      for (let id = 0; id < w * h && claimedCells.size < claimed; id++) claimedCells.add(id);
    }
    const coveredRows = Math.floor(covered.size / w);
    const columns = w, rows = h, size = unit;
    // Always drawn to true proportions (council decision): a missing side hides its unit divisions, never its length.
    const box = { width: columns * size, height: rows * size };
    const hitX = Math.max(0, (44 - box.width) / 2);
    const hitY = Math.max(0, (44 - box.height) / 2);
    const drawingWidth = paint ? Math.min(available, box.width) : box.width;
    const sideBelow = (!other || stacked) && drawingWidth + 2 * sideSpace > available;
    const gap = Shape.space.seam;
    const Figure = progress && !perimeterTape ? ProofGeometry : View;
    // Labels can be wider than a one-unit rectangle. Only the rectangles set the pair's width.
    const paired = !!other && !stacked;
    const topLabelWidth = paired ? Math.max(drawingWidth, compactDimensions ? 150 : 124) : undefined;
    const sideLeft = paired && name === 'A';
    const editableFigure = mode === 'compare' && showControls && !locked;
    const selectedFigure = mode === 'compare' && (editableFigure || checkedResult === 'wrong') &&
      (value === 2 || name === ['A', 'B'][value ?? -1]);
    const figureColor = name === 'B' ? Quantity.violet : Quantity.teal;
    const initialRows = mode === 'missing_area' && Array.from({ length: Math.min(h, coveredRows + 1) }, (_, row) =>
      <View key={row} style={{height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: Shape.seamColor}}>
        <UnitRun width={box.width - gap} height={size - gap} count={w} filled={row === 0 && coveredRows < h ? 0 : w} />
      </View>);
    return <Figure style={[styles.figure, paired && {width: drawingWidth}]}>
      {!widthInside && <Text style={[styles.dimension, {width: topLabelWidth}]}>{name ? `${name} · ` : null}{compactDimensions ? w : dimension(w)}</Text>}
      <View style={{width: drawingWidth, alignItems: 'center', marginBottom: sideBelow ? 26 * fontScale : 0}}>
        {paint ? <CoverGrid columns={w} rows={h} unit={size} covered={covered} onChange={setCovered} available={available} /> :
        <View ref={name === 'B' ? secondShape : firstShape} collapsable={false} onLayout={perimeterTape ? remeasure : undefined} testID={`geometry-shape-${name || 'main'}`} accessible={!fillRows && !editableFigure} accessibilityLabel={missing && !done ? t('geometryModels.unknownShape', { width: w }) : t('geometryModels.shape', { name, width: w, height: h })} style={{ ...box, backgroundColor: Shape.seamColor }}>
          {perimeterTape && <View style={{...box, backgroundColor: selectedFigure ? figureColor.fill : figureColor.light, borderRadius: 10}} />}
          {!perimeterTape && !rowMiss && hideUnits && <RoundedTile {...box} fill={Shape.empty} edge={Shape.emptyLip} />}
          {editableFigure && <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
            accessibilityLabel={t('geometryModels.shape', { name, width: w, height: h })}
            accessibilityState={{selected: selectedFigure}} hitSlop={{left: hitX, right: hitX, top: hitY, bottom: hitY}}
            onPress={() => onChange(name === 'A' ? 0 : 1)} />}
          {rowMiss && <View style={StyleSheet.absoluteFill}>
            {Array.from({ length: h + (claimed > h ? 1 : 0) }, (_, row) => {
              const displayRows = h + (claimed > h ? 1 : 0);
              const rowHeight = box.height / displayRows;
              // A rejected true height disputes the final row without supplying a replacement count.
              const matched = value === null || claimed === h ? h - 1 : Math.min(h, claimed);
              return <View key={row} style={{height: rowHeight, alignItems: 'center', justifyContent: 'center'}}>
                <View style={{ flexDirection: 'row', gap }}>
                  {Array.from({ length: w }, (_, col) => <View key={col} style={{ width: size - gap, height: rowHeight - gap,
                    borderRadius: 4, backgroundColor: displayRows - row <= matched ? Quantity.teal.fill : Quantity.amber.fill }} />)}
                </View>
              </View>;
            })}
          </View>}
          {mode === 'missing_area' && !rowMiss && !fillRows && <View style={[StyleSheet.absoluteFill, {justifyContent: 'flex-end'}]}>{initialRows}</View>}
          {fillRows && <Pressable testID="geometry-cover-row" accessibilityRole="button"
            accessibilityLabel={t('friendlyQ.coverRow')} accessibilityHint={t('geometryModels.unknownShape', { width: w })}
            accessibilityValue={{ text: t('geometryModels.squaresMarked', { count: covered.size }) }}
            disabled={coveredRows >= h} accessibilityState={{ disabled: coveredRows >= h }}
            onPress={() => setCovered(new Set(Array.from({ length: Math.min(w * h, covered.size + w) }, (_, i) => i)))}
            hitSlop={{ left: hitX, right: hitX, top: hitY, bottom: hitY }}
            style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
            {initialRows}
          </Pressable>}
          {!hideUnits && measure === 'area' && Array.from({ length: rows }, (_, row) => <View key={row} style={{height: size, alignItems: 'center', justifyContent: 'center'}}>
            <UnitRun width={box.width - gap} height={size - gap} count={columns} filled={areaMiss ? columns : 0}
              hue={col => claimedCells.has(row * columns + col) ? 'amber' : 'teal'} />
            {!areaMiss && covered.size > 0 && Array.from({length: columns}, (_, col) => covered.has(row * columns + col) &&
              <View key={col} style={{position: 'absolute', left: col * size + gap / 2, top: gap / 2}}><UnitRun width={size - gap} height={size - gap} count={1} /></View>)}
          </View>)}
          {areaMiss && claimed > w * h && <View style={styles.extraCells}>
            <Text style={styles.dimension}>+{claimed - w * h}</Text>
          </View>}
          {progress && measure === 'area' && <MeasureInk width={w} height={h} unit={size} progress={progress} completedRows={phase} missing={missing} />}
        </View>}
        {widthInside && <View pointerEvents="none" style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center'}]}>
          <Text style={styles.dimension}>{w}</Text>
        </View>}
        <View pointerEvents="none" style={[styles.sideLane, sideBelow ? {top: '100%', alignSelf: 'center'} : sideLeft ? {right: drawingWidth + 8, width: sideWidth, top: 0, bottom: 0, alignItems: 'flex-end'} : {left: drawingWidth + 8, width: sideWidth, top: 0, bottom: 0, alignItems: 'flex-start'}]}>
          <Text style={styles.side} accessibilityHint={compactDimensions && (!missing || done) ? dimension(h) : undefined}>{missing && !done ? (checkedResult === 'wrong' && value !== null ? value : '?') : compactDimensions ? h : dimension(h)}</Text>
        </View>
      </View>
    </Figure>;
  };
  // One tape per shape. A miss is the finished tape with ONE amber segment for the child's difference.
  const tapePieces = (w: number, h: number, name: string, done: boolean, miss: boolean): TapePiece[] => {
    const sides = [w, h, w, h];
    const hue: TapePiece['hue'] = name === 'B' ? 'violet' : 'teal';
    const amber = (units: number, label: string): TapePiece => ({ units, label, hue: 'amber' });
    const plain: TapePiece[] = sides.map((units, side) => ({ units, side, label: String(units), hue }));
    const cutAt = (pieces: TapePiece[], at: number) => {
      const out: TapePiece[] = [];
      let used = 0;
      for (const piece of pieces) {
        if (used >= at) break;
        const keep = Math.min(piece.units, at - used);
        out.push(keep === piece.units ? piece : { ...piece, units: keep, label: String(keep), side: undefined });
        used += keep;
      }
      return out;
    };
    if (mode === 'missing_perimeter') {
      const pieces = plain.map((piece, i): TapePiece => i % 2 === 1 ? { ...piece, label: done ? piece.label : '?', hue: done ? 'teal' : 'violet' } : piece);
      if (!miss || value === null || value === h) return pieces;
      const gap = Math.abs(value - h);
      const shown = Math.min(gap, Math.max(1, h));
      if (value > h) return [pieces[0], pieces[1], amber(shown, `+${gap}`), pieces[2], pieces[3]];
      return [pieces[0], { units: Math.max(0, value), label: '?', hue: 'violet' } as TapePiece, amber(shown, `−${gap}`), pieces[2], pieces[3]].filter(piece => piece.units > 0);
    }
    if (!miss) return plain;
    if (mode === 'perimeter' && value !== null && value !== 2 * (w + h)) {
      const truth = 2 * (w + h), gap = Math.abs(value - truth), shown = Math.min(gap, truth);
      return value > truth ? [...plain, amber(shown, `+${gap}`)]
        : [...cutAt(plain, Math.max(0, value)), amber(shown, `−${gap}`)];
    }
    if (mode === 'compare' && other) {
      const mine = 2 * (w + h), theirs = name === 'B' ? 2 * (width + height) : 2 * (other.width + other.height);
      if (mine > theirs) return [...cutAt(plain, theirs), amber(mine - theirs, `+${mine - theirs}`)];
    }
    return plain;
  };
  const figures = (progress?: SharedValue<number>, done = false, otherProgress = progress, phase = 0) => {
    const row = mode === 'compare' && other
      ? <View style={[styles.comparison, stacked ? styles.stacked : {gap: pairGap}]}>{picture(width, height, 'A', progress, done)}{picture(other.width, other.height, 'B', otherProgress, done)}</View>
      : picture(width, height, '', progress, done, phase);
    if (!perimeterTape) return row;
    const miss = checkedResult === 'wrong' && !progress;
    const source = (own?: SharedValue<number>) => own ?? (miss ? fullTape : tracedTape);
    const specs: TapeSpec[] = [
      { key: 'A', rect: rects.A, box: { width: width * unit, height: height * unit }, sides: [width, height, width, height], pieces: tapePieces(width, height, mode === 'compare' ? 'A' : '', done, miss), distance: source(progress), fold: mode === 'missing_perimeter' ? otherProgress : undefined },
      ...(mode === 'compare' && other ? [{ key: 'B', rect: rects.B, box: { width: other.width * unit, height: other.height * unit }, sides: [other.width, other.height, other.width, other.height] as [number, number, number, number], pieces: tapePieces(other.width, other.height, 'B', done, miss), distance: source(otherProgress) }] : []),
    ];
    return <View ref={stageRef} collapsable={false} onLayout={remeasure}>
      {row}
      <View style={{ height: laneHeight }} onLayout={e => { const laneY = e.nativeEvent.layout.y; setRects(r => r.laneY === laneY ? r : { ...r, laneY }); }} />
      <TapeBars tapes={specs} unit={unit} available={available} laneY={rects.laneY} />
    </View>;
  };
  const compareMiss = mode === 'compare' && checkedResult === 'wrong' && !onSolutionShown;
  const resultStyle = checkedResult === 'correct' ? styles.correct : checkedResult === 'wrong' ? styles.wrong : undefined;
  const resultLabel = checkedResult ? t(checkedResult === 'correct' ? 'mood.correct' : 'mood.incorrect') : undefined;
  const button = (id: string, label: string, action: () => void, disabled = false, selected = false) => {
    const choice = id.startsWith('geometry-choice-');
    const markedResult = selected && checkedResult;
    return <Pressable key={id} testID={id} accessibilityRole="button" accessibilityLabel={markedResult ? `${label}. ${resultLabel}` : label}
      accessibilityHint={label === '=' ? t('geometryModels.equal') : undefined}
      accessibilityValue={id === 'geometry-mark' ? { text: t('geometryModels.edgesMarked', { count: marked }) } : undefined}
      accessibilityState={{ disabled: locked || disabled, selected }} disabled={locked || disabled} onPress={action}
      style={[styles.button, choice && (stackChoices ? styles.fullChoice : styles.choice), (disabled || locked && !choice) && styles.disabled]}>
      {({ pressed }) => <><PressFace pressed={pressed} radius={12} borderWidth={0}
        fill={markedResult ? resultStyle?.backgroundColor ?? Shape.empty : selected ? Colors.selectedSurface : Shape.empty}
        edge={markedResult ? resultStyle?.borderColor ?? Shape.emptyLip : selected ? Colors.primary : Shape.emptyLip} />
      {choice ? <DenseLabel role="value">{label}</DenseLabel> : <Text style={styles.buttonText}>{label}</Text>}
      {markedResult && <ResultMark kind={markedResult} />}</>}
    </Pressable>;
  };
  const canResetModel = (editableArea && covered.size > 0) || (traceEdges && !locked && marked > 0);
  const compactAnswer = mode !== 'compare' && fontScale >= 2 && AnswerRow !== Fragment;
  const answerLabel = mode === 'compare' ? '' : t(missing ? 'geometryModels.sideAnswer' : `geometryModels.${mode}Answer`);
  const modelID = onSolutionShown ? undefined : viewport || playbackOwnsControls ? 'play-proof-model' : 'play-entry-model';
  return <View style={styles.wrap} onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)}>
    {showControls && choices.length > 0 && choiceLabels.probe}
    {checkedModel ?? <>
    <View nativeID={modelID} testID={modelID} collapsable={false} style={styles.wrap}>
    {missing && <View style={[styles.givenBand, { minWidth: width * unit }]}>
      <Text style={styles.given}>{t(`geometryModels.given_${measure}${largeType ? '_short' : ''}`, {
        value: measure === 'area' ? width * height : 2 * (width + height),
      })}</Text>
    </View>}
    {onSolutionShown ? <GeometryMeasureReveal confirmPaint={confirmFigures} measured={measuredWidth > 0} viewportHeight={tallFigure && proofHeight != null ? Math.max(1, proofHeight - (missing ? 60 : 32) * fontScale) : undefined} stacked={stacked} puzzle={puzzle} marked={marked} onSolutionShown={onSolutionShown}>
      {figures}
    </GeometryMeasureReveal> : viewport && tallFigure ? <ProofWindow height={proofHeight} focus={0}>{figures()}</ProofWindow> : figures()}
    {compareMiss && <Text style={styles.dimension}>{geometryMeasurement(puzzle).equation}</Text>}
    </View>
    {(traceEdges || canResetModel) && <View style={styles.support}>
      {traceEdges && button('geometry-mark', t('geometryModels.traceEdge'), () => setMarked(marked + 1), marked >= 2 * (width + height))}
      {canResetModel && <Pressable testID="geometry-reset" accessibilityRole="button"
        onPress={() => { setCovered(new Set()); setMarked(0); }} style={styles.reset}>
        <Text style={styles.resetText}>{t('geometryModels.reset')}</Text>
      </Pressable>}
    </View>}
    </>}
    {showControls && (!onSolutionShown || hasCheckedModel) ? <>
      <AnswerRow>
        {mode === 'compare' ? <View style={styles.choices}>
          {measuredWidth > 0 && choiceLabels.ready && choices.map((label, i) => (!hasCheckedModel || value === i) && button(`geometry-choice-${i}`, label, () => onChange(i), false, value === i))}
        </View> : <View style={styles.answerRow}>
          {!compactAnswer && <Text style={styles.label}>{answerLabel}</Text>}
          <View testID="geometry-answer" accessible accessibilityLiveRegion="polite" accessibilityState={{ disabled: locked }}
            accessibilityLabel={[compactAnswer ? answerLabel : null, value ?? '?', resultLabel].filter(part => part != null).join('. ')} style={styles.answerValue}>
            <UnknownWell size="sm" active={!locked} filled={value !== null} label={String(value ?? '?')} style={resultStyle} />
            {checkedResult && <ResultMark kind={checkedResult} />}
          </View>
        </View>}
        {mode !== 'compare' && !hasCheckedModel && <CompactKeypad disabled={locked} canErase={value !== null}
          digitID={digit => `geometry-digit-${digit}`} eraseID="geometry-erase"
          isDigitDisabled={digit => value !== null && value * 10 + digit > 999}
          onDigit={digit => onChange(appendGeometryDigit(value, digit))}
          onErase={() => onChange(value !== null && value >= 10 ? Math.floor(value / 10) : null)} />}
      </AnswerRow>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: 6 }, answerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12 },
  comparison: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 16 },
  extraCells: { position: 'absolute', alignSelf: 'center', bottom: 6, borderRadius: 10, paddingHorizontal: 8, backgroundColor: Quantity.amber.light },
  figure: { alignItems: 'center', gap: 4 }, label: { fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  dimension: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  stacked: { flexDirection: 'column', alignItems: 'center' },
  side: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: Colors.text },
  gapChip: { position: 'absolute', top: '50%', marginTop: 16, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: Quantity.amber.light },
  sideLane: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  given: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  givenBand: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Quantity.teal.soft },
  support: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  button: { minWidth: 48, maxWidth: '100%', minHeight: 48, padding: 10, justifyContent: 'center', alignItems: 'center' },
  correct: { borderColor: Colors.success, backgroundColor: Colors.successSurface }, wrong: { borderColor: Colors.incorrect, backgroundColor: Colors.incorrectSurface },
  answerValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fullChoice: { width: '100%', flexDirection: 'row', gap: 4 }, choice: { flexGrow: 1, flexBasis: 48, flexDirection: 'row', gap: 4 },
  buttonText: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  answer: { fontSize: 28, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  disabled: { opacity: 0.4 }, reset: { minHeight: 44, justifyContent: 'center', alignItems: 'center' }, resetText: { fontSize: 16, color: Colors.textMuted, textDecorationLine: 'underline' },
});
