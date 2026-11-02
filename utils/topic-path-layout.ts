export type TopicPathPoint = { x: number; y: number; diameter: number; radius: number };

/** Paired stops and stepped turns stay in place when the next level unlocks. */
export function getTopicPathLayout(width: number, count: number, currentIndex: number) {
  const diameter = Math.min(88, Math.max(80, width * 0.25));
  const activeDiameter = diameter + 16;
  const inset = activeDiameter / 2 + 8 + 12;
  const span = Math.max(0, width - inset * 2);
  const lanes = [0, 0, 0.78, 1, 1, 0.22];
  const points: TopicPathPoint[] = [];
  let y = 100;
  for (let index = 0; index < count; index++) {
    if (index > 0) y += width < 300 ? 248 : lanes[index % lanes.length] === lanes[(index - 1) % lanes.length] ? 256 : 164;
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

/** Solid orthogonal connections, with broad loops between paired stops. */
export function getTopicPathConnection(width: number, from: { x: number; y: number }, to: { x: number; y: number }) {
  const loop = to.y - from.y >= 200 && (width < 300 || Math.abs(from.x - to.x) < 1);
  const middle = (from.y + to.y) / 2;
  const rail = from.x < width / 2 ? width - 20 : 20;
  const vertices = loop ? [from,
    { x: from.x, y: from.y + 72 }, { x: rail, y: from.y + 72 },
    { x: rail, y: to.y - 72 }, { x: to.x, y: to.y - 72 }, to,
  ] : [from, { x: from.x, y: middle }, { x: to.x, y: middle }, to];
  let path = `M ${from.x} ${from.y}`;
  for (let index = 1; index < vertices.length - 1; index++) {
    const previous = vertices[index - 1], corner = vertices[index], next = vertices[index + 1];
    const before = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const after = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(32, before / 2, after / 2);
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
