import type { EverydayModel } from '@/types/everyday';

export type ShapeModel = Extract<EverydayModel, { kind: 'shapes' }>;
type Point = { x: number; y: number };
export type Segment = { from: Point; to: Point };

const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function shapeGeometry(sides: number, rectangle: boolean) {
  const vertices = rectangle
    ? [{ x: 10, y: 35 }, { x: 130, y: 35 }, { x: 130, y: 105 }, { x: 10, y: 105 }]
    : Array.from({ length: sides }, (_, i) => {
        const angle = i * 2 * Math.PI / sides - Math.PI / 2;
        return { x: 70 + 58 * Math.cos(angle), y: 70 + 58 * Math.sin(angle) };
      });
  // Centre the visible bounds as well as the canvas (especially noticeable for triangles).
  const ys = vertices.map(point => point.y);
  const dy = 70 - (Math.min(...ys) + Math.max(...ys)) / 2;
  vertices.forEach(point => { point.y += dy; });
  const edges = vertices.map((from, i) => ({ from, to: vertices[(i + 1) % vertices.length] }));
  const midpoints = edges.map(edge => middle(edge.from, edge.to));
  // Opposite points in this alternating ring enumerate each mirror axis exactly once.
  const ring = vertices.flatMap((point, i) => [point, midpoints[i]]);
  const axes = rectangle
    ? [{ from: midpoints[0], to: midpoints[2] }, { from: midpoints[1], to: midpoints[3] }]
    : vertices.map((_, i) => ({ from: ring[i], to: ring[i + sides] }));
  return { edges, axes };
}
