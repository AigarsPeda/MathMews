import { useModelStage } from '../kit/ModelStage';
import { useFirstQuantityEncounter } from '../counting/QuantityPractice';
import type { ProofViewport } from '@/components/puzzle/PlayProofCaption';
import { EntryBuild, IdleHint } from '@/components/puzzle/kit/PracticeAffordances';
import { PuzzleText } from '../PuzzleText';
import { PlaceValuePiece } from './PlaceValuePiece';
import { DenseLabel, denseSpacing, useMeasuredLabels } from '@/components/puzzle/kit/DenseLayout';
import { Motion, Quantity, Radius } from '@/constants/puzzle-theme';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type Groups = { tens: number; ones: number };
type Point = { x: number; y: number };
type Move = { to: Point; through?: Point; beat: number; delay: number; duration: number; travel: number; position: SharedValue<number> };
export type PlaceValueTransition = { from: Groups; kind: 'join' | 'bundle' | 'split' };
const teal = Quantity.teal;
const gap = denseSpacing.loosePiece;

const zoneGap = 4;
const cube = 32;
const rodUnits = 4;

function Block({ at, size, rod, discrepancy, move, traced, removal, entry, fadeOnRemove }: {
  at: Point; size: number; rod?: boolean; discrepancy?: boolean; move?: Move; traced?: boolean; removal?: SharedValue<number>;
  entry?: number; fadeOnRemove?: boolean;
}) {
  const moving = useAnimatedStyle(() => {
    const progress = move ? Math.max(0, Math.min(1, move.position.get() - move.beat)) : 0;
    const time = 1 - Math.cbrt(1 - progress);
    const local = move ? Math.max(0, Math.min(1, (time * move.duration - move.delay) / move.travel)) : 0;
    const atProgress = 1 - (1 - local) ** 3;
    const from = move?.through && atProgress > .5 ? move.through : at;
    const to = move?.through && atProgress <= .5 ? move.through : move?.to ?? at;
    const phase = move?.through ? atProgress * 2 - Number(atProgress > .5) : atProgress;
    const removed = removal?.get() ?? 0;
    return { opacity: 1 - removed,
      transform: [{ translateX: from.x + (to.x - from.x) * phase }, { translateY: from.y + (to.y - from.y) * phase - 12 * removed }] };
  });
  const face = <PlaceValuePiece width={rod ? size * rodUnits : size} height={size} hue={discrepancy ? 'amber' : 'teal'} traced={traced} />;
  return <Animated.View style={[styles.block, moving]} exiting={fadeOnRemove ? FadeOut.duration(Motion.fade) : undefined}>
    {entry === undefined ? face : <EntryBuild index={entry}>{face}</EntryBuild>}
  </Animated.View>;
}

type MatActions = { kind: 'bundle' | 'split'; label: string; onPress: () => void };

