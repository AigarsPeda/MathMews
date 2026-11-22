import type { EverydayModel } from '@/types/everyday';

export type BoxModel = Extract<EverydayModel, { kind: 'solid' }>;

const startDelay = .04;
const sweep = .64;
const drop = .22;

export function landedVolumeRows(progress: number, depth: number, height: number) {
  'worklet';
  const time = Math.max(0, Math.min(height, progress));
  const layer = Math.floor(time);
  const sinceFirstLanding = time - layer - startDelay - drop;
  const landed = Math.floor(sinceFirstLanding * depth / sweep + 1 + 1e-9);
  return layer * depth + Math.min(depth, Math.max(0, landed));
}

/** A row spans the width of the box. Fill the floor from back to front before going up. */
export function volumeLayers({ width, depth, height }: BoxModel) {
  const rows = Array.from({ length: height * depth }, (_, i) => {
    const layer = Math.floor(i / depth);
    const order = i % depth;
    const begins = layer + startDelay + sweep * order / depth;
    return { layer, depthIndex: depth - order - 1, begins, lands: begins + drop };
  });
  return { rows, perLayer: width * depth, total: width * depth * height };
}
