import { ClockResponseHint } from './ClockResponseHint';
import { Fragment, useState, type ComponentType, type ReactNode } from 'react';
import { BalanceModel } from '@/components/puzzle/BalanceModel';
import { BridgeTask } from '@/components/puzzle/BridgeTask';
import { EverydayDiagram } from '@/components/puzzle/EverydayDiagram';
import { GridAnswerChoices, GridResponseChoices } from './everyday/GridAnswerChoices';
import { ProofViewportContext, useProofViewport } from './PlayProofCaption';
import { CompactKeypad } from './CompactKeypad';
import { quantityEquation } from '@/utils/quantity-task-scene';
import { FractionPieChart } from '@/components/puzzle/FractionPieChart';
import { GeometryMeasureTask } from '@/components/puzzle/GeometryMeasureTask';
import { MultipleChoiceTask } from '@/components/puzzle/MultipleChoiceTask';
import { NumberLineTrack } from '@/components/puzzle/NumberLineTrack';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { QuantityTaskScene } from '@/components/puzzle/QuantityTaskScene';
import { TrueFalseTask } from '@/components/puzzle/TrueFalseTask';
import { UnknownWell, ValueChip } from '@/components/puzzle/kit/PuzzleKit';
import { PlaceValueMat } from '@/components/puzzle/place-value/PlaceValueMat';
import { DecimalPlaceMat } from '@/components/puzzle/place-value/DecimalPlaceMat';
import { Ink, PuzzleColors as C } from '@/constants/puzzle-theme';
import type { Puzzle } from '@/types/puzzle';
import { isBridgePuzzle } from '@/utils/bridge-models';
import { initialDecimalPlace } from '@/utils/decimal-models';
import { initialPlaceValue, placeValueCapacity } from '@/utils/place-value';
import { compactPlaceValue, placeValueWords } from '@/utils/place-value-words';
import { editResponse, responseContent, type ResponseValue } from '@/utils/puzzle-response';
import { storyAnswerUnit } from '@/utils/story-answer-unit';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

const ignore = () => {};

export function WrittenAnswer({ puzzle, value }: { puzzle: Puzzle; value: ResponseValue }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const unit = storyAnswerUnit(puzzle, locale);
  const written = typeof value === 'string' && value ? value.replace('.', /^(lv|ru)/.test(locale) ? ',' : '.') : '?';
  return <View style={styles.inlineWell}>
    <Text testID="response-value" accessibilityLiveRegion="polite" accessibilityLabel={`${t('activityMix.answer')}: ${written}${unit ? ` ${unit}` : ''}`}
      style={styles.value}>{written}{unit ? ` ${unit}` : ''}</Text>
  </View>;
}

// The outer viewport starts above the equation. Give its picture only the remaining height.
function WrittenModelViewport({ children }: { children: ReactNode }) {
  const viewport = useProofViewport();
  const [top, setTop] = useState(0);
  return <View testID="response-model" onLayout={event => setTop(event.nativeEvent.layout.y)}>
    <ProofViewportContext.Provider value={viewport && { ...viewport, availableModelHeight: Math.max(0, viewport.availableModelHeight - top) }}>
      {children}
    </ProofViewportContext.Provider>
  </View>;
}

function writeExpression(puzzle: Puzzle) {
  if (puzzle.response?.kind !== 'write') return null;
  if (puzzle.type === 'multiple_choice' && puzzle.taskVisual && !puzzle.fractionExample) {
    return quantityEquation(puzzle.taskVisual, 0).replace(/ = \?$/, ' =');
  }
  if (puzzle.type === 'number_line') return `${puzzle.payload.start} ${puzzle.payload.jump < 0 ? '−' : '+'} ${Math.abs(puzzle.payload.jump)} =`;
  if (puzzle.type === 'true_false') return `${puzzle.payload.statement.split('=')[0].trim()} =`;
  if (puzzle.type === 'estimate') return `${puzzle.payload.expression} =`;
  if (puzzle.type === 'fair_share') return `${puzzle.payload.items} ÷ ${puzzle.payload.people} =`;
  if (puzzle.type === 'place_value' && (puzzle.payload.mode === 'add' || puzzle.payload.mode === 'subtract'))
    return `${puzzle.payload.start} ${puzzle.payload.mode === 'add' ? '+' : '−'} ${puzzle.payload.operand ?? 0} =`;
  return null;
}

