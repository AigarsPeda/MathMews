export type TopicPathPoint = { x: number; y: number; diameter: number; radius: number };

// Authored per topic so returning players recognize their trail. Positions never
// depend on progress, and every stop leaves the opposite side free for its title.
const topicRoutes: Record<string, { lanes: number[]; gaps: number[]; radius: number; bend: number }> = {
  "cat-plans": { lanes: [0, 1, 0.15], gaps: [256, 280], radius: 34, bend: 0.5 },
  time:          { lanes: [0, 0.9, 0.9, 0.1, 1, 0.1, 0.1, 1, 0.85, 0], gaps: [192, 256, 176, 344, 208, 280, 164, 256, 368], radius: 34, bend: 0.46 },
  data:          { lanes: [1, 0.15, 0.85, 0, 0, 1, 0.15, 0.85, 1, 0], gaps: [280, 164, 208, 256, 368, 176, 344, 192, 256], radius: 30, bend: 0.54 },
  spatial:       { lanes: [0.15, 1, 0, 0.85, 0.85, 0, 1, 0.15, 1, 0], gaps: [176, 344, 192, 280, 164, 368, 208, 256, 192], radius: 24, bend: 0.5 },
  money:         { lanes: [1, 1, 0.1, 0.9, 0, 0.85, 0.15, 0.15, 1, 0], gaps: [256, 192, 344, 164, 280, 208, 256, 368, 176], radius: 44, bend: 0.56 },
  capacity:      { lanes: [0, 0.85, 0.15, 0.15, 1, 0, 0.9, 0.9, 0.1, 1], gaps: [208, 368, 256, 176, 344, 192, 280, 164, 256], radius: 40, bend: 0.48 },
  addition:       { lanes: [0, 0, 0.78, 1, 1, 0.22, 0, 0.85, 1, 0.15], gaps: [256, 164, 344, 256, 180, 272, 164, 256, 368], radius: 32, bend: 0.5 },
  subtraction:    { lanes: [1, 0.12, 0, 0.88, 1, 1, 0.15, 0, 0.85, 1], gaps: [176, 344, 160, 256, 280, 192, 256, 368, 256], radius: 44, bend: 0.44 },
  numbers:        { lanes: [0, 0.85, 0.1, 1, 0.15, 0.9, 0, 0.85, 0.15, 1], gaps: [160, 192, 344, 176, 208, 164, 368, 192, 160], radius: 24, bend: 0.5 },
  patterns:       { lanes: [1, 1, 0, 0, 0.88, 0.12, 0.12, 1, 1, 0], gaps: [344, 168, 256, 192, 160, 280, 368, 256, 176], radius: 40, bend: 0.56 },
  multiplication: { lanes: [0.1, 0.9, 0.9, 0.1, 0.1, 1, 1, 0, 0, 0.9], gaps: [176, 256, 344, 280, 160, 256, 192, 368, 176], radius: 28, bend: 0.46 },
  fractions:      { lanes: [1, 0.15, 0.15, 0.85, 0, 0, 1, 0.85, 0.15, 1], gaps: [192, 280, 164, 368, 256, 176, 344, 208, 160], radius: 48, bend: 0.54 },
  division:       { lanes: [0, 1, 0.85, 0.15, 1, 0, 0.15, 0.85, 0, 1], gaps: [344, 256, 176, 208, 160, 280, 192, 368, 164], radius: 36, bend: 0.58 },
  operations:     { lanes: [0.85, 0, 1, 0.15, 0.15, 1, 0, 0, 0.85, 0.15], gaps: [164, 344, 192, 256, 176, 208, 368, 160, 192], radius: 22, bend: 0.48 },
  percentages:    { lanes: [0.15, 0.15, 1, 0, 0.85, 0.85, 0.15, 1, 0, 0.85], gaps: [280, 192, 160, 344, 256, 176, 208, 164, 368], radius: 46, bend: 0.56 },
  measurement:    { lanes: [1, 0, 0, 1, 0.15, 0.85, 0.85, 0, 1, 0.15], gaps: [192, 344, 164, 208, 176, 256, 368, 160, 192], radius: 26, bend: 0.42 },
  logic:          { lanes: [0, 0.85, 0.85, 0.15, 1, 1, 0, 1, 0.15, 0.15], gaps: [176, 280, 192, 344, 256, 164, 208, 160, 368], radius: 42, bend: 0.52 },
};
const getRoute = (topicId: string) => topicRoutes[topicId] ?? topicRoutes.addition;

