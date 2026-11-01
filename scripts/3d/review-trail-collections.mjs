import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const requested = process.argv[2];
const collections = requested ? [requested] : ['easy', 'medium', 'hard'];
const output = 'docs/qa/trail-collections/2026-11-01';
await fs.mkdir(output, { recursive: true });
for (const collection of collections) {
  const prefix = { easy: 'e', medium: 'm', hard: 'h' }[collection];
  if (!prefix) throw new Error('Expected easy, medium or hard');
  const reference = `prototypes/trail-collections/references/${collection}.png`;
  const { width, height } = await sharp(reference).metadata();
  const rowBounds = {
    easy: [0, 280, 545, 795, 1060, 1340],
    medium: [35, 300, 570, 820, 1080, 1345],
    hard: [0, 325, 560, 805, 1080, 1345],
  }[collection];
  const pairs = [], gallery = [];
  for (let i = 0; i < 20; i++) {
    const id = `${prefix}${String(i + 1).padStart(2, '0')}`;
    const row = Math.floor(i / 4), col = i % 4;
    const render = `prototypes/trail-collections/${collection}/renders/${id}.png`;
    const label = Buffer.from(`<svg width="360" height="28"><text x="180" y="20" text-anchor="middle" font-family="Arial" font-size="14" fill="#203650">${id.toUpperCase()} · reference / Blender</text></svg>`);
    const crop = await sharp(reference).extract({ left: Math.floor(col * width / 4), top: rowBounds[row], width: Math.floor(width / 4), height: rowBounds[row + 1] - rowBounds[row] })
      .resize(180, 180, { fit: 'contain', background: '#E5F4ED' }).png().toBuffer();
    const sprite = await sharp(render).resize(180, 180).flatten({ background: '#E5F4ED' }).png().toBuffer();
    pairs.push({ input: crop, left: col * 360, top: row * 210 }, { input: sprite, left: col * 360 + 180, top: row * 210 }, { input: label, left: col * 360, top: row * 210 + 180 });
    gallery.push({ input: await sharp(render).resize(240, 240).png().toBuffer(), left: col * 240, top: row * 270 });
    gallery.push({ input: Buffer.from(`<svg width="240" height="30"><text x="120" y="22" text-anchor="middle" font-family="Arial" font-size="18" fill="#203650">${id.toUpperCase()}</text></svg>`), left: col * 240, top: row * 270 + 240 });
  }
  await sharp({ create: { width: 1440, height: 1050, channels: 4, background: '#E5F4ED' } }).composite(pairs).png().toFile(`${output}/${collection}-comparison.png`);
  await sharp({ create: { width: 960, height: 1350, channels: 4, background: '#E5F4ED' } }).composite(gallery).png().toFile(`${output}/${collection}-blender.png`);
  const rendered = await sharp(`${output}/${collection}-blender.png`).resize(width, height, { fit: 'contain', background: '#E5F4ED' }).png().toBuffer();
  const heading = Buffer.from(`<svg width="${width * 2}" height="46"><g font-family="Arial" font-size="24" text-anchor="middle" fill="#203650"><text x="${width / 2}" y="32">Approved reference</text><text x="${width * 1.5}" y="32">Blender renders</text></g></svg>`);
  await sharp({ create: { width: width * 2, height: height + 46, channels: 4, background: '#E5F4ED' } }).composite([
    { input: heading, top: 0, left: 0 }, { input: reference, top: 46, left: 0 }, { input: rendered, top: 46, left: width },
  ]).png().toFile(`${output}/${collection}-reference-and-blender.png`);
}
