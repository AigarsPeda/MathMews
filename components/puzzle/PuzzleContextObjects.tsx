import { differenceBarWidths } from './kit/difference-bar';
import { ProofWindow } from './counting/ProofWindow';
import { PuzzleObjectImage } from './PuzzleObjectImage';
import { PuzzleText as Text } from './PuzzleText';
import { Ink, Motion, Quantity, Radius } from '@/constants/puzzle-theme';
import type { Puzzle } from '@/types/puzzle';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useModelPaint } from './counting/useModelPaint';
import type { RevealBeats } from './kit/useRevealBeats';
import { Caption } from './kit/Focus';
import { EntryBuild, StoryIdleCue } from './kit/PracticeAffordances';

type ContextGiven = NonNullable<Puzzle['contextObjects']>[number];

/** Only count-bearing context belongs in a mathematical model. */
export function isDifferenceTape(objects: ContextGiven[]) {
  const givens = objects.filter(item => item.count !== undefined);
  const [start, change] = givens;
  return givens.length === 2 && start.role === 'start' && change.role === 'remove' && start.object === change.object && start.count! > 12 && change.count! > 0 && change.count! < start.count!;
}

export function PuzzleContextObjects({ idle = false, objects, solved = false, revealing = false, landed = 0, beats, writtenAnswer, attemptValue }: { idle?: boolean; attemptValue?: string; writtenAnswer?: ReactNode; beats?: RevealBeats; objects: NonNullable<Puzzle['contextObjects']>; solved?: boolean; revealing?: boolean; landed?: number }) {
  const { t } = useTranslation();
  const givens = objects.filter(item => item.count !== undefined);
  const drawing = useModelPaint(givens.length > 0 && !isDifferenceTape(givens), beats);
  if (!givens.length) return null;
  const [start, change] = givens;
  if (isDifferenceTape(givens)) return <DifferenceTape idle={idle} attemptValue={attemptValue} writtenAnswer={writtenAnswer} start={start} change={change} solved={solved} revealing={revealing} landed={landed} />;
  return <View ref={drawing} collapsable={false} nativeID={beats ? "play-proof-model" : undefined} testID={beats ? "play-proof-model" : undefined} style={styles.model}>
    <ProofWindow focus={0}><View style={styles.row}>{givens.map((item, index) => {
      const name = t(`taskObjects.${item.object}`);
      const role = item.role ? t(`objectGivens.${item.role}`) : '';
      const count = item.count!;
      return <View key={index} style={styles.group} accessible accessibilityLabel={[role, count, name].filter(value => value !== '').join(' ')}>
        <View style={styles.pictures} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: count > 12 ? 1 : count }, (_, i) => <PuzzleObjectImage key={i} object={item.object}
            tone={index ? 'secondary' : 'primary'} size={count > 12 ? 34 : 26} />)}
        </View>
        {count > 12 && <Text style={styles.label}>{count} {name}</Text>}
      </View>;
    })}</View></ProofWindow>

  </View>;
}
function DifferenceTape({ idle, start, change, solved, revealing, landed, writtenAnswer, attemptValue }: { idle: boolean; attemptValue?: string; writtenAnswer?: ReactNode; start: ContextGiven; change: ContextGiven; solved: boolean; revealing: boolean; landed: number }) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const total = start.count!, removed = change.count!;
  const tens = Math.floor(removed / 10) * 10;
  const first = tens || removed;
  const cut = !revealing || landed === 0 ? 0 : landed === 1 ? first : removed;
  const reduced = useReducedMotion();
  const removedFace = useAnimatedStyle(() => ({
    width: reduced ? `${100 * cut / removed}%` : withTiming(`${100 * cut / removed}%`, {duration: 200}),
  }));
  const entered = Number(attemptValue);
  const remainder = total - removed;
  const difference = entered - remainder;
  const showDifference = attemptValue !== undefined && Number.isFinite(entered) && difference !== 0;
  const widths = showDifference ? differenceBarWidths(width, total, remainder, entered) : undefined;
  const equation = cut > 0 ? `${total} − ${cut} = ${total - cut}` : `${total} − ${removed} = ?`;
  const modelID = revealing ? 'play-proof-model' : 'play-entry-model';
  return <View style={styles.model} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <View accessible={false} style={{ height: 26 * fontScale }} />
    <EntryBuild ready={width > 0} lead={Motion.lead}><View accessible accessibilityLabel={revealing ? equation : `${total} − ${removed} = ${attemptValue ?? '?'}`}
      nativeID={modelID} testID={modelID} style={[styles.strip, widths && { backgroundColor: 'white' }]}>
      <View style={[styles.segment, widths ? {width: widths.left} : {flex: remainder}, {backgroundColor: Quantity.teal.fill}]}>
        <StoryIdleCue active={idle}><Text maxFontSizeMultiplier={1.5} numberOfLines={1} adjustsFontSizeToFit style={styles.pieceLabel}>{solved ? total - removed : attemptValue ?? '?'}</Text></StoryIdleCue>
      </View>
      {widths && <View style={[styles.segment, {width: widths.delta, backgroundColor: Quantity.amber.fill}]}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.pieceLabel}>{Math.abs(difference)}</Text>
      </View>}
      <View style={[styles.segment, widths ? {width: widths.right} : {flex: removed}, {backgroundColor: Quantity.violet.fill}]}>
        <Animated.View style={[styles.cut, removedFace]} />
        <Text maxFontSizeMultiplier={1.5} numberOfLines={1} adjustsFontSizeToFit style={styles.pieceLabel}>−{removed}</Text>
      </View>
    </View></EntryBuild>
    {revealing ? <View nativeID={solved ? 'play-proof-equation' : undefined} testID={solved ? 'play-proof-equation' : undefined}><Caption strong>{equation}</Caption></View> : <View style={styles.equation}><Caption strong>{writtenAnswer ? `${total} − ${removed} =` : String(total)}</Caption>{writtenAnswer}</View>}
  </View>;
}

const styles = StyleSheet.create({
  equation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  model: { alignSelf: 'stretch', marginVertical: 8, gap: 6, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 12 },
  group: { flex: 1, alignItems: 'center', gap: 3 },
  pictures: { maxWidth: 155, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  label: { color: Ink.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  strip: { height: 64, flexDirection: 'row', gap: 4 },
  segment: { minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.piece, overflow: 'hidden' },
  cut: {position: 'absolute', right: 0, top: 0, bottom: 0, borderRadius: Radius.piece, backgroundColor: Quantity.violet.soft},
  pieceLabel: { color: Ink.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
});
