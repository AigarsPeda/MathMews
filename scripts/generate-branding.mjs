/**
 * Generates app icon, splash, and favicon assets from the cat Idle sprite sheet.
 *
 * Source: assets/pets/Cat/CatPackDifferentSkins/OrangeCat.png (idle row)
 * Run: npm run branding
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets", "images");

const SOURCE = path.join(
  root,
  "assets/pets/Cat/CatPackDifferentSkins/OrangeCat.png",
);

const IDLE_ROW = 0;

const FRAME_SIZE = 32;
const FRAME_COUNT = 10;
const BACKGROUND = "#FFF5EB";

function measureHorizontalVisualCenter(data, channels = 4) {
  let minX = FRAME_SIZE;
  let maxX = 0;

  for (let y = 0; y < FRAME_SIZE; y += 1) {
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      const index = (y * FRAME_SIZE + x) * channels;
      if (data[index + 3] > 20) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }

  if (maxX < minX) {
    return FRAME_SIZE / 2;
  }

  return (minX + maxX) / 2;
}

const OUTPUTS = {
  icon: { size: 1024, pad: 0.2 },
  favicon: { size: 48, pad: 0.1 },
  androidForeground: { size: 1024, pad: 0.25 },
  androidMonochrome: { size: 1024, pad: 0.25 },
};

async function frameOnCanvas(frameIndex, { size, pad, background, monochrome }) {
  const inner = Math.round(size * (1 - pad * 2));
  const scale = Math.max(1, Math.floor(inner / FRAME_SIZE));
  const framePx = FRAME_SIZE * scale;

  const frame = await sharp(SOURCE)
    .extract({
      left: frameIndex * FRAME_SIZE,
      top: IDLE_ROW * FRAME_SIZE,
      width: FRAME_SIZE,
      height: FRAME_SIZE,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data } = frame;
  const channels = 4;
  const visualCenterX = measureHorizontalVisualCenter(data, channels);
  const frameCenterX = (FRAME_SIZE - 1) / 2;
  const sourceShiftX = frameCenterX - visualCenterX;

  const canvas = Buffer.alloc(size * size * 4, 0);
  const bg = background ? parseHexColor(background) : null;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const canvasIndex = (y * size + x) * 4;
      const offsetX = Math.round((size - framePx) / 2 + sourceShiftX * scale);
      const offsetY = Math.round((size - framePx) / 2);
      const localX = x - offsetX;
      const localY = y - offsetY;

      if (
        localX < 0 ||
        localY < 0 ||
        localX >= framePx ||
        localY >= framePx
      ) {
        if (background && bg) {
          canvas[canvasIndex] = bg.r;
          canvas[canvasIndex + 1] = bg.g;
          canvas[canvasIndex + 2] = bg.b;
          canvas[canvasIndex + 3] = 255;
        }
        continue;
      }

      const srcX = Math.min(FRAME_SIZE - 1, Math.floor(localX / scale));
      const srcY = Math.min(FRAME_SIZE - 1, Math.floor(localY / scale));
      const srcIndex = (srcY * FRAME_SIZE + srcX) * channels;
      const alpha = data[srcIndex + 3] / 255;

      if (alpha < 0.05) {
        if (background && bg) {
          canvas[canvasIndex] = bg.r;
          canvas[canvasIndex + 1] = bg.g;
          canvas[canvasIndex + 2] = bg.b;
          canvas[canvasIndex + 3] = 255;
        }
        continue;
      }

      if (monochrome) {
        canvas[canvasIndex] = 255;
        canvas[canvasIndex + 1] = 255;
        canvas[canvasIndex + 2] = 255;
        canvas[canvasIndex + 3] = Math.round(alpha * 255);
        continue;
      }

      if (background && bg) {
        canvas[canvasIndex] = Math.round(
          data[srcIndex] * alpha + bg.r * (1 - alpha),
        );
        canvas[canvasIndex + 1] = Math.round(
          data[srcIndex + 1] * alpha + bg.g * (1 - alpha),
        );
        canvas[canvasIndex + 2] = Math.round(
          data[srcIndex + 2] * alpha + bg.b * (1 - alpha),
        );
        canvas[canvasIndex + 3] = 255;
      } else {
        canvas[canvasIndex] = data[srcIndex];
        canvas[canvasIndex + 1] = data[srcIndex + 1];
        canvas[canvasIndex + 2] = data[srcIndex + 2];
        canvas[canvasIndex + 3] = Math.round(alpha * 255);
      }
    }
  }

  return sharp(canvas, {
    raw: { width: size, height: size, channels: 4 },
  }).png();
}

function parseHexColor(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

async function writeFile(name, buffer) {
  const target = path.join(outDir, name);
  await fs.writeFile(target, buffer);
  console.log(`wrote ${path.relative(root, target)}`);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const splashBackground = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: BACKGROUND,
    },
  }).png();
  await writeFile("splash-background.png", await splashBackground.toBuffer());

  const icon = await frameOnCanvas(0, {
    ...OUTPUTS.icon,
    background: BACKGROUND,
  });
  await writeFile("icon.png", await icon.toBuffer());

  const favicon = await frameOnCanvas(0, {
    ...OUTPUTS.favicon,
    background: BACKGROUND,
  });
  await writeFile("favicon.png", await favicon.toBuffer());

  const androidForeground = await frameOnCanvas(0, {
    ...OUTPUTS.androidForeground,
    background: null,
  });
  await writeFile(
    "android-icon-foreground.png",
    await androidForeground.toBuffer(),
  );

  const androidMonochrome = await frameOnCanvas(0, {
    ...OUTPUTS.androidMonochrome,
    background: null,
    monochrome: true,
  });
  await writeFile(
    "android-icon-monochrome.png",
    await androidMonochrome.toBuffer(),
  );

  console.log(
    `Done — branding generated from ${path.relative(root, SOURCE)} (frame 0 of ${FRAME_COUNT})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
