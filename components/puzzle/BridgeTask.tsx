import { LineStepButton } from './number-line/LineStepButton';
/** Local puzzle extension: mathematical diagrams, Berry controls, shared Check.
 * Guided models fade into independent work; reset never submits or spends a life.
 */
import { CoordinateGrid, formatPoint, type CoordinateRoute } from '@/components/puzzle/bridge/CoordinateGrid';
import { EquationBoardModel } from '@/components/puzzle/EquationBoardModel';
import { NumberTile, ResultMark, UnknownWell, ValueChip } from '@/components/puzzle/kit/PuzzleKit';
import { CompactKeypad } from './CompactKeypad';
import { NumberLineTrack } from '@/components/puzzle/NumberLineTrack';
import { PlayProofCaptionContext } from './PlayProofCaption';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { RatioTableModel } from '@/components/puzzle/RatioTableModel';
import { Ink, PuzzleColors as Colors, Radius, Shape } from '@/constants/puzzle-theme';
import { bridgeTarget, transformEquation, type EquationMove, type BridgePuzzle, type BridgeState, type Point } from '@/utils/bridge-models';
import { appendGeometryDigit } from '@/utils/geometry-models';
import { moderateScale } from '@/utils/scale';
import { Fragment, useCallback, useContext, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text as NativeText, useWindowDimensions, View } from 'react-native';

type Props = { puzzle: BridgePuzzle; value: BridgeState | null; onChange: (value: BridgeState | null) => void; answered: boolean; readOnly?: boolean;
  /** A read-only model whose question was answered correctly: draw the worked route. */
  solved?: boolean; submitted?: number | Point;
  playbackOwnsControls?: boolean;
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  checkedModel?: ReactNode;
  checkedResult?: 'correct' | 'wrong';
  onSolutionShown?: () => void;
  /** The question already states the start and the move: the plane's A label carries them, with no heading or move note. */
  quietGivens?: boolean };

/** Quiet secondary control (reset, erase, shortcuts): text only, still a 44 pt target. */
function QuietButton({ id, label, onPress, disabled }: { id: string; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.quiet, pressed && styles.quietPressed, disabled && styles.disabled]}>
    <Text style={styles.quietText}>{label}</Text>
  </Pressable>;
}

