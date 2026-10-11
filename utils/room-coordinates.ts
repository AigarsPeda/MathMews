import type { RoomItemOffset } from '@/types/game';

export type RoomPoint = { x: number; y: number };

export function roomOffsetToPoint(offset: RoomItemOffset, width: number, height: number, size: number): RoomPoint {
  return { x: offset.x * Math.max(0, (width - size) / 2), y: offset.y * Math.max(0, (height - size) / 2) };
}