/** Show the alternate question's givens without the original answer controls. */
export function PuzzleResponseModel({ puzzle, value = null, checked = false, solved = false, inlineEntry = false, initialDistribution, onDistributionChange, onSolutionShown }: {
  initialDistribution?: readonly number[];
  onDistributionChange?: (locations: number[]) => void;
  puzzle: Puzzle; value?: ResponseValue; checked?: boolean; inlineEntry?: boolean;
  /** Answered correctly: models with a worked route (coordinates) may draw it. */
  solved?: boolean; onSolutionShown?: () => void;
}) {
  const viewport = useProofViewport();
  if (puzzle.type === 'multiple_choice' || !puzzle.type) {
    const response = puzzle.response;
    const choice = responseContent(response, value);
    const accepted = response?.kind !== 'judge' || value === true;
    const numericAttempt = checked && !solved && onSolutionShown
      ? (accepted && choice && /^\d+(?:[.,]\d+)?$/.test(choice) ? { choice } : {}) : undefined;
    const model = puzzle.everyday?.model;
    const showSubmission = model?.kind === 'solid' || (model?.kind === 'shapes' && (accepted || model.task === 'symmetry'))
      || (model?.kind === 'bars' && accepted);
    return <>
      {puzzle.everyday ? <EverydayDiagram model={puzzle.everyday.model} submitted={showSubmission && checked && !solved ? choice : undefined} capacityAttempt={puzzle.everyday.model.kind === 'capacity' ? numericAttempt : undefined} moneyAttempt={puzzle.everyday.model.kind === 'money' ? numericAttempt : undefined} onSolutionShown={onSolutionShown} /> : null}
      {puzzle.taskVisual ? <QuantityTaskScene key={checked ? 'checked' : 'edit'} initialDistribution={initialDistribution} onSolutionShown={onSolutionShown} model={puzzle.taskVisual} disabled={checked || solved || ((puzzle.taskVisual.kind === 'join' || puzzle.taskVisual.kind === 'take_away') && response?.kind !== 'write')} solved={solved} selectedGroups={puzzle.fractionExample?.numerator} onDistributionChange={onDistributionChange} showExpression={!inlineEntry && puzzle.difficulty !== 'hard'} /> : null}
    </>;
  }
  if (isBridgePuzzle(puzzle)) {
    const model = puzzle.type === 'coordinate_map' && puzzle.payload.mode === 'plot'
      ? { ...puzzle, payload: { ...puzzle.payload, mode: 'translate' as const, start: puzzle.payload.end, end: { x: puzzle.payload.end.x === puzzle.payload.max ? -1 : 1, y: 0 } } } : puzzle;
    const response = puzzle.response;
    const choice = responseContent(response, value);
    const point = typeof choice === 'string' && /^\s*\((-?\d+),\s*(-?\d+)\)\s*$/.exec(choice);
    const coordinateAttempt = !solved && checked && puzzle.type === 'coordinate_map'
      ? point ? { x: Number(point[1]), y: Number(point[2]) } : choice != null && Number.isFinite(Number(choice)) ? Number(choice) : undefined
      : undefined;
    return <BridgeTask onSolutionShown={onSolutionShown} submitted={coordinateAttempt} puzzle={model} value={null} onChange={ignore} answered readOnly solved={solved || coordinateAttempt !== undefined} quietGivens={model !== puzzle} />;
  }
  if (puzzle.type === 'geometry_measure') {
    // Rejecting a claim supplies no numeric count. Keep the child's painted squares.
    const rejectedArea = puzzle.payload.mode === 'area' && puzzle.response?.kind === 'judge' && value === false;
    const claim = rejectedArea ? undefined : responseContent(puzzle.response, value);
    const count = claim && /^\d+$/.test(claim) ? Number(claim) : null;
    return <GeometryMeasureTask onSolutionShown={onSolutionShown} puzzle={puzzle} value={count}
      checkedResult={checked && !solved ? 'wrong' : undefined} onChange={ignore} answered readOnly explore={!checked && !solved} />;
  }
  if (puzzle.type === 'number_line') return <>
    {!inlineEntry && <Text style={styles.expression}>{puzzle.payload.start} {puzzle.payload.jump < 0 ? '−' : '+'} {Math.abs(puzzle.payload.jump)} = ?</Text>}
    <NumberLineTrack min={puzzle.payload.min} max={puzzle.payload.max} start={puzzle.payload.start} value={puzzle.payload.start} disabled />
  </>;
  if (puzzle.type === 'balance') {
    const response = puzzle.response;
    let choice: string | null = null;
    if (response?.kind === 'choose' && value !== null) choice = response.options[Number(value)] ?? null;
    if (checked && response?.kind === 'judge') choice = response.proposed;
    if (checked && response?.kind === 'write' && typeof value === 'string') choice = value;
    return <BalanceModel model={puzzle.payload} choice={choice} checked={checked} onSolutionShown={onSolutionShown} />;
  }
  if (puzzle.type === 'true_false') return inlineEntry ? null : <View style={styles.modelRow}><Text style={styles.expression}>{puzzle.payload.statement.split('=')[0].trim()} =</Text><UnknownWell /></View>;
  if (puzzle.type === 'fix_mistake') return <View style={styles.facts}>{puzzle.payload.wrongWork.map((s, i) => <Text key={i} style={styles.expression}>{s}</Text>)}</View>;
  if (puzzle.type === 'pair_sum') return <View style={styles.tiles}>{puzzle.payload.numbers.map((n, i) => <ValueChip key={i} size="lg" label={String(n)} />)}</View>;
  if (puzzle.type === 'fraction_build') return <View style={styles.picture}><FractionPieChart denominator={puzzle.payload.denominator} shaded={0} size={156} /></View>;
  if (puzzle.type === 'fraction_equivalent') return <View style={styles.picture}>
    <Text style={styles.expression}>{puzzle.payload.numerator}/{puzzle.payload.denominator}</Text>
    <FractionPieChart denominator={puzzle.payload.denominator} shaded={puzzle.payload.numerator} size={156} />
  </View>;
  if (puzzle.type === 'fraction_match') {
    const p = puzzle.payload.pairs[0];
    return <View style={styles.picture}><FractionPieChart denominator={p.denominator} shaded={p.numerator} size={156} /></View>;
  }
  if (puzzle.type === 'pattern_next') return <View style={styles.tiles}>{puzzle.payload.sequence.map((n, i) => <ValueChip key={i} label={String(n)} />)}<UnknownWell /></View>;
  if (puzzle.type === 'function_machine') return <View style={styles.modelRow}><ValueChip size="lg" tone="teal" label={String(puzzle.payload.input)} /><Text style={styles.expression}>→</Text><UnknownWell size="lg" /><Text style={styles.expression}>→</Text><ValueChip size="lg" tone="teal" label={String(puzzle.payload.output)} /></View>;
  if (puzzle.type === 'estimate') return inlineEntry ? null : <Text style={styles.expression}>{puzzle.payload.expression} = ?</Text>;
  if (puzzle.type === 'compare') return <Text style={styles.expression}>A: {puzzle.payload.optionA}{'\n'}B: {puzzle.payload.optionB}</Text>;
  if (puzzle.type === 'fair_share') return inlineEntry ? null : <Text style={styles.expression}>{puzzle.payload.items} ÷ {puzzle.payload.people} = ?</Text>;
  if (puzzle.type === 'place_value') {
    const { start, mode, operand = 0 } = puzzle.payload;
    const state = mode === 'build' ? { tens: Math.floor(start / 10), ones: start % 10, added: false } : initialPlaceValue(puzzle);
    return <View style={styles.facts}>
      {(mode === 'add' || mode === 'subtract') && !inlineEntry && <Text style={styles.expression}>{`${start} ${mode === 'add' ? '+' : '−'} ${operand} = ?`}</Text>}
      <PlaceValueMat capacity={placeValueCapacity(puzzle)} total={mode === 'add' || mode === 'subtract' ? undefined : start} viewport={viewport} tens={state.tens} ones={state.ones} enter={!checked && !solved} />
    </View>;
  }
  if (puzzle.type === 'decimal_place_value') {
    const { hundredths, mode, units } = puzzle.payload;
    const state = mode === 'build' ? { ones: Math.floor(hundredths / 100), tenths: Math.floor(hundredths % 100 / 10), hundredths: hundredths % 10 } : initialDecimalPlace(puzzle);
    return <DecimalPlaceMat viewport={viewport} enter={!checked && !solved} exchangeUnit={mode === 'build' ? undefined : puzzle.payload.exchangeUnit}
      state={state} units={mode !== 'build' && puzzle.payload.exchangeUnit === 'hundredths' && !state.ones ? ['tenths', 'hundredths'] : units} />;
  }
  return null;
}

