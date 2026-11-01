/** Ship lightweight transparent previews; retain source PNGs and GLBs outside the app bundle. */
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';
const catalog = JSON.parse(await fs.readFile('prototypes/education-props/catalog.json', 'utf8'));
const labels = ['Addition', 'Square root', 'Fractions', 'Single book', 'Open book', 'Book stack', 'Pencil', 'Set square', 'Calculator'];
const layers = [];
for (const [index, entry] of catalog.objects.entries()) {
  const original = `prototypes/education-props/renders/${entry.name}.png`;
  await sharp(original).resize(384, 384).webp({ quality: 90, alphaQuality: 100 }).toFile(entry.preview);
  layers.push({ input: await sharp(original).resize(300, 300).toBuffer(), left: index % 3 * 340 + 20, top: Math.floor(index / 3) * 350 + 10 });
}
const captions = `<svg width="1020" height="1050" xmlns="http://www.w3.org/2000/svg">${labels.map((label, i) => `<text x="${i % 3 * 340 + 170}" y="${Math.floor(i / 3) * 350 + 329}" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="600" fill="#29443f">${label}</text>`).join('')}</svg>`;
layers.push({ input: Buffer.from(captions), left: 0, top: 0 });
await sharp({ create: { width: 1020, height: 1050, channels: 4, background: '#fffcf7' } }).composite(layers).png().toFile('docs/art/education-props/collection.png');
console.log(`Packed ${catalog.objects.length} Blender props and generated the review sheet.`);
