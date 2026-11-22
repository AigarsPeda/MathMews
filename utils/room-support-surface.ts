export type ItemSurface = {
  min: number[];
  max: number[];
  footprint?: number[][];
  kind?: 'seat' | 'top' | 'book';
};

export type SurfaceUse = 'book' | 'soft' | 'hard';

export function acceptsSurfaceItem(surface: ItemSurface, use?: SurfaceUse) {
  if (surface.kind === 'book') return use === 'book';
  if (surface.kind === 'seat') return use === 'soft' || use === 'book';
  return true;
}

export function surfaceOutline(surface: ItemSurface) {
  return surface.footprint ?? [[surface.min[0], surface.min[2]], [surface.max[0], surface.min[2]],
    [surface.max[0], surface.max[2]], [surface.min[0], surface.max[2]]];
}

// Work in the support's own coordinates so rotation and scale do not
// change the fit. Margins are used only to steady an in-progress drag.
export function surfaceContains(surface: ItemSurface, x: number, z: number, padX = 0, padZ = 0) {
  // A closed book still rests securely when the edge of its cover sticks out
  // slightly. This also lets two copies stack without pixel-perfect alignment.
  if (surface.kind === 'book') {
    padX += (surface.max[0] - surface.min[0]) * .08;
    padZ += (surface.max[2] - surface.min[2]) * .08;
  }
  const epsilon = .000001;
  if (x < surface.min[0] - padX - epsilon || x > surface.max[0] + padX + epsilon
    || z < surface.min[2] - padZ - epsilon || z > surface.max[2] + padZ + epsilon) return false;
  return !surface.footprint || surface.footprint.every(([ax, az], i, polygon) => {
    const [bx, bz] = polygon[(i + 1) % polygon.length];
    return (bx - ax) * (z - az) - (bz - az) * (x - ax)
      >= -Math.abs(bx - ax) * (padZ + epsilon) - Math.abs(bz - az) * (padX + epsilon);
  });
}
