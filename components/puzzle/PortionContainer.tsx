import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

/** One empty destination shows the portion size, never the number to fill. */
export function PortionContainer({ kind, amount }: { kind: 'cup' | 'bottle' | 'bowl'; amount: number }) {
  const { t } = useTranslation();
  return <View style={styles.wrap}>
    <View style={styles.drawing}>
      {kind === 'cup' ? <View style={styles.handle} /> : null}
      {kind === 'bottle' ? <View style={styles.neck} /> : null}
      <View style={[styles.body, kind === 'bottle' && styles.bottle, kind === 'bowl' && styles.bowl]} />
    </View>
    <Text style={styles.label}>{t(`everyday.portion_${kind}`, { amount })}</Text>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { width: 100, alignSelf: 'center', alignItems: 'center', gap: 8 },
  drawing: { width: 100, height: 94 },
  body: { position: 'absolute', left: 14, top: 24, width: 60, height: 64, borderWidth: 3, borderColor: D.glassEdge, backgroundColor: D.glass, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  handle: { position: 'absolute', left: 65, top: 35, width: 28, height: 36, borderWidth: 5, borderColor: D.glassEdge, borderRadius: 12 },
  neck: { position: 'absolute', left: 33, top: 0, width: 26, height: 30, borderWidth: 3, borderColor: D.glassEdge, backgroundColor: D.glass },
  bottle: { left: 20, top: 25, width: 52, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  bowl: { left: 4, top: 54, width: 90, height: 34, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  label: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: C.text, textAlign: 'center' },
});
