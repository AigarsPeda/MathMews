/** Pack original Blender renders into small native atlases. Re-run after rendering. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { bossStories } from '../puzzles/boss-stories.mjs';
import { registerBossScenes } from './register-boss-scenes.mjs';
import { packAchievementMedia } from './pack-achievement-media.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const ids = Object.keys(bossStories);
const selected = process.argv.includes('--id') ? [process.argv[process.argv.indexOf('--id') + 1]] : ids;
for (const id of selected) {
  if (!ids.includes(id)) throw new Error(`Unknown boss scene: ${id}`);
  const folder = path.join(root, 'assets/3d/bosses', id);
  for (const [prefix, count] of [['reaction-1',8],['reaction-2',8],['outcome',16]]) {
    const frames = Array.from({ length: count }, (_, i) => ({
      input: path.join(folder, `${prefix}-${String(i).padStart(2, '0')}.png`),
      left: (i % 4) * 512, top: Math.floor(i / 4) * 320,
    }));
    await sharp({ create: { width: 2048, height: count / 4 * 320, channels: 4, background: '#00000000' } })
      .composite(frames).png({ palette: false, compressionLevel: 9 }).toFile(path.join(folder, `${prefix}.png`));
    for (const frame of frames) await fs.rm(frame.input);
  }
}
await registerBossScenes();
await packAchievementMedia(selected);
console.log(`Packed ${selected.length} boss scenes with two task reactions and a final outcome.`);
