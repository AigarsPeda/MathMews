import { useModelStage } from '../kit/ModelStage';
import { useFirstQuantityEncounter } from '../counting/QuantityPractice';
import type { ProofViewport } from '@/components/puzzle/PlayProofCaption';
import { DenseLabel, useMeasuredLabels } from '@/components/puzzle/kit/DenseLayout';
import { EntryBuild, IdleHint } from '@/components/puzzle/kit/PracticeAffordances';
import { Quantity, Radius, Shape } from '@/constants/puzzle-theme';
import { type DecimalPlaceState, type DecimalUnit } from '@/utils/decimal-models';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

const gap = Shape.space.seam;
const defaultZoneGap = 10;
const inset = 7;
const cube = 28;
const whole = 54;
const hundredthsPerRow = 5;

type Point = { x: number; y: number };
type Preview = { state: DecimalPlaceState; progress: SharedValue<number> };
type Exchange = { unit: DecimalUnit; label: string; onPress: () => void; disabled: boolean };
type Layout = { width: number; height: number; across: number; slot: number; zoneWidth: number; offsetY?: number };

function pieceAt(index: number, { width, height, across, slot, zoneWidth, offsetY = 0 }: Layout): Point {
  const groupWidth = across * slot - gap;
  const row = Math.floor(index / across);
  return { x: (zoneWidth - groupWidth) / 2 + (slot - width - gap) / 2 + index % across * slot,
    y: offsetY + inset + row * (height + gap) };
}

function face(unit: DecimalUnit, layout: Layout, traced = false) {
  const paint = traced || unit === 'ones' ? Quantity.amber : unit === 'hundredths' ? Quantity.violet : Quantity.teal;
  const borderRadius = Shape.tile(layout.width);
  return <View style={{ width: layout.width, height: layout.height, borderRadius, backgroundColor: paint.edge, paddingBottom: Shape.lip }}>
    <View style={{ flex: 1, borderRadius, backgroundColor: paint.fill }} />
  </View>;
}

function IncomingPiece({ unit, layout, at, progress }: { unit: DecimalUnit; layout: Layout; at: Point; progress: SharedValue<number> }) {
  const motion = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ scale: .88 + .12 * progress.get() }] }));
  return <Animated.View style={[styles.piece, { left: at.x, top: at.y }, motion]}>{face(unit, layout)}</Animated.View>;
}

function DecimalExchange({ loose, origin, destination, small, large, unit, larger, bundle, progress }: {
  loose: Point[]; origin: Point; destination: Point; small: Layout; large: Layout;
  unit: DecimalUnit; larger: DecimalUnit; bundle: boolean; progress: SharedValue<number>;
}) {
  // Run the same exchange backwards when opening a rod into smaller pieces.
  const phase = useDerivedValue(() => {
    const elapsed = 1 - Math.cbrt(1 - Math.min(1, progress.get()));
    return bundle ? elapsed : 1 - elapsed;
  });
  const smallPieces = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - phase.get() / .35) }));
  const rod = useAnimatedStyle(() => {
    const at = bundle ? Math.min(1, Math.max(0, (phase.get() - .60) / .40)) : 1;
    return { opacity: Math.min(1, phase.get() / .35), transform: [
      { translateX: origin.x + (destination.x - origin.x) * at },
      { translateY: origin.y + (destination.y - origin.y) * at },
    ] };
  });
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Animated.View style={[StyleSheet.absoluteFill, smallPieces]}>
      {loose.map((at, index) => <View key={index} style={[styles.piece, { left: at.x, top: at.y }]}>
        {face(unit, small)}
      </View>)}
    </Animated.View>
    <Animated.View style={[styles.moving, rod]}>{face(larger, large)}</Animated.View>
  </View>;
}

