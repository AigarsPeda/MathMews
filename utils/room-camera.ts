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
