import { EntryBuild } from './kit/PracticeAffordances';
import { DiagramIcon, type DiagramIconTone } from './kit/DiagramIcon';
import type { PuzzleObject } from '@/types/puzzle-object';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

export function PuzzleObjectImage({ object, primary, tone, size, entryIndex }: {
  object: PuzzleObject; primary?: boolean; tone?: DiagramIconTone; size?: number; entryIndex?: number;
}) {
  const [measured, setMeasured] = useState(0);
  const actual = size ?? measured;
  const glyph = actual > 0 && <DiagramIcon name={object} size={actual} tone={tone ?? (primary === false ? 'secondary' : 'primary')} />;
  return <View style={size === undefined ? styles.image : { width: size, height: size }}
    onLayout={size === undefined ? e => setMeasured(Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height)) : undefined}>
    {glyph && entryIndex != null ? <EntryBuild index={entryIndex}>{glyph}</EntryBuild> : glyph}
  </View>;
}

/** Both options share the same five columns, even in the last partial row. */
export function PuzzleObjectCollection({ object, count, capacity, animate = false }: { object: PuzzleObject; count: number; capacity: number; animate?: boolean }) {
  const columns = 5;
  const rows = Math.max(1, Math.ceil(capacity / columns));
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.collection, { aspectRatio: columns / rows, maxWidth: rows > 3 ? 210 : 286 }]}>
    {Array.from({ length: rows }, (_, row) => <View key={row} style={styles.row}>
      {Array.from({ length: columns }, (_, column) => <View key={column} style={styles.cell}>
        {row * columns + column < count ? <PuzzleObjectImage object={object} entryIndex={animate ? row * columns + column : undefined} /> : null}
      </View>)}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  image: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  collection: { width: '100%', alignSelf: 'center' },
  row: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, padding: 1 },
});
