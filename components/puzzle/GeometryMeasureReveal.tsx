import { ProofWindow } from './counting/ProofWindow';
import { canSnapshotModel } from './counting/useModelPaint';
import { useInitialModelPaint } from './kit/useInitialModelPaint';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { UnitRunGlyph } from './kit/UnitRun';
import { ProofCaption } from './kit/Focus';
import { useRevealBeats } from './kit/useRevealBeats';
import { RevealSurface } from './kit/RevealSurface';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas, Group } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ProofMotion, Shape } from '@/constants/puzzle-theme';
import type { GeometryMeasurePuzzle } from '@/types/puzzle';
import { geometryMeasurement } from '@/utils/geometry-models';


function Row({ index, y, columns, unit, progress, complete }: { y: number; complete: boolean; index: number; columns: number; unit: number; progress: SharedValue<number> }) {
  const opacity = useDerivedValue(() => {
    const portion = Math.max(0, progress.value / columns - index);
    return complete ? 1 : .42 * Math.min(1, portion);
  });
  return <Group opacity={opacity}>
    <UnitRunGlyph x={Shape.space.seam / 2} width={columns * unit - Shape.space.seam} height={unit - Shape.space.seam} y={y + Shape.space.seam / 2} count={columns} />
  </Group>;
}

export function MeasureInk({ width, height, unit, progress, completedRows = 0, missing = false }: {
  width: number; height: number; unit: number; progress?: SharedValue<number>; completedRows?: number; missing?: boolean;
}) {
  return <Canvas accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
    {progress && Array.from({ length: height }, (_, i) =>
      <Row key={i} index={i} y={(missing ? height - i - 1 : i) * unit} columns={width} unit={unit} progress={progress} complete={i < completedRows} />)}
  </Canvas>;
}

export function GeometryMeasureReveal({ puzzle, measured, confirmPaint, viewportHeight, stacked, onSolutionShown, children }: {
  puzzle: GeometryMeasurePuzzle; measured: boolean; confirmPaint: () => Promise<boolean>; viewportHeight?: number; stacked?: boolean; marked: number; onSolutionShown: () => void;
  children: (progress: SharedValue<number>, done: boolean, second: SharedValue<number>, phase: number) => ReactNode;
}) {
  const { t } = useTranslation();
  const {fontScale} = useWindowDimensions();
  const { mode, width: w, height: h, other } = puzzle.payload;
  const { total, equation } = geometryMeasurement(puzzle);
  const area = mode === 'area' || mode === 'missing_area';
  const missing = mode === 'missing_perimeter';
  const corners = (w: number, h: number) => [w, w + h, 2 * w + h, 2 * (w + h)];
  const rowBatch = h > 5 ? 2 : 1;
  const rowsAt = (step: number) => Math.min(h, step * rowBatch);
  const stops = area ? Array.from({ length: Math.ceil(h / rowBatch) }, (_, i) => rowsAt(i + 1) * w) : missing ? [total, total + 1, total + 2] :
    [...corners(w, h), ...(other ? corners(other.width, other.height).map(n => total + n) : [])];
  const beats = useRevealBeats(measured ? stops.length : null, { awaitInitialPaint: canSnapshotModel, onDone: onSolutionShown, reducedSteps: true, minTotal: 0,
    lead: 50, step: mode === 'compare' ? ProofMotion.beat[300] : missing ? (n: number) => [1200, 600, 360][n] ?? 360 : ProofMotion.beat[360], hold: n => mode === 'compare' && n === stops.length ? ProofMotion.beat[300] : 0 });
  useInitialModelPaint(beats, measured && canSnapshotModel, confirmPaint);
  const { position, reduced, landed, settled } = beats;
  const distance = useDerivedValue(() => {
    const at = reduced ? landed : position.value, index = Math.floor(at);
    const from = stops[index - 1] ?? 0, to = stops[index] ?? from;
    return from + (at - index) * (to - from);
  });
  const first = useDerivedValue(() => Math.min(total, distance.value));
  const second = useDerivedValue(() => Math.max(0, distance.value - total));
  const units = (n: number) => t(n === 1 ? 'geometryModels.oneUnit' : 'geometryModels.manyUnits', { value: n });
  function caption(n: number, final: boolean) {
    const distance = stops[n - 1] ?? 0;
    if (final || n === stops.length && mode !== 'compare') {
      if (fontScale >= 2) return equation;
      if (mode === 'area') return `${w} × ${h} = ${t(total === 1 ? 'geometryModels.squareUnit' : 'geometryModels.squareUnits', { value: total })}`;
      if (mode === 'missing_area') return `${total} ÷ ${w} = ${units(h)}`;
      if (missing) return `${total} ÷ 2 − ${w} = ${units(h)}`;
      return equation;
    }
    if (area) return n === 0 ? '' : `${w} × ${distance / w} = ${distance}`;
    if (missing) return ['', `${w} + ? + ${w} + ?`, `${total} ÷ 2 = ${total / 2}`][n];
    if (!n) return '';
    // A comparison names only the finished totals, never a bare "A · 1".
    if (other && n % 4 !== 0) return '';
    const secondShape = other && n > 4;
    const sides = secondShape ? [other.width, other.height, other.width, other.height] : [w, h, w, h];
    const walked = sides.slice(0, secondShape ? n - 4 : n);
    const sum = walked.reduce((a, b) => a + b, 0);
    return (walked.length === 1 ? String(sum) : `${walked.join(' + ')} = ${sum}`);

  }
  useProofAnnouncement(beats, caption(landed, settled), true);
  const firstShare = other ? h / (h + other.height) : 1;
  const equationID = settled ? 'play-proof-equation' : undefined;
  const corner = landed % 4;
  const traceY = landed > 0 && (corner === 2 || corner === 3) ? 1 : 0;
  let focus = traceY;
  if (area) focus = mode === 'missing_area' ? 1 - rowsAt(landed) / h : rowsAt(landed) / h;
  else if (stacked && other) focus = landed > 4 ? firstShare + traceY * (1 - firstShare) : traceY * firstShare;
  const model = children(first, settled || (mode === 'missing_area' && landed === stops.length), second, area ? rowsAt(landed) : landed);
  return <RevealSurface beats={beats}><View nativeID="play-proof-model" testID="play-proof-model" collapsable={false}>{viewportHeight == null ? model : <ProofWindow height={viewportHeight} focus={focus}>{model}</ProofWindow>}</View>
    <View testID="geometry-measure-total" style={styles.caption}>
      <View nativeID={equationID} testID={equationID}><ProofCaption text={caption(landed, settled)} reserveTexts={[...stops.map((_, i) => caption(i + 1, false)), caption(0, false), caption(stops.length, true)]} /></View>
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({ caption: { paddingTop: 6 } });