/** Stops and turns stay in place when the next level unlocks. */
export function getTopicPathLayout(width: number, count: number, currentIndex: number, topicId = "addition") {
  const diameter = Math.min(88, Math.max(80, width * 0.25));
  const activeDiameter = diameter + 16;
  const inset = activeDiameter / 2 + 8 + 12;
  const span = Math.max(0, width - inset * 2);
  const { lanes, gaps } = getRoute(topicId);
  const points: TopicPathPoint[] = [];
  let y = 100;
  for (let index = 0; index < count; index++) {
    if (index > 0) {
      const paired = Math.abs(lanes[index % lanes.length] - lanes[(index - 1) % lanes.length]) < 0.3;
      y += Math.max(gaps[(index - 1) % gaps.length], width < 300 ? 248 : paired ? 256 : 0);
    }
    const size = index === currentIndex ? activeDiameter : diameter;
    points.push({
      x: inset + span * lanes[index % lanes.length],
      y,
      diameter: size, radius: size / 2 + (index === currentIndex ? 8 : 0),
    });
  }
  const last = points.at(-1);
  const finish = last ? { x: width / 2, y: last.y + (width < 300 ? 248 : 136) } : undefined;
  return { points, finish, height: finish ? finish.y + 96 : 0 };
}

/** Short hops, broad loops, and occasional winding stretches share rounded turns. */
export function getTopicPathConnection(width: number, from: { x: number; y: number }, to: { x: number; y: number }, topicId = "addition") {
  const route = getRoute(topicId);
  const loop = to.y - from.y >= 200;
  const middle = Math.max(from.y + 64, Math.min(to.y - 64, from.y + (to.y - from.y) * route.bend));
  const rail = from.x < width / 2 ? width - 20 : 20;
  const oppositeRail = width - rail;
  const vertices = to.y - from.y >= 320 ? [from,
    { x: from.x, y: from.y + 64 }, { x: rail, y: from.y + 64 },
    { x: rail, y: from.y + 160 }, { x: oppositeRail, y: from.y + 160 },
    { x: oppositeRail, y: to.y - 104 }, { x: to.x, y: to.y - 104 }, to,
  ] : loop ? [from,
    { x: from.x, y: from.y + 64 }, { x: rail, y: from.y + 64 },
    { x: rail, y: to.y - 72 }, { x: to.x, y: to.y - 72 }, to,
  ] : [from, { x: from.x, y: middle }, { x: to.x, y: middle }, to];
  let path = `M ${from.x} ${from.y}`;
  for (let index = 1; index < vertices.length - 1; index++) {
    const previous = vertices[index - 1], corner = vertices[index], next = vertices[index + 1];
    const before = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const after = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(route.radius, width < 300 ? 28 : 48, before / 2, after / 2);
    if (!radius) continue;
    const start = { x: corner.x + (previous.x - corner.x) * radius / before, y: corner.y + (previous.y - corner.y) * radius / before };
    const end = { x: corner.x + (next.x - corner.x) * radius / after, y: corner.y + (next.y - corner.y) * radius / after };
    path += ` L ${start.x} ${start.y} Q ${corner.x} ${corner.y} ${end.x} ${end.y}`;
  }
  return `${path} L ${to.x} ${to.y}`;
}

/** The title sits beside its tile, or below it on narrow screens. */
export function getTopicPathCallout(width: number, point: TopicPathPoint) {
  if (width < 300) {
    return { left: 36, top: point.y + point.radius + 16, width: width - 72, height: 64 };
  }
  const onRight = point.x <= width / 2;
  const left = onRight ? point.x + point.radius + 16 : 8;
  const right = onRight ? width - 8 : point.x - point.radius - 16;
  return { left, top: point.y - 58, width: Math.max(0, right - left), height: 116 };
}
