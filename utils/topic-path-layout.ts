export type TopicPathPoint = { x: number; y: number; diameter: number; radius: number };
export const TOPIC_SCENERY_DRIFT = 12;
export const TRAIL_COLLECTIONS = {
  easy: ["e01", "e02", "e03", "e04", "e05", "e06", "e07", "e08", "e09", "e10", "e11", "e12", "e13", "e14", "e15", "e16", "e17", "e18", "e19", "e20"],
  medium: ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12", "m13", "m14", "m15", "m16", "m17", "m18", "m19", "m20"],
  hard: ["h01", "h02", "h03", "h04", "h05", "h06", "h07", "h08", "h09", "h10", "h11", "h12", "h13", "h14", "h15", "h16", "h17", "h18", "h19", "h20"],
} as const;
export type TrailDifficulty = keyof typeof TRAIL_COLLECTIONS;
export type TrailPropKind = typeof TRAIL_COLLECTIONS[TrailDifficulty][number];
export const TRAIL_PROP_KINDS = Object.values(TRAIL_COLLECTIONS).flat();
export const TOPIC_TRAIL_THEMES: Record<TrailDifficulty, Record<string, readonly TrailPropKind[]>> = {
  easy: {
    numbers: ["e06", "e11", "e09", "e13", "e10"],
    addition: ["e08", "e07", "e18", "e09", "e06"],
    subtraction: ["e02", "e03", "e04", "e01", "e20"],
    patterns: ["e17", "e16", "e15", "e05", "e01"],
    multiplication: ["e05", "e18", "e07", "e20", "e03"],
    fractions: ["e14", "e12", "e19", "e10", "e13"],
  },
  medium: {
    addition: ["m08", "m01", "m02", "m04", "m14"],
    subtraction: ["m07", "m06", "m19", "m20", "m13"],
    multiplication: ["m09", "m16", "m17", "m03", "m10"],
    division: ["m20", "m03", "m15", "m08", "m16"],
    fractions: ["m14", "m15", "m02", "m18", "m01"],
    operations: ["m11", "m05", "m12", "m10", "m18"],
  },
  hard: {
    operations: ["h07", "h18", "h03", "h12", "h11"],
    fractions: ["h13", "h04", "h06", "h17", "h20"],
    patterns: ["h12", "h14", "h17", "h06", "h16"],
    percentages: ["h03", "h05", "h19", "h15", "h07"],
    measurement: ["h09", "h02", "h10", "h08", "h01"],
    logic: ["h14", "h16", "h18", "h15", "h20"],
  },
};

export function getTopicTrailProps(topicId: string, difficulty: TrailDifficulty = "easy") {
  const preferred = TOPIC_TRAIL_THEMES[difficulty][topicId] ?? Object.values(TOPIC_TRAIL_THEMES[difficulty])[0];
  // The hero sits by level 3, clear of the first current-level caption.
  return [preferred[1], preferred[0], ...preferred.slice(2), ...TRAIL_COLLECTIONS[difficulty].filter(kind => !preferred.includes(kind))];
}

/** Bounded scroll depth; Reduce Motion keeps artwork attached to the trail. */
export function getTopicSceneryOffset(scrollY: number, viewportHeight: number, centerY: number, reducedMotion: boolean) {
  "worklet";
  if (reducedMotion || viewportHeight <= 0) return 0;
  return Math.max(-TOPIC_SCENERY_DRIFT, Math.min(TOPIC_SCENERY_DRIFT,
    (Math.max(0, scrollY) + viewportHeight / 2 - centerY) * 0.08));
}

/** Fixed centers keep scenery and the trail still when the next level unlocks. */
export function getTopicPathLayout(width: number, count: number, currentIndex: number) {
  const diameter = Math.min(88, Math.max(80, width * 0.25));
  const activeDiameter = diameter + 16;
  const inset = activeDiameter / 2 + 8 + 12;
  const amplitude = Math.max(0, Math.min(width * 0.24, (width - inset * 2) / 2));
  const points: TopicPathPoint[] = [];
  for (let index = 0; index < count; index++) {
    const size = index === currentIndex ? activeDiameter : diameter;
    points.push({
      x: width / 2 + amplitude * Math.sin(index * Math.PI / 3 - Math.PI / 2),
      y: 100 + index * 144,
      diameter: size, radius: size / 2 + (index === currentIndex ? 8 : 0),
    });
  }
  const last = points.at(-1);
  const finish = last ? { x: width / 2, y: last.y + 136 } : undefined;
  return { points, finish, height: finish ? finish.y + 96 : 0 };
}

/** The selected lesson uses the open side of its tile, with no artwork behind its text. */
export function getTopicPathCallout(width: number, point: TopicPathPoint) {
  const onRight = point.x <= width / 2;
  const left = onRight ? point.x + point.radius + 20 : 8;
  const right = onRight ? width - 8 : point.x - point.radius - 20;
  return { left, top: point.y - 58, width: Math.max(0, right - left), height: 116 };
}

/** Unique craft props, spread over long trails instead of repeating the same sprite. */
export function getTopicPathDecorations(width: number, points: readonly TopicPathPoint[], height: number, currentIndex = -1, topicId = "addition", difficulty: TrailDifficulty = "easy") {
  const decorations: { index: number; left: number; top: number; size: number; kind: TrailPropKind }[] = [];
  const kinds = getTopicTrailProps(topicId, difficulty);
  const current = points[currentIndex];
  const callout = current ? getTopicPathCallout(width, current) : undefined;
  const availableSlots = Math.ceil(points.length / 2);
  const slotCount = Math.min(availableSlots, kinds.length);
  for (let slot = 0; slot < slotCount; slot++) {
    const index = availableSlots <= slotCount ? slot * 2 : Math.round(slot * (availableSlots - 1) / (slotCount - 1)) * 2;
    if (index === currentIndex) continue;
    const point = points[index];
    const onRight = point.x < width / 2;
    const start = onRight ? point.x + point.radius + 20 : 0;
    const end = onRight ? width : point.x - point.radius - 20;
    let size = Math.min(156, width * 0.47, end - start);
    while (size >= 72) {
      const left = onRight ? end - size : start;
      const top = Math.max(16 + TOPIC_SCENERY_DRIFT, Math.min(height - size - TOPIC_SCENERY_DRIFT - 16, point.y - size / 2));
      const clearTiles = points.every(tile => left + size + 16 <= tile.x - tile.radius
        || left >= tile.x + tile.radius + 16 || top + size + TOPIC_SCENERY_DRIFT + 16 <= tile.y - tile.radius
        || top - TOPIC_SCENERY_DRIFT >= tile.y + tile.radius + 16);
      const clearCaption = !callout || left + size + 12 <= callout.left || left >= callout.left + callout.width + 12
        || top + size + TOPIC_SCENERY_DRIFT + 12 <= callout.top || top - TOPIC_SCENERY_DRIFT >= callout.top + callout.height + 12;
      if (clearTiles && clearCaption) {
        decorations.push({ index, left, top, size, kind: kinds[slot] });
        break;
      }
      size -= 4;
    }
  }
  return decorations;
}
