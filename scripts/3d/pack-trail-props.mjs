import fs from 'node:fs/promises';
import sharp from 'sharp';

await fs.mkdir('assets/3d/trail-props', { recursive: true });
for (const name of ['milestone']) {
  const destination = `assets/3d/trail-props/${name}.webp`;
  await sharp(`prototypes/trail-props/renders/${name}.png`)
    .resize(384, 384).webp({ quality: 92, alphaQuality: 100, effort: 4 }).toFile(destination);
  console.log(`${name}: ${Math.round((await fs.stat(destination)).size / 1024)} KB`);
}
