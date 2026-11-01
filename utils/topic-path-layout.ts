export type TopicPathPoint = { x: number; y: number; diameter: number; radius: number };
export const TOPIC_SCENERY_DRIFT = 20;

type SceneryKind = "square" | "rectangle" | "circle" | "capsule" | "step" | "elbow";
type SceneryOutline = { kind: SceneryKind; x: number; y: number; width: number; height: number };

// Intersections are composed deliberately. Independent random positions produced isolated triplets.
const sceneryCompositions: readonly (readonly SceneryOutline[])[] = [
  [
    { kind: "square", x: 8, y: 12, width: 32, height: 32 },
    { kind: "rectangle", x: 28, y: 34, width: 62, height: 24 },
    { kind: "circle", x: 65, y: 15, width: 26, height: 26 },
    { kind: "step", x: 12, y: 48, width: 42, height: 44 },
    { kind: "capsule", x: 47, y: 67, width: 43, height: 21 },
  ],
  [
    { kind: "capsule", x: 19, y: 8, width: 28, height: 70 },
    { kind: "square", x: 37, y: 44, width: 45, height: 45 },
  ],
  [
    { kind: "step", x: 8, y: 20, width: 53, height: 54 },
    { kind: "rectangle", x: 44, y: 8, width: 44, height: 26 },
    { kind: "circle", x: 57, y: 43, width: 34, height: 34 },
    { kind: "square", x: 26, y: 64, width: 29, height: 29 },
  ],
  [
    { kind: "rectangle", x: 5, y: 9, width: 30, height: 26 },
    { kind: "capsule", x: 27, y: 8, width: 24, height: 53 },
    { kind: "rectangle", x: 10, y: 48, width: 59, height: 23 },
    { kind: "square", x: 57, y: 21, width: 34, height: 34 },
    { kind: "circle", x: 66, y: 55, width: 27, height: 27 },
    { kind: "rectangle", x: 38, y: 68, width: 32, height: 25 },
  ],
  [
    { kind: "elbow", x: 8, y: 10, width: 52, height: 68 },
    { kind: "rectangle", x: 43, y: 48, width: 50, height: 22 },
    { kind: "circle", x: 49, y: 68, width: 25, height: 25 },
  ],
];

/** Every nearby location has a different count; later sections change orientation and color. */
export function getTopicSceneryShapes(seed: number) {
  const location = Math.floor(seed / 2);
  const transpose = Math.floor(location / sceneryCompositions.length) % 2 === 1;
  const tones = ["lavender", "mint", "gold"] as const;
  return sceneryCompositions[location % sceneryCompositions.length].map((shape, index) => ({
    ...shape,
    x: transpose ? shape.y : shape.x, y: transpose ? shape.x : shape.y,
    width: transpose ? shape.height : shape.width, height: transpose ? shape.width : shape.height,
    radius: shape.kind === "circle" || shape.kind === "capsule" ? Math.min(shape.width, shape.height) / 2 : 1.5,
    tone: tones[(index + location) % tones.length],
  }));
}

/** Closed stepped and rounded elbow silhouettes, in the same reserved bounds as the simple shapes. */
export function getTopicSceneryOutline(shape: SceneryOutline) {
  const { x, y, width: w, height: h } = shape;
  if (shape.kind === "step") return `M${x} ${y + h / 2} H${x + w / 2} V${y} H${x + w} V${y + h} H${x} Z`;
  if (shape.kind === "elbow") {
    const r = Math.min(w, h) * 0.24;
    return `M${x} ${y + r} Q${x} ${y} ${x + r} ${y} Q${x + r * 2} ${y} ${x + r * 2} ${y + r}
      V${y + h - r * 2} H${x + w - r} Q${x + w} ${y + h - r * 2} ${x + w} ${y + h - r}
      Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} Z`;
  }
  return null;
}

/** Local, bounded depth: distant motifs never accumulate displacement on long trails. */
export function getTopicSceneryOffset(scrollY: number, viewportHeight: number, centerY: number, reducedMotion: boolean) {
  "worklet";
  if (reducedMotion || viewportHeight <= 0) return 0;
  return Math.max(-TOPIC_SCENERY_DRIFT, Math.min(TOPIC_SCENERY_DRIFT,
    (Math.max(0, scrollY) + viewportHeight / 2 - centerY) * 0.12));
}

/** A growing trail, with room for the square tiles and active halo at every bend. */
export function getTopicPathLayout(width: number, count: number, currentIndex: number) {
  const diameter = Math.min(88, Math.max(80, width * 0.23));
  const activeDiameter = diameter + 12;
  const halo = 8;
  const inset = activeDiameter / 2 + halo + 12;
  const amplitude = Math.max(0, Math.min(width * 0.24, (width - inset * 2) / 2));
  const points: TopicPathPoint[] = [];
  for (let index = 0; index < count; index++) {
    const size = index === currentIndex ? activeDiameter : diameter;
    const radius = size / 2 + (index === currentIndex ? halo : 0);
    const x = width / 2 + amplitude * Math.sin(index * Math.PI / 3 - Math.PI / 2);
    const previous = points[index - 1];
    // Square tiles need vertical clearance, not just circular center-distance clearance.
    // Keep the rhythm generous even where two levels share the same horizontal position.
    const rise = Math.max(128, previous ? previous.radius + radius + 24 : 0);
    points.push({ x, y: previous ? previous.y + rise : radius + 16, diameter: size, radius });
  }
  const last = points.at(-1);
  return { points, height: last ? last.y + last.radius + 36 : 0 };
}

/** Sparse outline motifs sit on the open side of the trail, outside tile halos. */
export function getTopicPathDecorations(width: number, points: readonly TopicPathPoint[], height: number) {
  const decorations: { index: number; left: number; top: number; size: number }[] = [];
  for (let index = 0; index < points.length; index += 2) {
    const point = points[index];
    const onRight = point.x < width / 2;
    const start = onRight ? point.x + point.radius + 20 : 4;
    const end = onRight ? width - 4 : point.x - point.radius - 20;
    let size = Math.min(156, width * 0.46, end - start, height - 16 - TOPIC_SCENERY_DRIFT * 2);
    while (size >= 72) {
      const left = onRight ? end - size : start;
      const top = Math.max(8 + TOPIC_SCENERY_DRIFT,
        Math.min(height - size - TOPIC_SCENERY_DRIFT - 8, point.y - size / 2));
      const clear = points.every(tile => left + size + 16 <= tile.x - tile.radius
        || left >= tile.x + tile.radius + 16 || top + size + TOPIC_SCENERY_DRIFT + 16 <= tile.y - tile.radius
        || top - TOPIC_SCENERY_DRIFT >= tile.y + tile.radius + 16);
      if (clear) {
        decorations.push({ index, left, top, size });
        break;
      }
      size -= 4;
    }
  }
  return decorations;
}