type Props = { storyHostsAnswer?: boolean; playbackOwnsControls?: boolean; AnswerRow?: ComponentType<{ children: ReactNode }>; checkedModel?: ReactNode; initialDistribution?: readonly number[];
  onDistributionChange?: (locations: number[]) => void; onSolutionShown?: () => void; puzzle: Puzzle; value: ResponseValue; onChange: (value: ResponseValue) => void; answered: boolean; incorrectAttempt?: boolean; isCorrect: boolean };
export function PuzzleResponseTask({ storyHostsAnswer = false, playbackOwnsControls = false, AnswerRow, checkedModel, initialDistribution, onDistributionChange, onSolutionShown, puzzle, value, onChange, answered, incorrectAttempt = false, isCorrect }: Props) {
  const { t, i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const viewport = useProofViewport();
  const [claimHeight, setClaimHeight] = useState(0);
  const response = puzzle.response;
  if (!response) return null;
  if (playbackOwnsControls && checkedModel != null) return <>{checkedModel}</>;
  if (playbackOwnsControls && response.kind === 'judge' && 'everyday' in puzzle && puzzle.everyday?.model.kind === 'grid') {
    return <GridAnswerChoices mode={isCorrect ? 'worked' : 'attempt'} model={puzzle.everyday.model} choices={[response.proposed]}
      selectedIndex={incorrectAttempt ? 0 : null} correctIndex={-1} claim answered={answered} {...{ isCorrect, incorrectAttempt, onSolutionShown }} onSelect={() => {}} />;
  }
  // Alternate spatial responses keep their authored string or boolean value.
  if ('everyday' in puzzle && puzzle.everyday?.model.kind === 'grid') return <GridResponseChoices {...{ AnswerRow }} model={puzzle.everyday.model}
    choices={puzzle.choices} mode={playbackOwnsControls ? isCorrect ? "worked" : "attempt" : undefined} {...{ response, value, onChange, answered, incorrectAttempt, isCorrect, onSolutionShown }} />;
  const decimalKey = response.kind === 'write' && (response.answer.includes('.') || 'everyday' in puzzle && puzzle.everyday?.model.kind === 'money' && puzzle.everyday.model.unit === 'euros');
  const decimalSeparator = /^(lv|ru)/.test(i18n.language) ? ',' : '.';
  const separator = response.kind === 'write' && (response.format === 'clock' ? ':' : response.format === 'fraction' ? '/' : decimalKey ? decimalSeparator : '');
  const signed = response.kind === 'write' && response.format === 'number' && response.answer.startsWith('-');
  const disabled = answered;
  const WellRow = AnswerRow ?? Fragment;
  const change = (next: ResponseValue) => { if (!disabled) onChange(next); };
  // Display only: the authored option or claim stays the answer; it is read in the model's own words and units.
  const wordy = puzzle.type === 'place_value' || puzzle.type === 'decimal_place_value';
  const claim = (text: string) => {
    if (wordy) return placeValueWords(text, t, i18n.language?.split('-')[0]);
    if (puzzle.type !== 'geometry_measure' || puzzle.payload.mode === 'compare' || !/^\d+$/.test(text)) return text;
    if (puzzle.payload.mode === 'area') return text === '1' ? t('geometryModels.squareUnit') : t('geometryModels.squareUnits', { value: text });
    return text === '1' ? t('geometryModels.oneUnit') : t('geometryModels.manyUnits', { value: text });
  };
  const compactPlace = wordy && fontScale >= 2;
  const locale = i18n.language?.split('-')[0] ?? 'en';
  const choices = response.kind === 'choose' ? response.options : [];
  const choiceLabels = wordy ? choices.map(text => compactPlace ? compactPlaceValue(text, locale) : claim(text)) : choices;
  const compactModelClaim = fontScale >= 2 && (puzzle.type === 'geometry_measure' || puzzle.type === 'coordinate_map');
  const compactJudge = fontScale >= 2 && response.kind === 'judge' && (wordy || compactModelClaim || ('everyday' in puzzle && puzzle.everyday?.model.kind === 'clock'));
  const modelClaim = !playbackOwnsControls && wordy && response.kind === 'judge';
  const judgeTask = response.kind === 'judge' && <TrueFalseTask AnswerRow={AnswerRow} playbackOwnsControls={compactJudge} statementLabel={compactPlace || compactModelClaim ? claim(response.proposed) : undefined}
    puzzle={{ ...puzzle, type: 'true_false', payload: { statement: compactPlace ? compactPlaceValue(response.proposed, locale) : claim(response.proposed), hideStatement: modelClaim }, isTrue: response.isCorrect }}
    selectedIndex={value === null ? null : value === true ? 0 : 1} onSelect={index => change(index === 0)}
    answered={answered} incorrectAttempt={incorrectAttempt} isCorrect={isCorrect} />;
  const expression = !playbackOwnsControls && writeExpression(puzzle);
  const model = checkedModel ?? <PuzzleResponseModel inlineEntry={!!expression} initialDistribution={initialDistribution} onDistributionChange={onDistributionChange} puzzle={puzzle} value={value} checked={answered || (puzzle.type === 'geometry_measure' ? playbackOwnsControls : incorrectAttempt)} solved={answered && isCorrect} onSolutionShown={onSolutionShown} />;
  const extra = separator || (signed ? 'sign' : '');
  const extraLabel = extra === 'sign' ? t('activityMix.sign') : extra;
  return <View style={styles.wrap} testID="puzzle-response">
    {expression && <View style={styles.modelRow}><Text style={styles.expression}>{expression}</Text><WrittenAnswer puzzle={puzzle} value={value} /></View>}
    {wordy && !expression && !checkedModel ? <View testID="play-entry-model" nativeID="play-entry-model" style={styles.facts}>
      {modelClaim && viewport ? <ProofViewportContext.Provider value={{ ...viewport,
        availableModelHeight: Math.max(0, viewport.availableModelHeight - claimHeight - 8) }}>{model}</ProofViewportContext.Provider> : model}
      {modelClaim && <View onLayout={event => setClaimHeight(event.nativeEvent.layout.height)}><TrueFalseTask playbackOwnsControls claimHeading
        puzzle={{ ...puzzle, type: 'true_false', payload: { statement: claim(response.proposed) }, isTrue: response.isCorrect }}
        selectedIndex={null} onSelect={ignore} answered={false} isCorrect={false} /></View>}
    </View> : expression ? <WrittenModelViewport>{model}</WrittenModelViewport> : model}
    {playbackOwnsControls ? null : response.kind === 'choose' ? <MultipleChoiceTask AnswerRow={AnswerRow} spokenChoices={compactPlace ? choices.map(claim) : puzzle.type === 'coordinate_map' ? choices : undefined} puzzle={{ ...puzzle, type: 'multiple_choice', choices: choiceLabels, correctIndex: response.correctIndex, taskVisual: undefined, ...('everyday' in puzzle ? { everyday: undefined } : {}) }} selectedIndex={typeof value === 'string' && value !== '' ? Number(value) : null} onSelect={index => change(String(index))} answered={answered} incorrectAttempt={incorrectAttempt} isCorrect={isCorrect} />
      : response.kind === 'judge' ? <View style={styles.wrap}>
        {compactJudge ? <WellRow>
          {judgeTask}
          <View style={styles.judgeSymbols}>{[true, false].map(answer => <Pressable key={String(answer)}
            accessibilityRole="button" accessibilityLabel={t(answer ? 'puzzleTypes.trueLabel' : 'puzzleTypes.falseLabel').replace(/\s*[✓✔✗✘]\s*$/u, '')}
            accessibilityState={{ selected: value === answer, disabled }} disabled={disabled} onPress={() => change(answer)}
            style={[styles.judgeButton, value === answer && styles.selectedJudgeButton]}>
            <Text allowFontScaling={false} style={styles.judgeSymbol}>{answer ? '✓' : '×'}</Text>
          </Pressable>)}</View>
        </WellRow> : judgeTask}
      </View> : <WellRow><View style={styles.entry}>
        {!expression && !storyHostsAnswer && <WrittenAnswer puzzle={puzzle} value={value} />}
        {signed && separator ? <Pressable accessibilityRole="button" accessibilityLabel={t('activityMix.sign')} testID="response-key-sign"
          onPress={() => change(editResponse(value, 'sign', response.format))} style={styles.sign}><Text style={styles.value}>±</Text></Pressable> : null}
        <View><CompactKeypad onDigit={digit => change(editResponse(value, String(digit), response.format))}
          onErase={() => change(editResponse(value, 'erase', response.format))} disabled={disabled} canErase={!!value}
          digitID={digit => `response-key-${digit}`} eraseID="response-key-erase"
          extraKey={extra ? { text: extra === 'sign' ? '±' : extra, label: extraLabel, testID: `response-key-${extra === ',' ? '.' : extra}`,
            onPress: () => change(editResponse(value, extra, response.format)) } : undefined} />
          {'everyday' in puzzle && puzzle.everyday?.model.kind === 'clock' && !answered && !incorrectAttempt &&
            <ClockResponseHint kind="write" interacted={value !== null && value !== ''} />}
        </View>
      </View></WellRow>}
  </View>;
}
const styles = StyleSheet.create({
  judgeSymbols: { flexDirection: 'row', gap: 12 },
  judgeButton: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 3, borderRadius: 14, borderColor: Ink.trayEdge, backgroundColor: Ink.tray },
  selectedJudgeButton: { borderColor: C.primary, backgroundColor: C.selectedSurface },
  judgeSymbol: { fontSize: 28, fontWeight: '800', color: Ink.text },
  wrap: { gap: 12 }, facts: { gap: 8 }, picture: { alignItems: 'center' }, expression: { fontSize: 24, lineHeight: 32, fontWeight: '800', textAlign: 'center', color: C.text },
  entry: { width: '100%', maxWidth: 340, alignSelf: 'center', gap: 8 },
  inlineWell: { alignSelf: 'center', minWidth: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: C.selectedSurface, borderRadius: 8, paddingHorizontal: 8 },
  value: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: C.primaryDark, fontVariant: ['tabular-nums'] },
  sign: { alignSelf: 'center', minHeight: 44, minWidth: 44, justifyContent: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }, modelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }, tile: { minWidth: 54, padding: 12, fontSize: 22, fontWeight: '700', color: C.text, backgroundColor: C.progressTrack, borderRadius: 12, textAlign: 'center' },
  wrong: { borderColor: C.incorrect }, correct: { borderColor: C.success }, disabled: { opacity: 0.5 }, pressed: { backgroundColor: C.selectedSurface, borderColor: C.primary },
});
