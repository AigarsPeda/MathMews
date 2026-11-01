/** Keep the visible edges (including the active halo) apart, even at a bend. */
export function getTopicPathLayout(width: number, count: number, currentIndex: number) {
  const diameter = Math.min(64, Math.max(56, width * 0.18));
  const activeDiameter = diameter + 16;
  const halo = 12;
  const inset = activeDiameter / 2 + halo + 8;
  const amplitude = Math.max(0, (width - inset * 2) / 2);
  const points: { x: number; y: number; diameter: number; radius: number }[] = [];
  for (let index = 0; index < count; index++) {
    const size = index === currentIndex ? activeDiameter : diameter;
    const radius = size / 2 + (index === currentIndex ? halo : 0);
    const x = width / 2 + amplitude * Math.sin(index * Math.PI / 3 - Math.PI / 2);
    const previous = points[index - 1];
    // A 24-point clear gap includes the halo, rather than just the button face.
    const separation = previous ? previous.radius + radius + 24 : 0;
    const dx = previous ? x - previous.x : 0;
    const rise = Math.max(60, Math.sqrt(Math.max(0, separation ** 2 - dx ** 2)));
    points.push({ x, y: previous ? previous.y + rise : radius + 16, diameter: size, radius });
  }
  const last = points.at(-1);
  return { points, height: last ? last.y + last.radius + 36 : 0 };
}
