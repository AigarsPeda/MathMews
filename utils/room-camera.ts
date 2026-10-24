export function clampRoomCamera(x: number, y: number, scale: number, width: number, height: number) {
  'worklet';
  const maxX = (scale - 1) * width / 2, maxY = (scale - 1) * height / 2;
  return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)), scale };
}

export function pinchRoomCamera(start: { x: number; y: number; scale: number; focalX: number; focalY: number }, factor: number, focalX: number, focalY: number, width: number, height: number) {
  'worklet';
  const scale = Math.max(1, Math.min(3, start.scale * factor));
  const ratio = scale / start.scale;
  return clampRoomCamera(focalX + (start.x - start.focalX) * ratio, focalY + (start.y - start.focalY) * ratio, scale, width, height);
}

/** Fit the unchanged logical room above a fixed editing dock. Saved coordinates
 * and drag anchors must not change when selection or feedback changes height. */
export function roomEditingFrame(width: number, height: number, dockHeight: number, slotHeight: number, navigationHeight: number, toolbarHeight: number) {
  const overlap = Math.max(0, dockHeight - slotHeight - navigationHeight - 8);
  const scale = Math.min(1, Math.max(1, height - overlap - toolbarHeight) / Math.max(1, width));
  return { overlap, scale, y: (toolbarHeight - overlap) / 2 };
}
