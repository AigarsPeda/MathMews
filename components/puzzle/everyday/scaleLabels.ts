/** Keep both end labels, then give important landings first choice of the available space. */
export function fitScaleLabels(
  labels: readonly number[],
  priority: readonly number[],
  unitsPerPoint: number,
  labelSpacing: number,
) {
  if (labels.length < 2) return labels;
  const kept = new Set([labels[0], labels[labels.length - 1]]);
  const distance = unitsPerPoint * labelSpacing;
  for (const value of [...priority, ...labels]) {
    if (labels.includes(value) && [...kept].every(other => Math.abs(value - other) >= distance)) {
      kept.add(value);
    }
  }
  return labels.filter(value => kept.has(value));
}