export function BridgeTask({ AnswerRow = Fragment, puzzle, value, onChange, answered, readOnly: modelOnly = false, solved = false, quietGivens = false, submitted: coordinateAttempt, onSolutionShown, checkedModel, checkedResult, playbackOwnsControls = false }: Props) {
  const { t } = useTranslation();
  // Alternate-response tasks also mount this read-only model inside the playback host.
  const captionHost = useContext(PlayProofCaptionContext);
  const checkedDiagram = playbackOwnsControls || (modelOnly && captionHost != null);
  const [pickedOp, setPickedOp] = useState<EquationMove | null>(null);
  const { fontScale, width: screen } = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(screen - 48, 440));
  const settleCoordinates = useCallback((settled: boolean) => {
    if (settled) onSolutionShown?.();
  }, [onSolutionShown]);
  if (playbackOwnsControls && checkedModel != null) return <>{checkedModel}</>;
  const scalar = puzzle.type === 'ratio_table' || puzzle.type === 'coordinate_map' && puzzle.payload.mode === 'distance';
  const replacement = scalar ? checkedModel : undefined;
  const result = scalar ? checkedResult : undefined;
  const retained = replacement != null || result != null;
  const readOnly = playbackOwnsControls || (modelOnly && !retained);
  const locked = answered || retained;
  const disabled = locked || readOnly;
  const submitted = value?.value == null ? '?' : String(value.value);
  const answerLabel = puzzle.type === 'ratio_table' ? t('bridge.litresAnswer', { amount: submitted }) : t('play.answerLabel', { answer: submitted });
  const scalarWell = readOnly ? <Text style={styles.note}>{submitted}</Text> : <View testID="bridge-value" accessible accessibilityLabel={result ? `${answerLabel}. ${t(result === 'correct' ? 'mood.correct' : 'play.tryAgain')}` : answerLabel} style={styles.equationRow}>
    <UnknownWell size={puzzle.type === 'ratio_table' ? 'lg' : 'md'} label={submitted} filled={value?.value != null} active={!disabled}
      style={result === 'correct' ? styles.correctWell : result === 'wrong' ? styles.wrongWell : undefined} />
    {result && <ResultMark kind={result} />}
  </View>;
  const tile = (id: string, label: string, action: () => void, off = false, a11y?: string, wide = false) =>
    <NumberTile key={id} testID={id} label={label} accessibilityLabel={a11y ?? label} disabled={disabled || off} onPress={action}
      style={[styles.tile, wide && styles.wideTile]} textStyle={wide ? styles.actionText : undefined} />;
  const keypad = (readout?: ReactNode) => readOnly || (locked && !retained) ? null : (
    <CompactKeypad wideRows={puzzle.type === 'coordinate_map' && width >= 6 * 44 + 5 * 7} readout={readout} digitID={digit => `bridge-digit-${digit}`} eraseID="bridge-erase" disabled={locked} canErase={value?.value != null}
      onDigit={digit => onChange({ value: appendGeometryDigit(value?.value ?? null, digit) })}
      onErase={() => onChange({ value: value?.value != null && value.value >= 10 ? Math.floor(value.value / 10) : null })} />
  );

  let model;
  if (puzzle.type === 'ratio_table') {
    model = <>
      <RatioTableModel playbackOwnsControls={playbackOwnsControls} puzzle={puzzle} answer={value?.value ?? null} answered={locked} answerWell={scalarWell} checkedModel={replacement} worked={result !== 'wrong' && ((answered && !readOnly) || solved)} />
      <AnswerRow>{keypad()}</AnswerRow>
    </>;
  } else if (puzzle.type === 'signed_line') {
    const { min, max, start, mode, delta } = puzzle.payload;
    // A "place" task has no stated start: the marker waits at zero (or the
    // nearest end) until the learner moves it. Its alternate questions do
    // state the number as the start, so a read-only model starts there.
    const stated = mode === 'move' || readOnly;
    const resting = Math.min(max, Math.max(min, 0));
    const origin = stated ? start : resting;
    const current = value?.value ?? origin;
    const candidate = mode === 'place' && puzzle.response?.kind === 'choose'
      ? Number(puzzle.response.options[puzzle.response.correctIndex]?.replace('−', '-')) : NaN;
    const landing = mode === 'move' ? start + delta : Number.isFinite(candidate) ? candidate : start;
    // Play and replay share the authored bounds, so a read-only line is the same rail the child used.
    const view = { min, max };
    model = <>
      {/* An interactive "place" task shows the number to place (its question does not name it); a read-only
          model already marks it as the start on the line, so it gets no second chip. */}
      {mode === 'place' && readOnly ? null : <View style={styles.equationRow} accessible accessibilityLabel={mode === 'place' ? String(start) : `${start} ${delta < 0 ? '−' : '+'} ${Math.abs(delta)} = ?`}>
        {mode === 'place' ? <ValueChip label={String(start)} size="lg" tone="teal" /> : <>
          <Text style={styles.equation}>{`${start} ${delta < 0 ? '−' : '+'} ${Math.abs(delta)} =`}</Text>
          <UnknownWell size="md" label={value?.value == null ? '?' : String(value.value)} filled={value?.value != null} active={!disabled} />
        </>}
      </View>}
      <NumberLineTrack min={view.min} max={view.max} start={origin} focusEnd={landing} showStart={stated} value={current} fit={readOnly}
        onSelect={readOnly ? undefined : n => onChange({ value: n })} disabled={disabled} />
      {readOnly ? null : <View style={styles.stepRow}>
        {([-1, 1] as const).map(d => {
          const off = disabled || current + d < min || current + d > max;
          return <LineStepButton key={d} testID={`bridge-step-${d}`} direction={d} label="1"
            accessibilityLabel={t(d < 0 ? 'puzzleTypes.numberLineMoveLeft' : 'puzzleTypes.numberLineMoveRight')}
            disabled={off} onPress={() => onChange({ value: current + d })} />;
        })}
      </View>}
    </>;
  } else if (puzzle.type === 'equation_board') {
    const { a, b, c } = puzzle.payload, equation = value?.equation ?? { a, b, c };
    const isolated = equation.a === 1 && equation.b === 0;
    const operations: ['add' | 'divide', number][] = [['add', -1], ['add', 1], ...(puzzle.difficulty === 'easy' ? [] : [['add', -5], ['add', 5], ['divide', 2], ['divide', 3], ['divide', 4]] as ['add' | 'divide', number][])];
    const candidates = operations.map(([operation, amount]) => {
      const next = transformEquation(equation, operation, amount);
      const crossesZero = next && ((equation.b >= 0 && next.b < 0) || (equation.b < 0 && next.b > 0) || (equation.c >= 0 && next.c < 0));
      const available = next && !crossesZero && !(puzzle.difficulty === 'easy' && (next.b < 0 || next.c < 0 || next.c > 20));
      const action = operation === 'divide' ? 'divide' as const : amount < 0 ? 'subtract' as const : 'add' as const;
      return { operation, amount, next, available, action };
    });
    const moves = value?.equationMoves ?? [];
    const picked = candidates.find(c => c.operation === pickedOp?.operation && c.amount === pickedOp.amount && c.available);
    function apply(candidate: typeof candidates[number]) {
      if (disabled || isolated || !candidate.available || !candidate.next) return;
      const { operation, amount, next } = candidate;
      setPickedOp(null);
      onChange({ equation: next, equationMoves: [...moves, { operation, amount }] });
    }
    model = <>
      <View nativeID="play-entry-model" testID="play-entry-model"><EquationBoardModel equation={equation}
        pan={disabled || isolated ? undefined : { label: t('placement.bothPans'), enabled: !!picked, active: !!picked, onPress: () => { if (picked) apply(picked); } }} /></View>
      {readOnly || isolated ? null : <>
        <AnswerRow><View testID="bridge-operations" style={styles.operations}>{candidates.map(candidate => {
          const { operation, amount, action, next, available } = candidate;
          if (operation === 'divide' && !next) return null;
          const label = t(`bridge.action_${action}`, { amount: Math.abs(amount) });
          return <NumberTile key={`${operation}-${amount}`} testID={`bridge-${operation}-${amount}`} label={fontScale > 1.2 ? `${action === 'divide' ? '÷' : action === 'subtract' ? '−' : '+'}${Math.abs(amount)}` : label}
            accessibilityLabel={label} disabled={disabled || !available} selected={picked === candidate}
            accessibilityActions={[{ name: 'apply', label: t(`bridge.actionBoth_${action}`, { amount: Math.abs(amount) }) }]}
            onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'apply') apply(candidate); }}
            onPress={() => setPickedOp(picked === candidate ? null : { operation, amount })}
            style={[styles.operation, fontScale > 1.2 && styles.largeOperation, !available && styles.operationOff]}
            textStyle={[styles.actionText, !available && styles.actionOff]} />;
        })}</View></AnswerRow>
      </>}
    </>;
  } else {
    const { min, max, mode, start, end } = puzzle.payload;
    // The XL keypad and the grid share the stage. Reserve the same space on replay.
    const side = width;
    const point = value?.point ?? null;
    const target = bridgeTarget(puzzle);
    // The worked route is only drawn once this task itself has been answered, never in a read-only model.
    const worked = result !== 'wrong' && ((answered && !readOnly) || solved);
    const origin = { x: Math.max(min, Math.min(max, 0)), y: Math.max(min, Math.min(max, 0)) };
    const route: CoordinateRoute | null = !worked ? null
      : mode === 'distance' ? { from: start, to: end, kind: 'measure' }
        : mode === 'translate' ? { from: start, to: { x: start.x + end.x, y: start.y + end.y }, kind: 'walk', relativeResponse: quietGivens }
          : typeof target === 'object' ? { from: origin, to: target, kind: 'walk', fromOrigin: true } : null;
    const signed = (n: number) => n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
    model = <>
      {replacement ?? <>
        {mode === 'plot' && !quietGivens && <View style={styles.equationRow}>
          <Text style={styles.equation}>{formatPoint(end)}</Text>
        </View>}
        {mode === 'translate' && !quietGivens ? <View style={styles.equationRow}>
          <NativeText style={styles.moveChip} accessibilityLabel={t('bridge.moveBy', { x: signed(end.x), y: signed(end.y) })}>
            {[end.x && `${end.x < 0 ? '←' : '→'} ${Math.abs(end.x)}`, end.y && `${end.y < 0 ? '↓' : '↑'} ${Math.abs(end.y)}`].filter(Boolean).join('   ')}
          </NativeText>
        </View> : null}
        <View accessible={!worked && mode !== 'plot'} accessibilityLabel={mode === 'distance' ? `A ${formatPoint(start)}, B ${formatPoint(end)}` : `A ${formatPoint(start)}`}>
          <CoordinateGrid moveChip={mode === 'translate' && !quietGivens} puzzleId={puzzle.id} playback={checkedDiagram} testID="bridge-plot" min={min} max={max} side={side}
            points={[...(mode !== 'plot' ? [{ at: start, label: 'A' }] : []),
              ...(mode === 'distance' ? [{ at: end, label: 'B' }] : [])]}
            learner={mode !== 'distance' ? point : null} route={route} submitted={coordinateAttempt}
            onTap={mode !== 'distance' && !readOnly && !answered ? p => onChange({ point: p }) : undefined} disabled={disabled}
            onSettled={settleCoordinates} />
        </View>
      </>}
      {readOnly ? null : mode === 'distance' ? <AnswerRow>
        {(fontScale < 2 || AnswerRow === Fragment) && <View style={styles.equationRow}>
          <Text style={styles.note}>{t('bridge.answer')}</Text>
          {scalarWell}
        </View>}
        {!answered || retained ? keypad(fontScale >= 2 && AnswerRow !== Fragment ? scalarWell : undefined) : null}
      </AnswerRow> : answered ? null : <View style={styles.group}>
        <View testID="bridge-point" style={styles.equationRow} accessible accessibilityLabel={point ? formatPoint(point) : '(?, ?)'}>
          <Text style={styles.equation}>(</Text>
          <UnknownWell size="sm" label={point ? String(point.x) : '?'} filled={!!point} active={!disabled && !!point} />
          <Text style={styles.equation}>,</Text>
          <UnknownWell size="sm" label={point ? String(point.y) : '?'} filled={!!point} active={!disabled && !!point} />
          <Text style={styles.equation}>)</Text>
        </View>
        <View style={styles.steppers}>{(['x', 'y'] as const).map(axis => {
          const at: Point = point ?? origin;
          return <View key={axis} style={styles.stepper}>
            <Text style={styles.axis}>{axis}</Text>
            {([-1, 1] as const).map(d => tile(`bridge-${axis}-${d}`, d > 0 ? '+1' : '−1', () => onChange({ point: { ...at, [axis]: at[axis] + d } }),
              at[axis] + d < min || at[axis] + d > max, `${axis} ${d > 0 ? '+' : '−'} 1`))}
          </View>;
        })}</View>
      </View>}
    </>;
  }
  return <View style={styles.wrap} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {!readOnly && puzzle.payload.guided && puzzle.type === 'signed_line' ? <Text style={styles.guide}>{t(`bridge.guide_${puzzle.type}`)}</Text> : null}
    {model}
    {!readOnly && !retained && (!scalar || AnswerRow === Fragment) && !(answered && puzzle.type === 'coordinate_map' && !retained) ? <View style={styles.footer}>
      {puzzle.type === 'signed_line' ? <QuietButton id="bridge-zero" label={t('bridge.selectZero')} onPress={() => onChange({ value: 0 })} disabled={locked || puzzle.payload.min > 0 || puzzle.payload.max < 0} /> : null}
      {puzzle.type === 'coordinate_map' && puzzle.payload.mode !== 'distance' ? <QuietButton id="bridge-origin" label={t('bridge.selectOrigin')} onPress={() => onChange({ point: { x: 0, y: 0 } })} disabled={locked} /> : null}
      {/* equation_board: no links on entry; one quiet reset appears only after the first move. */}
      {(puzzle.type === 'equation_board' ? value != null : (value != null || pickedOp != null || puzzle.type === 'signed_line')) && <QuietButton id="bridge-reset" label={t('geometryModels.reset')} onPress={() => { setPickedOp(null); onChange(null); }} disabled={locked} />}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(10) },
  group: { gap: moderateScale(8) },
  equationRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: moderateScale(6) },
  equation: { fontSize: moderateScale(26), lineHeight: moderateScale(34), fontWeight: '800', color: Ink.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  guide: { fontSize: moderateScale(15), lineHeight: moderateScale(22), color: Ink.soft, textAlign: 'center' },
  hidden: { opacity: 0 },
  correctWell: { borderColor: Colors.success, backgroundColor: Colors.successSurface },
  wrongWell: { borderColor: Colors.incorrect, backgroundColor: Colors.incorrectSurface },
  moveChip: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: Ink.text, backgroundColor: Colors.selectedSurface, borderRadius: 14, overflow: 'hidden', paddingVertical: 4, paddingHorizontal: 12 },
  note: { fontSize: moderateScale(15), lineHeight: moderateScale(21), color: Ink.soft, textAlign: 'center' },
  ready: { fontSize: moderateScale(18), lineHeight: moderateScale(25), fontWeight: '700', color: Ink.text, textAlign: 'center', paddingVertical: moderateScale(8) },
  tile: { flex: 1, minWidth: moderateScale(44), minHeight: moderateScale(50), paddingHorizontal: moderateScale(4) },
  wideTile: { flexBasis: moderateScale(140) },
  actionText: { fontSize: moderateScale(17), color: Colors.primaryDark },
  operations: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(8), justifyContent: 'center' },
  operation: { flexGrow: 1, flexBasis: moderateScale(140), minHeight: moderateScale(50) },
  largeOperation: { flexBasis: 74, flexGrow: 0, minWidth: 64, paddingHorizontal: 0 },
  // The standard disabled tile: grey text, no lip, so it never reads as a paler pressable move.
  operationOff: { borderBottomWidth: Shape.lip, backgroundColor: Ink.tray, borderColor: Ink.trayEdge },
  actionOff: { color: Ink.soft },
  stepRow: { flexDirection: 'row', gap: moderateScale(12), justifyContent: 'center' },
  steppers: { flexDirection: 'row', gap: moderateScale(16), justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(6) },
  axis: { fontSize: moderateScale(20), fontWeight: '800', fontStyle: 'italic', color: Ink.text, width: moderateScale(16), textAlign: 'center' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: moderateScale(16) },
  quiet: { minHeight: 44, paddingHorizontal: moderateScale(12), borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
  quietPressed: { backgroundColor: Colors.selectedSurface },
  quietText: { fontSize: moderateScale(16), fontWeight: '700', color: Colors.primaryDark, textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
