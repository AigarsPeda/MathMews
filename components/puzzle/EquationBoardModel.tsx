import { BalanceScale } from '@/components/puzzle/BalanceScale';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { DiagramColors as D, PuzzleColors as C } from '@/constants/puzzle-theme';
import { equationText, type EquationState } from '@/utils/bridge-models';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

export type EquationStep = { before: EquationState; after: EquationState; operation: string };

function Quantity({ count }: { count: number }) {
  if (count === 0 || Math.abs(count) > 12) return <Text style={styles.number}>{count}</Text>;
  return <View style={styles.quantity}>
    {Array.from({ length: Math.abs(count) }, (_, i) => <View key={i} style={[styles.unit, count < 0 && styles.negative]}>
      <Text style={styles.unitLabel}>{count < 0 ? '−1' : '1'}</Text>
    </View>)}
  </View>;
}

export function EquationBoardModel({ equation, step }: { equation: EquationState; step: EquationStep | null }) {
  const { t } = useTranslation();
  const left = <View style={styles.terms}>
    <View style={styles.quantity}>{Array.from({ length: equation.a }, (_, i) => <View key={i} style={styles.xTile}><Text style={styles.x}>x</Text></View>)}</View>
    {equation.b !== 0 ? <><Text style={styles.plus}>+</Text><Quantity count={equation.b} /></> : null}
  </View>;
  return <View style={styles.model}>
    {step ? <View testID="bridge-equation-step" accessible accessibilityLiveRegion="polite"
      accessibilityLabel={`${equationText(step.before)}. ${t('bridge.operationBoth', { operation: step.operation })}. ${equationText(equation)}`}>
      <View style={styles.stepRow}>
        <Text style={styles.before}>{equationText(step.before).split('=')[0].trim()}</Text>
        <Text style={styles.equals}>=</Text><Text style={styles.before}>{step.before.c}</Text>
      </View>
      <View style={styles.stepRow}>
        {[0, 1].map(side => <View key={side} style={styles.operation}><Text style={styles.operationText}>{step.operation}</Text><View style={styles.arrow} /></View>)}
      </View>
    </View> : null}
    <View testID="bridge-equation" accessible accessibilityLabel={equationText(equation)}>
      <Text style={styles.equation}>{equationText(equation)}</Text>
      <BalanceScale left={left} right={<Quantity count={equation.c} />} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  model: { gap: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  before: { flex: 1, textAlign: 'center', fontSize: 18, lineHeight: 25, fontWeight: '700', color: C.textMuted },
  equals: { fontSize: 18, color: C.textMuted },
  operation: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  operationText: { fontSize: 16, lineHeight: 22, fontWeight: '900', color: C.primaryDark },
  arrow: { width: 8, height: 8, borderRightWidth: 2, borderBottomWidth: 2, borderColor: C.primaryDark, transform: [{ rotate: '45deg' }] },
  equation: { fontSize: 26, lineHeight: 34, fontWeight: '900', textAlign: 'center', color: C.text },
  terms: { alignItems: 'center', gap: 4, maxWidth: '100%' },
  quantity: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, width: 124, maxWidth: '100%' },
  unit: { minWidth: 24, minHeight: 24, paddingHorizontal: 3, borderRadius: 5, backgroundColor: D.goldLight, alignItems: 'center', justifyContent: 'center' },
  negative: { backgroundColor: C.card, borderWidth: 1, borderColor: D.geometryEdge },
  unitLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: C.text },
  xTile: { minWidth: 30, minHeight: 34, paddingHorizontal: 5, borderRadius: 6, backgroundColor: C.card, borderWidth: 2, borderColor: D.geometryEdge, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: D.geometryEdge },
  number: { fontSize: 26, lineHeight: 34, fontWeight: '900', color: C.text },
  plus: { fontSize: 16, lineHeight: 18, color: C.text },
});
