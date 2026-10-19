/** Pack Blender --motion review frames into a compact comparison and animation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const frames = '/tmp/brainpet-puzzle-reactions-frames';
const out = path.resolve('docs/qa/puzzle-reactions/2026-10-19');
const names = ['High paw', 'Proud nod', 'Happy bounce', 'Oops', 'Thinking', 'Try again'];
const clips = ['puzzleHighPaw', 'puzzleProud', 'puzzleBounce', 'puzzleOops', 'puzzleThink', 'puzzleRecover'];
const review = JSON.parse(await fs.readFile(path.join(out, 'blender-review.json'), 'utf8'));
if (review.some(clip => clip.reviewFps !== 12)) throw new Error('Render the Blender review with --motion before packing the animation.');
const width = 648, height = 492;
const label = (text, column, row) => ({ input: Buffer.from(`<svg width="216" height="30"><text x="108" y="22" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#2D3436">${text}</text></svg>`), left: column * 216, top: row * 246 + 207 });
async function comparison(frame) {
  const overlays = [];
  for (let i = 0; i < clips.length; i++) {
    const index = Math.min(frame, review[i].frames - 1);
    overlays.push({ input: await sharp(path.join(frames, `${clips[i]}-${String(index).padStart(2, '0')}.png`)).resize(200, 200).toBuffer(),
      left: (i % 3) * 216 + 8, top: Math.floor(i / 3) * 246 + 5 });
    overlays.push(label(names[i], i % 3, Math.floor(i / 3)));
  }
  return sharp({ create: { width, height, channels: 4, background: '#FFF5EB' } }).composite(overlays);
}
await fs.mkdir(out, { recursive: true });
await (await comparison(Math.round(review[0].duration * 12 * .42))).png().toFile(path.join(out, 'expressive-reactions.png'));
const pages = [];
for (let frame = 0; frame < Math.max(...review.map(clip => clip.frames)) + 4; frame++) pages.push(await (await comparison(frame)).raw().toBuffer());
await sharp(Buffer.concat(pages), { raw: { width, height: height * pages.length, channels: 4, pageHeight: height } })
  .gif({ loop: 0, delay: pages.map((_,i)=>(Math.round((i+1)*100/12)-Math.round(i*100/12))*10) }).toFile(path.join(out, 'expressive-reactions.gif'));
console.log(`Packed six Blender performances into ${out}/expressive-reactions.gif`);
