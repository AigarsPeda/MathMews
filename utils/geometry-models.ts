import type { GeometryMeasurePuzzle } from '@/types/puzzle';

export function geometryTarget(puzzle: GeometryMeasurePuzzle): number {
  const { mode, width, height, other } = puzzle.payload;
  if (mode === 'compare') {
    const delta = width + height - (other!.width + other!.height);
    return delta === 0 ? 2 : delta > 0 ? 0 : 1;
  }
  if (mode === 'missing_area' || mode === 'missing_perimeter') return height;
  return mode === 'area' ? width * height : 2 * (width + height);
}
export function checkGeometryAnswer(puzzle: GeometryMeasurePuzzle, value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value === geometryTarget(puzzle);
}
export function appendGeometryDigit(value: number | null, digit: number): number | null {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return value;
  const next = (value ?? 0) * 10 + digit;
  return next <= 999 ? next : value;
}
/** Clockwise unit edges; shared corners never count twice as edges. */
export function rectangleEdges(width: number, height: number) {
  return [
    ...Array.from({ length: width }, (_, i) => ({ x: i, y: 0, horizontal: true })),
    ...Array.from({ length: height }, (_, i) => ({ x: width, y: i, horizontal: false })),
    ...Array.from({ length: width }, (_, i) => ({ x: width - i - 1, y: height, horizontal: true })),
    ...Array.from({ length: height }, (_, i) => ({ x: 0, y: height - i - 1, horizontal: false })),
  ];
}

export function geometryMeasurement({ payload }: GeometryMeasurePuzzle) {
  const { mode, width, height, other } = payload;
  const area = mode === 'area' || mode === 'missing_area';
  const total = area ? width * height : 2 * (width + height);
  const otherTotal = other ? 2 * (other.width + other.height) : 0;
  let equation: string;
  switch (mode) {
    case 'area': equation = `${width} × ${height} = ${total}`; break;
    case 'missing_area': equation = `${total} ÷ ${width} = ${height}`; break;
    case 'missing_perimeter': equation = `${total} ÷ 2 − ${width} = ${height}`; break;
    case 'compare': equation = `${total} ${total === otherTotal ? '=' : total > otherTotal ? '>' : '<'} ${otherTotal}`; break;
    default: equation = `${width} + ${height} + ${width} + ${height} = ${total}`;
  }
  return { total, otherTotal, equation };
}

/** The count holds at a completed row or side. In a comparison, both pens share
 * the same distance and stop whenever either rectangle reaches a corner. */
export function measureStops({ payload }: GeometryMeasurePuzzle, marked: number) {
  const { width, height, mode, other } = payload;
  const corners = (w: number, h: number) => [w, w + h, 2 * w + h, 2 * (w + h)];
  const ends = mode === 'area' || mode === 'missing_area'
    ? Array.from({ length: height }, (_, row) => (row + 1) * width)
    : [...corners(width, height), ...(other ? corners(other.width, other.height) : [])];
  return [marked, ...new Set(ends.filter(end => end > marked).sort((a, b) => a - b))];
}

/** Position in grid units after tracing this many units clockwise from the upper left. */
export function perimeterPoint(width: number, height: number, distance: number) {
  'worklet';
  const s = Math.max(0, Math.min(distance, 2 * (width + height)));
  if (s <= width) return { x: s, y: 0 };
  if (s <= width + height) return { x: width, y: s - width };
  if (s <= 2 * width + height) return { x: 2 * width + height - s, y: height };
  return { x: 0, y: 2 * (width + height) - s };
}
