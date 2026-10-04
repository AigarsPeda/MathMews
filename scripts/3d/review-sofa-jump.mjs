import { Buffer } from "node:buffer";
/** Preview the packed jump poses against both sofa orientations at room coordinates. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const cache = new Map();
function load(id) {
  const file = path.resolve(id.startsWith('@/') ? id.slice(2) + '.ts' : id);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: ref => /\.(png|webp)$/.test(ref) ? ref.slice(2) : load(ref) });
  return module.exports;
}
const { buildRoomActivity } = load('utils/room-activities.ts');
const { getCatJumpMotion } = load('constants/cat-room-motion.ts');
const { getPlacedDecorationDragSize } = load('constants/decoration-variants.ts');
const width = 640, height = 320, panel = 320, petSize = 120;
const variants = ['sofaA', 'sofaB'];
const rooms = variants.map((decorationId, rotationIndex) => ({ width: panel, height, petSize, sizeScale: 1,
  homeOffset: { x: 0, y: .5 }, decorations: [{ decorationId: 'sofaA', rotationIndex, instanceId: 'sofa', scale: 1.6, offset: { x: 0, y: 0 } }],
  toys: [], ownedToyIds: [], hungry: false, asleep: false }));
const plans = rooms.map(room => buildRoomActivity(room, 0, 'sofaSit'));
const sofas = await Promise.all(rooms.map(async (room, i) => sharp(`assets/3d/decoration/${variants[i]}.png`)
  .resize(Math.round(getPlacedDecorationDragSize(room.decorations[0]))).png().toBuffer()));
const frames = [], stills = [];
const poseCache = new Map();
async function pose(clip, index) {
  const key = `${clip}/${index}`;
  if (!poseCache.has(key)) {
    const page = Math.floor(index / 12), cell = index % 12;
    poseCache.set(key, await sharp(`assets/3d/cat-pages/cat-orange-${clip}-${String(page).padStart(2, '0')}.webp`)
      .extract({ left: cell % 4 * 384, top: Math.floor(cell / 4) * 384, width: 384, height: 384 }).png().toBuffer());
  }
  return poseCache.get(key);
}
for (let frame = 0; frame < 72; frame++) {
  const on = frame < 36, local = frame % 36, t = Math.min(1, local / 24), clip = on ? 'jumpOn' : 'jumpOff';
  const overlay = [];
  for (let i = 0; i < rooms.length; i++) {
    const size = Math.round(getPlacedDecorationDragSize(rooms[i].decorations[0]));
    overlay.push({ input: sofas[i], left: i * panel + Math.round((panel - size) / 2), top: Math.round((height - size) / 2) });
    const seat = plans[i].steps[1], from = on ? plans[i].sofaApproach : seat.position, to = on ? seat.position : plans[i].sofaApproach;
    const jump = getCatJumpMotion(from.y, to.y, petSize);
    const time = t * 900, progress = Math.max(0, Math.min(1, (time - jump.prepareMs) / jump.flightMs));
    let y = from.y;
    if (progress <= .5) { const u = progress * 2; y += (jump.apexY - from.y) * (1 - (1 - u) ** 2); }
    else { const u = (progress - .5) * 2; y = jump.apexY + (to.y - jump.apexY) * u ** 2; }
    const x = from.x + (to.x - from.x) * progress;
    const scale = on ? 1 + (seat.scale - 1) * progress : seat.scale + (1 - seat.scale) * progress;
    const cell = Math.round(Math.floor(petSize * .9) * scale);
    overlay.push({ input: await sharp(await pose(clip, Math.min(23, Math.floor(t * 24)))).resize(cell).png().toBuffer(),
      left: Math.round(i * panel + panel / 2 + x - cell / 2), top: Math.round(height / 2 + y + petSize * .05 * scale - cell / 2) });
  }
  const label = Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#FFF5EB"/><g font-family="Arial" font-size="16" fill="#454852" text-anchor="middle"><text x="160" y="30">Jump ${on ? 'onto' : 'off'} the sofa</text><text x="480" y="30">Opposite sofa orientation</text></g></svg>`);
  const png = await sharp(label).composite(overlay).png().toBuffer();
  frames.push(await sharp(png).ensureAlpha().raw().toBuffer());
  if ([3, 11, 26, 39, 47, 62].includes(frame)) stills.push(png);
}
await sharp(Buffer.concat(frames), { raw: { width, height: height * frames.length, channels: 4, pageHeight: height } })
  .gif({ loop: 0, delay: 40, effort: 7, dither: .3 }).toFile('docs/art/cat-sofa-jump.gif');
await sharp({ create: { width: width * 3, height: height * 2, channels: 4, background: '#FFF5EB' } })
  .composite(stills.map((input, i) => ({ input, left: i % 3 * width, top: Math.floor(i / 3) * height }))).png().toFile('/tmp/brainpet-sofa-jump-poses.png');
console.log('Created docs/art/cat-sofa-jump.gif using packed poses, room planner coordinates, and runtime flight timing.');
