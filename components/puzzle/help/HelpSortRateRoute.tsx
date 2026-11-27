import { BottleRow } from '../bridge/Bottle';
import { RevealSurface } from '../kit/RevealSurface';
import type { RevealBeats } from '../kit/useRevealBeats';
import { RouteGridSurface, ROUTE_CELL, ROUTE_GAP } from '../RouteGridSurface';
import { amber, beatProgress, Digit, Piece, ProofLine, Slot, teal, useHelpBeats, useHelpCaption, violet } from './helpKit';
import type { OrderNumbersPuzzle, RatioTablePuzzle, RouteGridPuzzle } from '@/types/puzzle';
import { routeValue } from '@/utils/operations-reveal';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

type ProofProps<P> = { puzzle: P; height: number; onDone: () => void };

function BottleGroup({ size, label, beats, index }: { size: number; label: string; beats: RevealBeats; index: number }) {
  if (index > beats.landed) return <View style={styles.bottle} />;
  return <Animated.View entering={index ? FadeIn.duration(160) : undefined} style={styles.bottle}>
    <BottleRow count={1} size={size} />
    <Piece hue={violet} width="100%" height={44}><Digit size={24}>{label}</Digit></Piece>
  </Animated.View>;
}

export function HelpRatio({ puzzle, height, onDone }: ProofProps<RatioTablePuzzle>) {
  const { b, targetA } = puzzle.payload;
  const { t } = useTranslation();
  const beats = useHelpBeats(targetA - 1, onDone, 650, 320);
  const litres = (value: number) => t('jugSolution.litres', { value });
  const size = Math.min(118, Math.max(70, height - 126));
  return <RevealSurface beats={beats}><View style={styles.model}>
    <View style={styles.row}>{Array.from({ length: targetA }, (_, i) =>
      <BottleGroup key={i} index={i} label={litres(b)} size={size} beats={beats} />)}</View>
    <Piece hue={beats.landed === targetA - 1 ? amber : teal} width="100%" height={56}><Digit size={32}>{litres((1 + beats.landed) * b)}</Digit></Piece>
    <ProofLine equation={beats.settled ? `${targetA} × ${litres(b)} = ${litres(targetA * b)}` : undefined} />
  </View></RevealSurface>;
}

function SortTile({ n, index, rank, width, height, beats }: {
  n: number; index: number; rank: number; width: number; height: number; beats: RevealBeats;
}) {
  const { position, landed } = beats;
  const motion = useAnimatedStyle(() => {
    const progress = beatProgress(position.value, rank + 1);
    // Cross between the rows so the moving digit stays clear of both sets of tiles.
    const across = Math.min(1, Math.max(0, progress * 3 - 1));
    const down = Math.min(1, progress * 3) + Math.max(0, progress * 3 - 2);
    return { transform: [{ translateX: (index + (rank - index) * across) * (width + 4) },
      { translateY: down * (height + 4) }] };
  }, [index, rank, width, height, position]);
  return <Animated.View style={[styles.at, motion]}><Piece width={width} height={height} style={styles.flat} hue={rank <= landed ? teal : violet}><Digit size={32}>{n}</Digit></Piece></Animated.View>;
}

export function HelpOrder({ puzzle, height, onDone }: ProofProps<OrderNumbersPuzzle>) {
  const { numbers, correctOrder } = puzzle.payload;
  const { t } = useTranslation();
  const beats = useHelpBeats(numbers.length, onDone, 760, 400, 680);
  useHelpCaption(beats.settled ? null : t(`visualHelp.examples.order_sort.${beats.landed ? 'next' : 'first'}`));
  const [width, setWidth] = useState(0);
  const tileHeight = Math.min(76, Math.max(48, (height - 8) / 3));
  const tileWidth = (width - (numbers.length - 1) * 4) / numbers.length;
  return <RevealSurface beats={beats}><View style={styles.model}>
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: 3 * tileHeight + 8 }}>
      {width > 0 && correctOrder.map((n, i) => <Slot key={n} width={tileWidth} height={tileHeight}
        style={[styles.flat, { position: 'absolute', bottom: 0, left: i * (tileWidth + 4) }]} />)}
      {width > 0 && numbers.map((n, i) => <SortTile key={n} n={n} index={i} rank={correctOrder.indexOf(n)}
        width={tileWidth} height={tileHeight} beats={beats} />)}
    </View>
    <ProofLine equation={beats.settled ? correctOrder.join(' < ') : undefined} />
  </View></RevealSurface>;
}

export function HelpRoute({ puzzle, path, onDone }: Omit<ProofProps<RouteGridPuzzle>, 'height'> & { path: number[] }) {
  const { cells, columns, start } = puzzle.payload;
  const { values } = routeValue(puzzle.payload, path);
  const [width, setWidth] = useState(0);
  const beats = useHelpBeats(path.length - 1, onDone, 850, 440);
  const [first, second] = path.slice(1).map(i => cells[i]!);
  const cellWidth = (width - ROUTE_GAP * (columns - 1)) / columns;
  const rows = Math.ceil(cells.length / columns);
  return <RevealSurface beats={beats}><View style={styles.model}>
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: rows * ROUTE_CELL + (rows - 1) * ROUTE_GAP }}>
      <RouteGridSurface width={width} columns={columns} count={cells.length} path={path.slice(0, beats.landed + 1)} />
      {width > 0 && cells.map((cell, i) => <View key={i} style={[styles.cell, { width: cellWidth, height: ROUTE_CELL,
        left: i % columns * (cellWidth + ROUTE_GAP), top: Math.floor(i / columns) * (ROUTE_CELL + ROUTE_GAP) }]}>
        <Digit size={28}>{cell ? `${cell.operator}${cell.operand}` : start}</Digit>
      </View>)}
    </View>
    <Piece width="100%" height={58} hue={beats.landed === path.length - 1 ? amber : violet}><Digit size={36}>{values[beats.landed]}</Digit></Piece>
    <ProofLine equation={beats.settled ? `(${start} ${first.operator} ${first.operand}) ${second.operator} ${second.operand} = ${values.at(-1)}` : undefined} />
  </View></RevealSurface>;
}

const styles = StyleSheet.create({
  model: { gap: 12, alignSelf: 'stretch', paddingHorizontal: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  flat: { borderBottomWidth: 0 },
  bottle: { flex: 1, alignItems: 'center', gap: 8 },
  at: { position: 'absolute', left: 0, top: 0 },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
