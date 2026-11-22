import { glide } from '@/utils/puzzle-motion';
import type { QuantityTaskModel } from '@/types/puzzle';
import type { PuzzleObject } from '@/types/puzzle-object';

export type CountingModel = Extract<QuantityTaskModel, { left: number }> & { object: PuzzleObject };

export function hasCountingAnimation(model: QuantityTaskModel): model is CountingModel {
  return (model.kind === 'join' || model.kind === 'take_away') && !!model.object && model.right > 0;
}

// Separate the starting groups. Each object keeps its slot on reset.
export function getCountingLayout(model: CountingModel) {
  const join = model.kind === 'join';
  const total = join ? model.left + model.right : model.left;
  const columns = Math.min(9, total);
  const gap = join ? 38 : 0;
  const pitch = Math.min(58, (284 - gap) / columns);
  const rows = Math.ceil(total / columns);
  const height = Math.max(92, rows * pitch + 14);
  const size = pitch - 3;
  const pieces = Array.from({ length: total }, (_, i) => {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, total - row * columns);
    const x = (300 - gap - (inRow - 1) * pitch) / 2 + (i % columns) * pitch;
    const y = height / 2 + (row - (rows - 1) / 2) * pitch;
    const moving = join ? i >= model.left : i >= model.left - model.right;
    return { x: x + (join && moving ? gap : 0), y, endX: x, endY: moving && !join ? -size : y,
      size,
      turn: moving ? (join ? i - model.left : total - 1 - i) : -1,
      primary: join ? !moving : moving };
  });
  return { pieces, size, height };
}

export type CountingPiece = ReturnType<typeof getCountingLayout>['pieces'][number];

export function getPiecePosition(piece: CountingPiece, time: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, time - piece.turn));
  const rest = { x: piece.x, y: piece.y, angle: 0, squash: 0, opacity: 1, scale: 1 };
  if (piece.turn < 0 || t === 0) return rest;
  if (t === 1) return { ...rest, x: piece.endX, y: piece.endY, opacity: piece.endY < 0 ? 0 : 1 };

  const joining = piece.endY === piece.y;
  const dip = Math.sin(Math.PI * glide(t / .19));
  if (!joining) {
    // Keep the exit local so a star in a lower row never crosses another count.
    const flight = Math.max(0, Math.min(1, (t - .15) / .73));
    const rise = flight * flight * Math.min(piece.size * .76, piece.y * .64);
    const fade = glide((flight - .38) / .62);
    return { x: piece.x + piece.size * .19 * Math.sin(Math.PI * flight),
      y: piece.y + piece.size * .08 * dip - rise,
      angle: -8 * dip + 24 * flight, squash: .11 * dip, opacity: 1 - fade, scale: 1 - .48 * fade };
  }

  const travel = glide((t - .15) / .65);
  const arc = 4 * travel * (1 - travel);
  const headroom = Math.max(0, piece.y - piece.size / 2 - 2);
  const landing = Math.sin(Math.PI * glide((t - .80) / .20));
  return { x: piece.x + 3 * dip + (piece.endX - piece.x) * travel,
    y: piece.y - Math.min(piece.size * .29, headroom) * arc + piece.size * .065 * (dip + landing),
    angle: 6 * dip - 11 * arc, squash: .09 * dip + .10 * landing, opacity: 1, scale: 1 };
}