type MatProps = {
  viewport?: ProofViewport | null;
  state: DecimalPlaceState; units: readonly DecimalUnit[]; controls?: (unit: DecimalUnit) => ReactNode;
  preview?: Preview; capacity?: DecimalPlaceState;
  trace?: { unit: DecimalUnit; index: number }; exchangeUnit?: 'hundredths' | 'tenths'; exchange?: Exchange;
  onAdd?: (unit: DecimalUnit) => void; onRemove?: (unit: DecimalUnit) => void;
  enter?: boolean; interacted?: boolean;
};

export function DecimalPlaceMat(props: MatProps) {
  return props.exchangeUnit === 'hundredths' && props.units.length === 2 && props.units.includes('tenths') && !props.onAdd
    ? <ExchangeMat {...props} /> : <DecimalMatContents {...props} />;
}

function ExchangeMat(props: MatProps) {
  const stage = useModelStage();
  return <DecimalMatContents {...props} fullWidthExchange stageHeight={props.viewport?.availableModelHeight || stage.height} laneHeight={stage.height} />;
}

function DecimalMatContents({ state, units, controls, preview, capacity = state, trace, exchangeUnit,
  exchange, onAdd, onRemove, viewport, fullWidthExchange = false, stageHeight = 0, laneHeight = stageHeight, enter = false, interacted = true,
}: MatProps & { fullWidthExchange?: boolean; stageHeight?: number; laneHeight?: number }) {
  const firstEncounter = useFirstQuantityEncounter('decimal-exchange', !!exchange && !exchange.disabled);
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [measuredWidth, setWidth] = useState(0);
  const field = measuredWidth || viewport?.innerWidth || screenWidth - 48;
  const zoneGap = fullWidthExchange ? gap : defaultZoneGap;
  const names = units.map(unit => t(`decimalModels.${unit}`));
  const labels = useMeasuredLabels(names, 'title');
  const minimumColumn = 3 * (cube + gap) - gap + 2 * inset;
  const wideLabels = viewport?.fontScale && viewport.fontScale >= 1.5 ? 138 : Math.min(140, labels.width + 12);
  const perRow = Math.min(units.length, Math.max(1, Math.floor((field + zoneGap) / (Math.max(minimumColumn, wideLabels) + zoneGap))));
  const column = (field + zoneGap) / perRow - zoneGap;
  const twoZones = units.length === 2 && units.includes('tenths') && units.includes('hundredths');
  const hundredthsRoom = twoZones && perRow === 2 ? field - zoneGap - Math.max(minimumColumn, wideLabels) : column;
  const fiveTilesWidth = hundredthsPerRow * (cube + gap) - gap + 2 * inset;
  const preferredWidth = fullWidthExchange ? Math.max(fiveTilesWidth, field * .55) : fiveTilesWidth;
  const hundredthsWidth = twoZones ? Math.max(column, Math.min(hundredthsRoom, preferredWidth)) : column;
  const tenthsWidth = twoZones && perRow === 2 ? field - zoneGap - hundredthsWidth : column;
  const tileColumns = Math.min(hundredthsPerRow, Math.max(1, Math.floor((hundredthsWidth - 2 * inset + gap) / (cube + gap))));
  const tileSize = Math.min(fullWidthExchange ? Infinity : cube, (hundredthsWidth - 2 * inset + gap) / tileColumns - gap);
  const groupedHundredths = twoZones;
  const headingHeight = Math.max(44, (labels.height || 22) + 12);
  const rows = Math.ceil(units.length / perRow);
  const cellColumns = (size: number, width = column) => Math.max(1, Math.min(6, Math.floor((width - 2 * inset + gap) / (size + gap))));
  const rodColumns = fullWidthExchange ? Math.max(1, Math.min(5, Math.floor((tenthsWidth - 2 * inset + gap) / (cube + gap)))) : 5;
  const rodWidth = Math.min(fullWidthExchange ? Infinity : cube, (tenthsWidth - 2 * inset + gap) / rodColumns - gap);
  const rodRows = Math.max(1, Math.ceil(capacity.tenths / rodColumns));
  const rodRoom = (laneHeight || viewport?.availableModelHeight || 380) / rows - headingHeight - 2 * inset;
  const rodHeight = fullWidthExchange ? Math.max(cube, Math.min(rodWidth * 4, (rodRoom + gap) / rodRows - gap)) : Math.max(cube, Math.min(56, (rodRoom + gap) / rodRows - gap));
  const layouts: Record<DecimalUnit, Layout> = {
    ones: { width: whole, height: whole, slot: whole + gap, across: cellColumns(whole), zoneWidth: column },
    tenths: { width: rodWidth, height: rodHeight, slot: rodWidth + gap, across: rodColumns, zoneWidth: tenthsWidth },
    hundredths: groupedHundredths
      ? { width: tileSize, height: tileSize, slot: tileSize + gap, across: tileColumns, zoneWidth: hundredthsWidth }
      : { width: cube, height: cube, slot: cube + gap, across: cellColumns(cube, hundredthsWidth), zoneWidth: hundredthsWidth },
  };
  const counts = units.map(unit => {
    const layout = layouts[unit];
    const total = state.tenths * 10 + state.hundredths;
    const reserved = unit === 'hundredths' ? total % 10 + 10 : Math.floor(total / 10);
    const count = fullWidthExchange ? reserved : Math.max(state[unit], preview?.state[unit] ?? 0);
    const minimum = exchange?.unit === unit || onRemove ? 44 : 24;
    return count ? Math.max(minimum, pieceAt(count - 1, layout).y + layout.height + inset) : minimum;
  });
  const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(...counts.slice(row * perRow, (row + 1) * perRow)));
  if (fullWidthExchange) {
    const rowBudget = (stageHeight - 16 - (rows - 1) * zoneGap) / rows - headingHeight;
    rowHeights.forEach((height, row) => {
      rowHeights[row] = Math.max(height, rowBudget);
      for (const unit of units.slice(row * perRow, (row + 1) * perRow)) {
        const laneBudget = (laneHeight - 16 - (rows - 1) * zoneGap) / rows - headingHeight;
        layouts[unit].offsetY = Math.max(0, Math.min(rowHeights[row], laneBudget) - counts[units.indexOf(unit)]) / 2;
      }
    });
  }
  const positionOf = (unit: DecimalUnit, index: number): Point => {
    const columnIndex = units.indexOf(unit);
    const row = Math.floor(columnIndex / perRow);
    const local = pieceAt(index, layouts[unit]);
    const precedingWidth = units.slice(row * perRow, columnIndex)
      .reduce((sum, preceding) => sum + layouts[preceding].zoneWidth + zoneGap, 0);
    return { x: precedingWidth + local.x,
      y: rowHeights.slice(0, row).reduce((sum, height) => sum + headingHeight + height + zoneGap, 0) + headingHeight + local.y };
  };
  const larger = exchangeUnit === 'tenths' ? 'ones' : 'tenths';
  const moving = exchangeUnit && preview && units.includes(exchangeUnit) && units.includes(larger)
    && state[exchangeUnit] !== preview.state[exchangeUnit];
  const bundle = Boolean(moving && preview && exchangeUnit && state[exchangeUnit] > preview.state[exchangeUnit]);
  const bundleFirstTen = bundle && exchangeUnit === 'hundredths' && groupedHundredths;
  const groupStart = moving && preview && exchangeUnit && !bundleFirstTen
    ? Math.min(state[exchangeUnit], preview.state[exchangeUnit]) : 0;
  const packAt = moving && preview ? positionOf(larger, Math.min(state[larger], preview.state[larger])) : undefined;
  const remainderOffset = bundleFirstTen ? pieceAt(10, layouts.hundredths).y - pieceAt(0, layouts.hundredths).y : 0;
  const remainderMotion = useAnimatedStyle(() => {
    const phase = 1 - Math.cbrt(1 - Math.min(1, preview?.progress.get() ?? 0));
    return { transform: [{ translateY: remainderOffset * Math.min(1, (1 - phase) / .24) }] };
  });
  return <View style={styles.board} collapsable={false} onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}>
    {labels.probe}
    <View style={[styles.columns, { gap: zoneGap }]}>{units.map((unit, index) => {
      const layout = layouts[unit];
      const count = state[unit];
      const next = preview?.state[unit] ?? count;
      const stationary = moving ? Math.min(count, next) : count;
      const unitName = names[index];
      const exchangeTarget = exchange?.unit === unit ? exchange : undefined;
      const action = exchangeTarget ? exchangeTarget.onPress : count && onRemove ? () => onRemove(unit) : undefined;
      const addLabel = t('decimalModels.addUnit', { unit: unitName });
      const removeLabel = t('decimalModels.removeUnit', { unit: unitName });
      return <View key={unit} style={[styles.zone, { width: layout.zoneWidth }, unit === 'hundredths' && styles.looseZone]}>
        <Pressable style={[styles.header, { height: headingHeight }]} disabled={!onAdd} accessibilityRole={onAdd ? 'button' : undefined}
          accessible={!!onAdd} accessibilityLabel={onAdd ? addLabel : undefined} onPress={onAdd ? () => onAdd(unit) : undefined}>
          <DenseLabel role="title" maxFontSizeMultiplier={1.8} adjustsFontSizeToFit minimumFontScale={.65}>{unitName}</DenseLabel>
        </Pressable>
        <Pressable collapsable={false} style={{ height: fullWidthExchange ? rowHeights[Math.floor(index / perRow)] : counts[index] }} disabled={!action || exchangeTarget?.disabled}
          testID={exchangeTarget ? 'decimal-exchange' : undefined} accessibilityRole={action ? 'button' : 'image'} onPress={action}
          accessible accessibilityLabel={exchangeTarget?.label ?? t('decimalModels.unitCount', { count, unit: unitName })}
          accessibilityHint={exchangeTarget ? t('decimalModels.unitCount', { count, unit: unitName }) : undefined}
          accessibilityActions={onRemove && count ? [{ name: 'remove', label: removeLabel }] : undefined}
          onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'remove') onRemove?.(unit); }}>
          <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={[StyleSheet.absoluteFill, unit === 'hundredths' && bundleFirstTen && remainderMotion]}>
            {Array.from({ length: stationary }, (_, pieceIndex) => {
              const at = pieceAt(pieceIndex, layout);
              const piece = face(unit, layout, trace?.unit === unit && trace.index === pieceIndex);
              return <Animated.View key={pieceIndex} style={[styles.piece, { left: at.x, top: at.y }]} exiting={onRemove ? FadeOut.duration(120) : undefined}>
                {enter ? <EntryBuild index={index * 2 + pieceIndex}>{piece}</EntryBuild> : piece}
              </Animated.View>;
            })}
            {!moving && preview && next > count ? Array.from({ length: next - count }, (_, pieceIndex) => <IncomingPiece key={`in-${pieceIndex}`}
              unit={unit} at={pieceAt(count + pieceIndex, layout)} layout={layout} progress={preview.progress} />) : null}
          </Animated.View>
        </Pressable>
        {controls?.(unit)}
      </View>;
    })}</View>
    {moving && preview && exchangeUnit && packAt ? <DecimalExchange
      loose={Array.from({ length: 10 }, (_, i) => positionOf(exchangeUnit, groupStart + i))}
      origin={positionOf(exchangeUnit, 0)} destination={packAt} small={layouts[exchangeUnit]} large={layouts[larger]}
      unit={exchangeUnit} larger={larger} bundle={bundle} progress={preview.progress} /> : null}
    {exchange && exchangeUnit && !exchange.disabled && !interacted ? <IdleHint movable firstEncounter={firstEncounter}
      from={positionOf(exchange.unit, Math.max(0, state[exchange.unit] - 1))}
      to={positionOf(exchange.unit === larger ? exchangeUnit : larger, 0)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  board: { alignSelf: 'stretch' },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  zone: { backgroundColor: Quantity.teal.soft, borderRadius: Radius.tray },
  looseZone: { backgroundColor: Quantity.violet.soft },
  header: { paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute' },
  moving: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
});
