/**
 * Cat sprite animation catalog for `CatPackDifferentSkins` sheets.
 *
 * Grid: 32×32 px cells on a 512×640 sheet (16 cols × 20 rows).
 * Each entry is a horizontal strip at `row`, starting at column 0.
 *
 * Mood wiring lives in `pet-display/registry/cat-sprite-registry.ts`.
 */
export const CAT_SPRITE_CATALOG = {
  idle: {
    row: 0,
    frameCount: 10,
    fps: 6,
    description: "Sitting idle loop with blinking",
    usedBy: ["mood:idle"],
  },
  idle2: {
    row: 1,
    frameCount: 10,
    fps: 6,
    description: "Alternate sitting idle loop",
    usedBy: [],
  },
  sleep: {
    row: 2,
    frameCount: 4,
    fps: 4,
    description: "Lying down / sleeping loop",
    usedBy: ["mood:sleeping", "scenario:fallAsleep"],
  },
  dance: {
    row: 3,
    frameCount: 4,
    fps: 10,
    description: "Jumping / celebrating",
    usedBy: ["mood:dancing"],
  },
  sleepy: {
    row: 4,
    frameCount: 8,
    fps: 5,
    description: "Getting drowsy",
    usedBy: ["mood:fallingAsleep", "scenario:fallAsleep", "scenario:wakeUp"],
  },
  excited: {
    row: 5,
    frameCount: 12,
    fps: 10,
    description: "Grooming / face-washing (tap reaction)",
    usedBy: ["mood:excited", "mood:correct"],
  },
  layDown: {
    row: 6,
    frameCount: 12,
    fps: 5,
    description: "Lying flat, looking around",
    usedBy: [],
  },
  sad: {
    row: 7,
    frameCount: 9,
    fps: 5,
    description: "Sad sitting loop",
    usedBy: ["mood:sad"],
  },
  cry: {
    row: 8,
    frameCount: 4,
    fps: 5,
    description: "Crying with tears",
    usedBy: [],
  },
  box2: {
    row: 9,
    frameCount: 12,
    fps: 8,
    description: "Cat in cardboard box, looking around",
    usedBy: ["reaction:playBox"],
  },
  box1: {
    row: 10,
    frameCount: 4,
    fps: 8,
    description: "Cat in box, tail twitch",
    usedBy: ["reaction:playBox"],
  },
  box3: {
    row: 11,
    frameCount: 4,
    fps: 8,
    description: "Cat peeking from box",
    usedBy: ["reaction:playBox"],
  },
  surprised: {
    row: 12,
    frameCount: 12,
    fps: 8,
    description: "Meowing / startled",
    usedBy: ["mood:angry"],
  },
  eating: {
    row: 13,
    frameCount: 15,
    fps: 8,
    description: "Eating from bowl",
    usedBy: ["mood:eating"],
  },
  waiting: {
    row: 14,
    frameCount: 6,
    fps: 6,
    description: "Looking up expectantly",
    usedBy: ["mood:coinCatch"],
  },
  blinkIdle: {
    row: 15,
    frameCount: 13,
    fps: 6,
    description: "Sitting blink variant (extra)",
    usedBy: [],
  },
  angryCute: {
    row: 16,
    frameCount: 9,
    fps: 8,
    description: "Angry-cute with emote symbols (extra)",
    usedBy: [],
  },
  blinkSit: {
    row: 17,
    frameCount: 12,
    fps: 6,
    description: "Sitting blink loop variant (extra)",
    usedBy: [],
  },
} as const;

export type CatSpriteAnimationId = keyof typeof CAT_SPRITE_CATALOG;

export type CatSpriteCatalogEntry = (typeof CAT_SPRITE_CATALOG)[CatSpriteAnimationId];
