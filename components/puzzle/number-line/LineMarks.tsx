import { View } from 'react-native';
import { Quantity } from '@/constants/puzzle-theme';

export function LineDot({ palette = Quantity.teal }: { palette?: { fill: string; edge: string } }) {
  const disc = { position: 'absolute' as const, width: 28, height: 28, borderRadius: 14 };
  return <View style={{ width: 28, height: 31 }}>
    <View style={[disc, { top: 3, backgroundColor: palette.edge }]} />
    <View style={[disc, { top: 0, backgroundColor: palette.fill }]} />
  </View>;
}

// Candidates arrive in priority order. Reserve their actual, edge-clamped boxes.
export function placeLineLabels(candidates: { n: number; center: number; width: number }[], modelWidth: number, rows = 2) {
  const lanes = Array.from({ length: rows }, () => [] as { left: number; right: number }[]);
  return candidates.flatMap(({ n, center, width }) => {
    width = Math.min(width, modelWidth);
    const left = Math.max(0, Math.min(modelWidth - width, center - width / 2));
    for (const [row, lane] of lanes.entries()) {
      // A small shift keeps close labels on one line while their ticks stay fixed.
      const choices = [left, ...lane.flatMap(box => [box.left - width - 8, box.right + 8])]
        .filter(x => x >= 0 && x + width <= modelWidth && Math.abs(x - left) <= 8)
        .sort((a, b) => Math.abs(a - left) - Math.abs(b - left));
      const position = choices.find(x => lane.every(box => x + width + 8 <= box.left || x >= box.right + 8));
      if (position === undefined) continue;
      lane.push({ left: position, right: position + width });
      return [{ n, left: position, width, row }];
    }
    return [];
  });
}
