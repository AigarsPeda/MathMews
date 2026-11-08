import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import type { RatioTablePuzzle } from '@/types/puzzle';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

/** Keep the given pair, the shared change and the learner's pair in one table. */
export function RatioTableModel({ puzzle, answer }: { puzzle: RatioTablePuzzle; answer: number | null }) {
  const { t } = useTranslation();
  const { a, b, targetA, guided } = puzzle.payload;
  const divisor = (x: number, y: number): number => y === 0 ? x : divisor(y, x % y);
  const common = divisor(a, targetA);
  const factor = targetA % a === 0 ? `× ${targetA / a}`
    : a % targetA === 0 ? `÷ ${a / targetA}` : `× ${targetA / common}/${a / common}`;
  const pictures = guided && puzzle.difficulty === 'easy';
  const groups = (count: number, known: boolean) => <View style={styles.groups}>
    {Array.from({ length: count }, (_, i) => <View key={i} style={[styles.group, !known && styles.emptyGroup]}>
      {known ? Array.from({ length: b }, (_, j) => <View key={j} style={styles.unit} />)
        : <Text style={styles.groupQuestion}>?</Text>}
    </View>)}
  </View>;
  return <View testID="bridge-ratio-model" style={styles.table}>
    <View style={styles.row}>
      <Text style={styles.heading}>{t('bridge.groups')}</Text>
      <Text style={styles.heading}>{t('bridge.items')}</Text>
    </View>
    <View style={styles.row} accessible accessibilityLabel={t('bridge.ratioPair', { groups: a, items: b })}>
      <View style={styles.cell}><Text style={styles.number}>{a}</Text></View>
      <View style={styles.cell}><Text style={styles.number}>{b}</Text></View>
    </View>
    {pictures ? <View accessible accessibilityLabel={t('bridge.knownGroup', { count: b })} style={styles.pictureRow}>
      {groups(1, true)}<Text style={styles.caption}>{t('bridge.knownGroup', { count: b })}</Text>
    </View> : null}
    {guided ? <View style={styles.change} accessible accessibilityLabel={t('bridge.ratioChange', { operation: factor })}>
      {[0, 1].map(column => <View key={column} style={styles.changeCell}>
        <View style={styles.arrow}><View style={styles.arrowHead} /></View><Text style={styles.factor}>{factor}</Text>
      </View>)}
    </View> : null}
    <View style={[styles.row, styles.target]} accessible accessibilityLabel={t('bridge.ratioPair', { groups: targetA, items: answer ?? '?' })}>
      <View style={styles.cell}><Text style={styles.number}>{targetA}</Text></View>
      <View style={styles.cell}><Text testID="bridge-ratio-answer" style={[styles.number, styles.answer]}>{answer ?? '?'}</Text></View>
    </View>
    {pictures ? <View style={styles.pictureRow} accessible accessibilityLabel={t('bridge.unknownGroups', { count: targetA })}>
      {groups(targetA, false)}<Text style={styles.caption}>{t('bridge.unknownGroups', { count: targetA })}</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  table: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  heading: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center', color: C.textMuted, paddingVertical: 4 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 },
  number: { fontSize: 26, lineHeight: 34, fontWeight: '900', color: C.text },
  answer: { color: C.primaryDark },
  target: { backgroundColor: D.geometrySurface, borderRadius: 12 },
  change: { flexDirection: 'row', paddingVertical: 4 },
  changeCell: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 2, height: 26, backgroundColor: D.geometryEdge, marginBottom: 4 },
  arrowHead: { position: 'absolute', bottom: 0, left: -4, width: 10, height: 10, borderBottomWidth: 2, borderRightWidth: 2, borderColor: D.geometryEdge, transform: [{ rotate: '45deg' }] },
  factor: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: D.geometryEdge },
  pictureRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  group: { minWidth: 42, minHeight: 30, padding: 6, borderWidth: 2, borderColor: D.geometryEdge, backgroundColor: D.geometrySurface, borderRadius: 8, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  emptyGroup: { backgroundColor: C.card, borderStyle: 'dashed' },
  unit: { width: 10, height: 10, borderRadius: 3, backgroundColor: D.geometryEdge },
  groupQuestion: { fontSize: 16, lineHeight: 18, fontWeight: '700', color: D.geometryEdge },
  caption: { fontSize: 14, lineHeight: 20, color: C.textMuted, flexShrink: 1, textAlign: 'center' },
});
