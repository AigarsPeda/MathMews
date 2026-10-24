import type { RoomPlacementFeedback } from '@/utils/room-item-placement';

/** Position lives in shared values. React only needs changed diagnostics or shape. */
export function sameRoomDragFeedback(a: RoomPlacementFeedback | undefined, b: RoomPlacementFeedback) {
  if (!a || a.candidate.instanceId !== b.candidate.instanceId || a.candidate.modelId !== b.candidate.modelId
    || a.candidate.heading !== b.candidate.heading || a.candidate.scale !== b.candidate.scale
    || a.candidate.collidable !== b.candidate.collidable || a.candidate.supportId !== b.candidate.supportId
    || a.candidate.wallAxis !== b.candidate.wallAxis || a.snapped !== b.snapped || a.access !== b.access
    || a.unsupportedSurfaceId !== b.unsupportedSurfaceId || a.boundaries.length !== b.boundaries.length
    || a.blockers.length !== b.blockers.length) return false;
  if (a.boundaries.some((edge, i) => edge !== b.boundaries[i])) return false;
  return a.blockers.every((blocker, i) => {
    const next = b.blockers[i];
    return blocker.instanceId === next.instanceId && blocker.boxes.length === next.boxes.length
      && blocker.boxes.every((box, j) => box.length === next.boxes[j].length
        && box.every((point, k) => point.every((value, axis) => value === next.boxes[j][k][axis])));
  });
}
