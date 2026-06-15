import type { PetSpriteManifest } from '@/types/sprite-sheet';

/**
 * Buddy the dog — legacy v1 sheets in `images/`.
 * Regenerate with v2 layout (see prompt.md) and switch to buildGridV2Layout().
 */
export const dogManifest: PetSpriteManifest = {
  id: 'dog',
  name: 'Buddy',
  species: 'dog',
  promptVersion: '1.0',
  layout: {
    type: 'legacy-v1',
    sheetCols: 2,
    sheetRows: 2,
    sheetWidth: 1536,
    sheetHeight: 1024,
    frameWidth: 768,
    frameHeight: 512,
    cropTop: 24,
    cropHeight: 440,
  },
  animations: {
    idle: {
      source: require('@/images/idle.png'),
      frames: 4,
      focusFrames: [
        { x: 546, y: 299 },
        { x: 245, y: 299 },
        { x: 538, y: 187 },
        { x: 245, y: 187 },
      ],
    },
    excited: {
      source: require('@/images/excited.png'),
      frames: 4,
      focusFrames: [
        { x: 537, y: 284 },
        { x: 254, y: 279 },
        { x: 532, y: 197 },
        { x: 264, y: 198 },
      ],
    },
    excited2: {
      source: require('@/images/excited.png'),
      frames: 4,
      focusFrames: [
        { x: 537, y: 284 },
        { x: 254, y: 279 },
        { x: 532, y: 197 },
        { x: 264, y: 198 },
      ],
    },
    dancing: {
      source: require('@/images/dancing.png'),
      frames: 4,
      focusFrames: [
        { x: 504, y: 319 },
        { x: 237, y: 319 },
        { x: 523, y: 185 },
        { x: 253, y: 188 },
      ],
    },
    eating: {
      source: require('@/images/eating.png'),
      frames: 4,
      focusFrames: [
        { x: 491, y: 322 },
        { x: 266, y: 344 },
        { x: 505, y: 191 },
        { x: 247, y: 169 },
      ],
    },
    angry: {
      source: require('@/images/angry.png'),
      frames: 4,
      focusFrames: [
        { x: 506, y: 288 },
        { x: 257, y: 289 },
        { x: 525, y: 210 },
        { x: 254, y: 207 },
      ],
    },
    sad: {
      source: require('@/images/sad.png'),
      frames: 4,
      focusFrames: [
        { x: 521, y: 300 },
        { x: 255, y: 288 },
        { x: 526, y: 215 },
        { x: 260, y: 209 },
      ],
    },
    sleeping: {
      source: require('@/images/sleeping.png'),
      frames: 4,
      focusFrames: [
        { x: 522, y: 264 },
        { x: 286, y: 266 },
        { x: 546, y: 199 },
        { x: 274, y: 199 },
      ],
    },
  },
};
