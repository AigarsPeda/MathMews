import { BalanceScale } from '@/components/puzzle/BalanceScale';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { equationText, type EquationState } from '@/utils/bridge-models';
import { StyleSheet, View } from 'react-native';

function Quantity({ count }: { count: number }) {
  if (count <= 0 || count > 12) return <Text style={styles.number}>{count}</Text>;
  return <View style={styles.quantity}>
    {Array.from({ length: Math.abs(count) }, (_, i) => <View key={i} style={styles.unit}>
      <Text style={styles.unitLabel}>1</Text>
    </View>)}
  </View>;
}

export function EquationBoardModel({ equation }: { equation: EquationState }) {
  const left = <View style={styles.terms}>
    <View style={styles.quantity}>{Array.from({ length: equation.a }, (_, i) => <View key={i} style={styles.xTile}><Text style={styles.x}>x</Text></View>)}</View>
    {equation.b !== 0 ? <><Text style={styles.plus}>{equation.b < 0 ? '−' : '+'}</Text><Quantity count={Math.abs(equation.b)} /></> : null}
  </View>;
  return <View style={styles.model}>
    <View testID="bridge-equation" accessible accessibilityLabel={equationText(equation)}>
      <Text style={styles.equation}>{equationText(equation)}</Text>
      <BalanceScale left={left} right={<Quantity count={equation.c} />} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  model: { gap: 6 },
  equation: { fontSize: 26, lineHeight: 34, fontWeight: '900', textAlign: 'center', color: C.text },
  terms: { alignItems: 'center', gap: 4, maxWidth: '100%' },
  quantity: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, width: 124, maxWidth: '100%' },
  unit: { minWidth: 24, minHeight: 24, paddingHorizontal: 3, borderRadius: 5, backgroundColor: D.goldLight, alignItems: 'center', justifyContent: 'center' },
  unitLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: C.text },
  xTile: { minWidth: 28, minHeight: 34, paddingHorizontal: 5, borderRadius: 6, backgroundColor: C.card, borderWidth: 2, borderColor: D.geometryEdge, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: D.geometryEdge },
  number: { fontSize: 26, lineHeight: 34, fontWeight: '900', color: C.text },
  plus: { fontSize: 16, lineHeight: 18, color: C.text },
});
