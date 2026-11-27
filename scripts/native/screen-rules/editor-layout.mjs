const tolerancePt = 0.5;

export function editorLayout(question, check) {
  if (!question?.frame || !check?.frame) return null;
  const coordinates = [question.frame, check.frame].flatMap(
    ({ x, y, width, height }) => [x, y, width, height],
  );
  if (!coordinates.every(Number.isFinite)) return null;
  return { label: question.AXLabel, coordinates };
}

export function sameEditorLayout(previous, current) {
  if (!previous || !current || previous.label !== current.label) return false;
  return current.coordinates.every(
    (value, i) => Math.abs(value - previous.coordinates[i]) <= tolerancePt,
  );
}
