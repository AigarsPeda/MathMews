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
