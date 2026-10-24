/** Authored camera moves and comic holds, shared by export and visual QA. */
import sharp from 'sharp';
import path from 'node:path';

export const FILM_KINDS = ['bridge', 'book', 'loom', 'clock', 'balloon', 'sorter', 'boat', 'fountain', 'beacon', 'trophy'];
export const FRAME_COUNT = 48;
export const MOVIE_SIZE = { width: 512, height: 448 };
const cache = new Map();
const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

// The wide shot establishes the physical gag. The close shot lets the reaction
// own the ending. Peripheral scenery can leave the shot; the cat stays inside.
const endings = {
  bridge: { center: [322, 300], zoom: 1.65, push: [.68, .9] },
  book: { center: [310, 309], zoom: 1.85, push: [.76, .9] },
  loom: { center: [258, 314], zoom: 1.75, push: [.75, .93] },
  clock: { center: [280, 290], zoom: 1.65, push: [.79, .93] },
  balloon: { center: [275, 218], zoom: 1.22, push: [.42, .75] },
  sorter: { center: [203, 297], zoom: 1.8, push: [.77, .94] },
  boat: { center: [218, 294], zoom: 1.65, push: [.8, .95] },
  fountain: { center: [265, 290], zoom: 1.45, push: [.64, .76] },
  beacon: { center: [266, 271], zoom: 1.42, push: [.71, .93] },
  trophy: { center: [180, 270], zoom: 1.85, push: [.78, .94] },
};

export function filmDelays(kind) {
  const holds = {
    bridge: [[8, 180], [30, 140], [37, 100]],
    book: [[12, 200], [36, 180], [41, 160]],
    loom: [[10, 220], [36, 160], [42, 100]],
    clock: [[17, 180], [37, 280], [42, 140]],
    balloon: [[11, 220], [29, 180], [40, 120]],
    sorter: [[7, 220], [28, 180], [40, 120]],
    boat: [[13, 200], [31, 160], [42, 140]],
    fountain: [[29, 160], [33, 220], [35, 180]],
    beacon: [[10, 140], [29, 180], [42, 220]],
    trophy: [[7, 200], [28, 160], [40, 220]],
  };
  const delays = Array.from({ length: FRAME_COUNT }, (_, n) => n === 0 ? 360 : n === 47 ? 0 : 70);
  for (const [frame, extra] of holds[kind]) delays[frame] += extra;
  delays[47] = 6000 - delays.reduce((a, b) => a + b, 0);
  return delays;
}

export async function filmShots(root, kind) {
  const key = `${root}:${kind}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    const bounds = [Infinity, Infinity, 0, 0];
    let width, height;
    for (let n = 0; n < FRAME_COUNT; n++) {
      const { data, info } = await sharp(path.join(root, kind, `frame-${String(n).padStart(2, '0')}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      width = info.width; height = info.height;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] < 128) continue;
        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
      }
    }
    const wideWidth = Math.min(width, Math.max(bounds[2] - bounds[0] + 36, (bounds[3] - bounds[1] + 36) * 512 / 448));
    const wide = { x: (bounds[0] + bounds[2]) / 2, y: (bounds[1] + bounds[3]) / 2, width: wideWidth };
    const end = endings[kind], sourceScale = width / 512;
    const close = { x: end.center[0] * sourceScale, y: end.center[1] * sourceScale, width: width / end.zoom };
    return Array.from({ length: FRAME_COUNT }, (_, n) => {
      const u = smooth(...end.push, n / 47);
      const cropWidth = Math.round(wide.width + (close.width - wide.width) * u);
      const cropHeight = Math.round(cropWidth * 448 / 512);
      const centerX = wide.x + (close.x - wide.x) * u;
      const centerY = wide.y + (close.y - wide.y) * u;
      return { left: Math.max(0, Math.min(width - cropWidth, Math.round(centerX - cropWidth / 2))), top: Math.max(0, Math.min(height - cropHeight, Math.round(centerY - cropHeight / 2))), width: cropWidth, height: cropHeight };
    });
  })());
  return cache.get(key);
}

export async function composeFilmFrame(stage, actor, shot) {
  const { data, info } = await sharp(stage).composite([{ input: actor }]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(shot).resize(MOVIE_SIZE.width, MOVIE_SIZE.height).ensureAlpha().raw().toBuffer();
}
