import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import type { RatioTablePuzzle } from '@/types/puzzle';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

/** Identical bottles give the ratio a unit; only the requested total is unknown. */
export function RatioTableModel({ puzzle, answer }: { puzzle: RatioTablePuzzle; answer: number | null }) {
  const { t } = useTranslation();
  const { a, b, targetA } = puzzle.payload;
  const bottles = (count: number) => <View style={styles.bottles} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {Array.from({ length: count }, (_, i) => <View key={i} style={styles.bottle}>
      <View style={styles.neck} /><View style={styles.body} /><View style={styles.cap} />
    </View>)}
  </View>;
  return <View testID="bridge-ratio-model" style={styles.table}>
    <Text style={styles.instruction}>{t('bridge.sameBottles')}</Text>
    <View style={styles.headings}>
      <Text style={[styles.heading, styles.bottleColumn]}>{t('bridge.bottles')}</Text>
      <Text style={[styles.heading, styles.waterColumn]}>{t('bridge.totalLitres')}</Text>
    </View>
    {[{ count: a, total: b, target: false }, { count: targetA, total: answer, target: true }].map(row => <View key={String(row.target)} style={[styles.row, row.target && styles.targetRow]}>
      <View style={styles.bottleColumn}>
        {row.count <= 6 ? bottles(row.count) : null}
        <Text style={[styles.count, row.count > 6 && styles.largeCount]} accessibilityLabel={t('bridge.bottleCount', { count: row.count })}>{row.count}</Text>
      </View>
      <View style={styles.waterColumn}>
        <Text testID={row.target ? 'bridge-value' : undefined}
          accessibilityLabel={row.target ? t('bridge.litresAnswer', { amount: row.total ?? '?' }) : t('bridge.litresGiven', { amount: row.total })}
          style={[styles.amount, row.target && styles.answer]}>{row.total ?? '?'}</Text>
      </View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  table: { gap: 8 },
  instruction: { fontSize: 16, lineHeight: 22, color: C.textMuted, textAlign: 'center' },
  headings: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  targetRow: { backgroundColor: D.geometrySurface, borderRadius: 12 },
  bottleColumn: { flex: 1, alignItems: 'center', gap: 6 },
  waterColumn: { width: '38%', alignItems: 'center' },
  bottles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: '100%' },
  bottle: { width: 20, height: 38 },
  neck: { position: 'absolute', top: 3, left: 6, width: 8, height: 10, borderWidth: 2, borderColor: D.geometryEdge, backgroundColor: D.geometrySurface },
  body: { position: 'absolute', top: 11, width: 20, height: 27, borderWidth: 2, borderColor: D.geometryEdge, backgroundColor: D.geometrySurface, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  cap: { position: 'absolute', top: 0, left: 5, width: 10, height: 5, backgroundColor: D.geometryEdge, borderRadius: 2 },
  count: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: C.text },
  largeCount: { fontSize: 28, lineHeight: 36 },
  amount: { fontSize: 28, lineHeight: 36, fontWeight: '900', color: C.text, textAlign: 'center' },
  answer: { minWidth: 64, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderRadius: 8, borderColor: C.primary, backgroundColor: C.card, color: C.primaryDark },
});