export function PlaceValueMat({ tens, ones, pending, stock, addend, capacity, transition, landed = 0, position, reduced = false,
  exchangeMode, onColumn, onPiece, placement, exchangeAction, transfer, detailVisible, trace, checked = false, viewport,
  matHeight, laneHeight, total, submittedOnly = false, target: expected, enter = false, fadeOnRemove = false, interacted = true, compactOnes = false,
}: Groups & {
  viewport?: ProofViewport | null;
  pending?: Groups; stock?: Groups; addend?: Groups; capacity?: Groups;
  transition?: PlaceValueTransition; landed?: number; position?: SharedValue<number>;
  onColumn?: (unit: keyof Groups) => void; onPiece?: (unit: keyof Groups) => void; placement?: keyof Groups; exchangeAction?: MatActions;
  transfer?: { kind: 'join' | 'remove'; after: Groups; progress: SharedValue<number> };
  reduced?: boolean; exchangeMode?: 'bundle' | 'split';
  detailVisible?: boolean; trace?: { unit: keyof Groups; index: number; fromIndex?: number }; checked?: boolean;
  matHeight?: number; laneHeight?: number; total?: number; submittedOnly?: boolean; target?: Groups; enter?: boolean; fadeOnRemove?: boolean; interacted?: boolean; compactOnes?: boolean;
}) {
  const stage = useModelStage();
  const firstEncounter = useFirstQuantityEncounter('place-value-exchange', !!exchangeAction);
  const { t } = useTranslation();
  const [measuredWidth, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const names = { tens: t('placeValue.tens'), ones: t('placeValue.ones') };
  const measuredNames = useMeasuredLabels(Object.values(names), 'title');
  const minRodColumn = rodUnits * cube + 16;
  const looseInset = 16;
  const minLooseColumn = 2 * cube + looseInset + gap;
  const outerWidth = Math.max(measuredWidth || viewport?.innerWidth || 0, minRodColumn + minLooseColumn + zoneGap);
  const width = (viewport || measuredWidth ? outerWidth : 342) - zoneGap;
  const column = Math.max(minRodColumn, Math.min(width * .47, width - minLooseColumn));
  const looseColumns = Math.min(5, Math.floor((width - column - looseInset + gap) / (cube + gap)));

  const looseSlot = (index: number, count: number) => {
    const groupedAt = (checked ? capacity?.ones ?? count : count) - 10;
    return !(compactOnes && count < 10) && groupedAt >= 0 && index >= groupedAt ? index + Math.ceil(groupedAt / looseColumns) * looseColumns - groupedAt : index;
  };
  const rows = (groups: Groups, groupLoose = false) => Math.max(groups.tens, Math.ceil(
    (groupLoose && groups.ones ? looseSlot(groups.ones - 1, groups.ones) + 1 : groups.ones) / looseColumns,
  ));
  const rowCount = Math.max(4, rows(capacity ?? { tens, ones }, true));
  const headerHeight = Math.max(44, Math.min(48, measuredNames.height || 24) + 12);
  const totalHeight = total === undefined ? 0 : Math.ceil(32 * Math.min(fontScale, 1.5)) + 8;
  const bandHeight = headerHeight + totalHeight + (totalHeight ? 4 : 0);
  const available = matHeight ?? (viewport?.availableModelHeight || stage.height) - 16;
  const unitRoom = available > 0 ? (available - bandHeight - 14) / rowCount - gap : Infinity;
  const unit = Math.max(28, Math.min(unitRoom, (column - 16) / rodUnits,
    (width - column - looseInset - (looseColumns - 1) * gap) / looseColumns));
  const step = unit + gap;
  const rodWidth = rodUnits * unit;
  const rodX = (column - rodWidth) / 2;
  const looseWidth = looseColumns * unit + (looseColumns - 1) * gap;
  const looseStart = column + zoneGap;
  const looseX = looseStart + (width - column - looseWidth) / 2;
  const quantities = { tens, ones };
  const units = ['tens', 'ones'] as const;
  const difference = expected && (units.find(name => quantities[name] > expected[name])
    ?? units.find(name => quantities[name] < expected[name]));
  const slots = { ...quantities };
  if (expected && difference && !submittedOnly && slots[difference] < expected[difference]) slots[difference]++;
  const markedIndex = expected && difference ? Math.min(slots[difference] - 1, expected[difference]) : -1;
  const naturalHeight = Math.max(rowCount, rows(slots, true)) * step + 14;
  const height = Math.max(naturalHeight, available - bandHeight);
  const centerOffset = Math.max(0, Math.min(height, (laneHeight ?? stage.height - 16) - bandHeight) - naturalHeight) / 2;
  const base = (index: number, rod: boolean, offset = 0): Point => ({
    x: rod ? rodX : looseX + index % looseColumns * step,
    y: centerOffset + offset + 6 + Math.floor(index / (rod ? 1 : looseColumns)) * step,
  });
  const draw = (groups: Groups, offset = 0, tone?: 'incoming') => (['tens', 'ones'] as const).flatMap(unitName =>
    Array.from({ length: groups[unitName] }, (_, index) => <Block key={`${unitName}-${index}`} rod={unitName === 'tens'}
      at={base(unitName === 'ones' ? looseSlot(index, groups.ones) : index, unitName === 'tens', offset)} size={unit}
      discrepancy={unitName === difference && index === markedIndex}
      entry={enter && !transition && !tone ? (unitName === 'ones' ? groups.tens : 0) + index : undefined}
      fadeOnRemove={!tone && fadeOnRemove && (!transition || landed >= 2)}
      traced={!tone && trace?.unit === unitName && index >= (trace.fromIndex ?? trace.index) && index <= trace.index} />));
  const join = transition?.kind === 'join' && landed < 2 ? transition.from : undefined;
  const exchange = transition && transition.kind !== 'join' && landed < 2 ? transition : undefined;
  const bundle = exchange?.kind === 'bundle';
  const display = join ? { tens: landed ? tens : join.tens, ones: join.ones } : exchange?.from ?? { tens, ones };
  const transferring = Boolean(exchange && landed === 1 && !reduced);
  const staticGroups = transfer?.kind === 'remove' ? transfer.after : exchange && transferring ? { tens: Math.min(tens, exchange.from.tens), ones: Math.min(ones, exchange.from.ones) }
    : join ? { tens: landed ? tens : join.tens, ones: landed ? 0 : join.ones } : display;
  const source = addend;
  const sourceOffset = stock ? rows(stock) * step + 14 : height;
  const data = { tens, ones };
  const motion = transfer ? (['tens', 'ones'] as const).flatMap(name => {
    const rod = name === 'tens';
    const joining = transfer.kind === 'join';
    const count = Math.abs(transfer.after[name] - data[name]);
    return Array.from({ length: count }, (_, index) => {
      const start = transfer.after[name] + index;
      const destination = data[name] + index;
      const sourceIndex = (addend?.[name] ?? 0) - (pending?.[name] ?? 0) + index;
      const from = joining ? base(sourceIndex, rod, sourceOffset) : base(rod ? start : looseSlot(start, ones), rod);
      const to = joining ? base(rod ? destination : looseSlot(destination, transfer.after.ones), rod) : from;
      return <Block key={`proof-${name}-${index}`} rod={rod} at={from} size={unit} removal={joining ? undefined : transfer.progress}
        move={joining ? { to, beat: 0, delay: 0, duration: 1, travel: 1, position: transfer.progress } : undefined} />;
    });
  }) : null;
  const moveDuration = join ? Motion.step - Motion.stagger : Motion.step;
  const moving = (at: Point, to: Point, index: number, size: number, beat: number, pieces: number, rod = false, group = index) =>
    <Block key={`moving-${index}`} at={at} size={size} rod={rod} move={position && !reduced ? {
      to, beat, delay: group * Motion.stagger, duration: moveDuration + Math.max(0, pieces - 1) * Motion.stagger, travel: moveDuration, position,
    } : undefined} />;
  const fieldHeight = height;
  const extraHeight = addend && (pending || join) ? Math.max(0, centerOffset + sourceOffset + rows(addend) * step + 8 - fieldHeight)
    : 0;
  const shownIncoming = join && source ? (landed === 0
    ? <>{Array.from({ length: source.tens }, (_, index) => moving(base(index, true, sourceOffset), base(join.tens + index, true), index, unit, 0, source.tens, true))}
      {draw({ tens: 0, ones: source.ones }, sourceOffset, 'incoming')}</>
    : <>{Array.from({ length: join.ones }, (_, index) => moving(base(index, false), base(looseSlot(index, ones), false),
      index + source.ones, unit, 1, Math.ceil(source.ones / 5), false, 0))}
      {Array.from({ length: source.ones }, (_, index) => moving(base(index, false, sourceOffset), base(looseSlot(join.ones + index, ones), false),
        index, unit, 1, Math.ceil(source.ones / 5), false, Math.floor(index / 5)))}</>) : null;
  const exchangeKind = exchangeAction?.kind ?? (transition?.kind === 'bundle' || transition?.kind === 'split' ? transition.kind : exchangeMode);
  const loose = exchangeKind === 'bundle' ? Boolean(exchangeAction || !transition || exchange) : Boolean(!exchangeAction && !exchange && transition?.kind === 'split');
  const groupAt = loose ? base(looseSlot(Math.max(0, display.ones - 10), display.ones), false)
    : base(Math.max(0, display.tens - 1), true);
  const exchangeRows = Math.ceil(10 / looseColumns);
  const detail = exchangeKind && (loose ? display.ones >= 10 : display.tens > 0);
  const groupPosition = {
    left: groupAt.x - 4, top: groupAt.y - 4,
    width: loose ? looseWidth + 8 : rodWidth + 8,
    height: loose ? exchangeRows * step - gap + 8 : unit + 8,
  };
  const mats = <View collapsable={false} style={styles.mat}
    onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}>
    {measuredNames.probe}
    {(['tens', 'ones'] as const).map((name, i) => {
      const face = <View style={[styles.zone, i > 0 && styles.looseZone, placement === name && styles.activeZone,
        { height: headerHeight + fieldHeight + extraHeight }]} />;
      return <View key={name} pointerEvents="none" style={{ position: 'absolute', left: i === 0 ? 0 : looseStart, width: i === 0 ? column : width - column }}>
        {enter ? <EntryBuild ready={measuredWidth > 0} index={i * 3}>{face}</EntryBuild> : face}
      </View>;
    })}
    <View style={styles.headers}>
      {(['tens', 'ones'] as const).map((name, index) => {
        const available = index === 0 ? column : width - column;
        return <Pressable key={name} disabled={!onColumn || placement !== name} onPress={() => onColumn?.(name)}
          accessible accessibilityLabel={`${names[name]}: ${display[name]}`}
          accessibilityRole={onColumn ? 'button' : 'text'} style={[styles.header, { width: available, height: headerHeight }]}>
          <DenseLabel role="title" maxFontSizeMultiplier={1.8}>{names[name]}</DenseLabel>
        </Pressable>;
      })}
    </View>
    <View collapsable={false} style={{ height: fieldHeight + extraHeight }} accessible={!onPiece && !onColumn && !exchangeAction} accessibilityRole="image"
      accessibilityLabel={t('actionMotion.exchange', display)}>
      {detail && (detailVisible ?? true) ? <View pointerEvents="none" style={[styles.groupMark, groupPosition]} /> : null}
      {draw(expected ? slots : staticGroups)}
      {onPiece || onColumn ? (['tens', 'ones'] as const).map((name, index) => {
        const placing = placement === name;
        const action = placing ? onColumn : data[name] > 0 ? onPiece : undefined;
        if (!action) return null;
        const label = name === 'tens' ? (placing ? 'addTen' : 'removeTen') : (placing ? 'addOne' : 'removeOne');
        return <Pressable key={name}
          style={[styles.matTarget, { left: index === 0 ? 0 : looseStart, width: index === 0 ? column : width - column }]}
          accessibilityRole="button" accessibilityLabel={t(`placeValue.${label}`)} onPress={() => action(name)} />;
      }) : null}
      {motion}
      {exchangeAction ? <Pressable style={[styles.exchangeTarget, groupPosition, { height: Math.max(44, groupPosition.height), top: Math.max(0, groupPosition.top - 5) }]}
        testID={`place-value-${exchangeAction.kind}`} accessibilityRole="button" accessibilityLabel={exchangeAction.label} onPress={exchangeAction.onPress} /> : null}
      {exchangeAction && !interacted ? <IdleHint movable from={{ x: groupAt.x + (loose ? looseWidth : rodWidth) / 2, y: groupAt.y + unit / 2 }}
        to={{ x: loose ? rodX + rodWidth / 2 : looseX + unit / 2, y: groupAt.y + unit / 2 }} firstEncounter={firstEncounter} /> : null}
      {transferring && exchange ? Array.from({ length: 10 }, (_, index) => {
        const count = Math.max(ones, exchange.from.ones);
        const looseAt = base(looseSlot(count - 10 + index, count), false);
        const rod = base(Math.min(tens, exchange.from.tens), true);
        const joined = { x: rod.x + index * (rodWidth - unit) / 9, y: rod.y };
        const to = bundle ? joined : looseAt;
        return <Block key={index} at={bundle ? looseAt : joined} size={unit}
          move={position ? { to, beat: 1, delay: index * .018, duration: 1, travel: .82, position } : undefined} />;
      }) : null}
      {shownIncoming}
      {pending && checked && addend ? (['tens', 'ones'] as const).flatMap(name => {
        const travelling = transfer?.kind === 'join' ? transfer.after[name] - data[name] : 0;
        return Array.from({ length: pending[name] - travelling }, (_, index) => <Block key={`pending-${name}-${index}`}
          at={base(addend[name] - pending[name] + travelling + index, name === 'tens', sourceOffset)}
          size={unit} rod={name === 'tens'} />);
      }) : pending && transfer?.kind !== 'join' ? draw(pending, sourceOffset, 'incoming') : null}
    </View>
  </View>;
  const overview = total === undefined ? mats : <View style={{ alignSelf: 'stretch', gap: 4 }}>
    <PuzzleText maxFontSizeMultiplier={1.5} style={[styles.total, { height: totalHeight }]}>{t('placeValue.totalLabel')} {total}</PuzzleText>
    {mats}
  </View>;
  return viewport && minRodColumn + minLooseColumn + zoneGap > viewport.innerWidth ? <ScrollView horizontal><View style={{ width: outerWidth }}>{overview}</View></ScrollView> : overview;
}

const styles = StyleSheet.create({
  total: { textAlign: 'center', paddingVertical: 4, backgroundColor: teal.soft, borderRadius: Radius.piece, fontSize: 24, fontWeight: '800' },
  mat: { position: 'relative', alignSelf: 'stretch' },
  zone: { borderRadius: Radius.tray, backgroundColor: teal.soft },
  looseZone: { backgroundColor: '#EDF8F5' },
  activeZone: { backgroundColor: '#C9E9E8' },
  headers: { flexDirection: 'row', gap: zoneGap },
  header: { paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  matTarget: { position: 'absolute', top: 0, bottom: 0, minHeight: 44, minWidth: 44 },
  block: { transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 },
  groupMark: { position: 'absolute', borderRadius: Radius.piece, backgroundColor: '#C9E9E8' },
  exchangeTarget: { position: 'absolute', minWidth: 44, minHeight: 44 },
});
