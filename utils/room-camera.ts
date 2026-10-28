export function clampRoomCamera(x: number, y: number, scale: number, width: number, height: number) {
  'worklet';
  const maxX = (scale - 1) * width / 2, maxY = (scale - 1) * height / 2;
  return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)), scale };
}

/** Let the editor pan across any room area covered by its toolbar or dock. */
export function clampRoomEditingCamera(x: number, y: number, scale: number, width: number, height: number, overlap: number, toolbarHeight: number) {
  const camera = clampRoomCamera(x, y, scale, width, height);
  const visibleHeight = Math.max(1, height - overlap - toolbarHeight);
  const maxY = Math.max((scale - 1) * height / 2, (scale * width - visibleHeight) / 2, 0);
  return { ...camera, y: Math.max(-maxY, Math.min(maxY, y)) };
}

export function pinchRoomCamera(start: { x: number; y: number; scale: number; focalX: number; focalY: number }, factor: number, focalX: number, focalY: number, width: number, height: number) {
  'worklet';
  const scale = Math.max(1, Math.min(3, start.scale * factor));
  const ratio = scale / start.scale;
  return clampRoomCamera(focalX + (start.x - start.focalX) * ratio, focalY + (start.y - start.focalY) * ratio, scale, width, height);
}

/** Keep the room at the same zoom while centering it above the editing dock.
 * Saved coordinates and drag anchors must not change with the dock's height. */
export function roomEditingFrame(dockHeight: number, slotHeight: number, navigationHeight: number, toolbarHeight: number) {
  const overlap = Math.max(0, dockHeight - slotHeight - navigationHeight - 8);
  return { overlap, scale: 1, y: (toolbarHeight - overlap) / 2 };
}
