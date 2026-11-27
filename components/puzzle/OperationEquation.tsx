import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import { MATH_OPERATORS, type MathOperator } from '@/types/puzzle';
import { PuzzleText as Text } from './PuzzleText';

const display = (op: MathOperator) => op === '-' ? '−' : op;
type Face = 'number' | 'target' | 'empty' | 'focus' | 'key';

export const PAIR_TILE = 60;

export function EquationTile({ value, face, size = PAIR_TILE, width = size, fontSize = 26 }: {
  value?: number | string; face: Face; size?: number; width?: number; fontSize?: number;
}) {
  return <View style={[styles.tile, styles[face], { width, height: size }]}>
    <Text numberOfLines={1} maxFontSizeMultiplier={1} style={[styles.text, { fontSize }]}>{value}</Text>
  </View>;
}

function Relation({ children }: { children: string }) {
  return <Text maxFontSizeMultiplier={1.2} style={[styles.text, styles.relation]}>{children}</Text>;
}

export function PairEquation({ target, slots, miss = false }: { target: number; slots: ReactNode[]; miss?: boolean }) {
  return <View style={[styles.row, styles.pairRow]}>{slots[0]}<Relation>+</Relation>{slots[1]}<Relation>{miss ? '≠' : '='}</Relation><EquationTile face="target" value={target} /></View>;
}

export function OperationEquation({ numbers, operators, target, focus, onFocus, miss, missedSlot, entry }: {
  numbers: number[]; operators: readonly (MathOperator | null)[]; target: number; focus?: number;
  onFocus?: (index: number) => void; miss?: boolean; missedSlot?: number; entry?: boolean;
}) {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(0);
  const values = [...numbers, target];
  const slots = numbers.length - 1;
  const gap = 4;
  const reserved = 24 + gap * (2 * numbers.length);
  const room = available - reserved;
  const numberWidth = (value: number, font: number) => 24 + Math.ceil(String(value).length * font * 0.65);
  const required = (font: number) => values.reduce((sum, value) => sum + numberWidth(value, font), slots * 40);
  const font = room >= required(28) ? 28 : 24;
  const extra = Math.max(0, (room - required(font)) / (values.length + slots));
  const scale = available > 0 ? Math.min(1, available / (required(font) + reserved)) : 1;
  const height = 56;

  return <View style={[styles.viewport, { height: height * scale }]} onLayout={e => setAvailable(e.nativeEvent.layout.width)} nativeID={entry ? 'play-entry-model' : undefined} testID={entry ? 'play-entry-model' : undefined}>
    <View style={[styles.row, { gap, transform: [{ scale }] }]}>
      {numbers.map((value, i) => {
        const op = operators[i - 1];
        const slot = <EquationTile size={height} width={40 + extra} fontSize={24} face={miss && i - 1 === missedSlot ? 'target' : i - 1 === focus ? 'focus' : op ? 'key' : 'empty'} value={op ? display(op) : i - 1 === focus ? '?' : undefined} />;
        return <Fragment key={i}>{i > 0 && (onFocus ? <Pressable accessibilityRole="button"
          accessibilityState={{ selected: focus === i - 1 }} accessibilityLabel={t('puzzleTypes.operationPathSlot', { step: i, operator: op ? display(op) : '?' })}
          onPress={() => onFocus(i - 1)}>{slot}</Pressable> : slot)}<EquationTile size={height} width={numberWidth(value, font) + extra} fontSize={font} value={value} face="number" /></Fragment>;
      })}
      <Relation>{miss ? '≠' : '='}</Relation><EquationTile size={height} width={numberWidth(target, font) + extra} fontSize={font} value={target} face="target" />
    </View>
  </View>;
}

export function OperatorPicker({ focus, selected, pick }: { focus: number; selected?: MathOperator | null; pick: (op: MathOperator) => void }) {
  const { t } = useTranslation();
  return <View style={styles.row}>{MATH_OPERATORS.map(op => <Pressable key={op} testID={`operator-choice-${op}`}
    accessibilityRole="button" accessibilityLabel={t('puzzleTypes.pickOperatorForStep', { operator: op, step: focus + 1 })}
    accessibilityState={{ selected: op === selected, disabled: focus < 0 }} disabled={focus < 0} onPress={() => pick(op)}>
    <EquationTile size={52} face={op === selected ? 'focus' : 'key'} value={display(op)} />
  </Pressable>)}</View>;
}

const styles = StyleSheet.create({
  viewport: { alignSelf: 'stretch', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pairRow: { width: '100%', justifyContent: 'space-between' },
  tile: { alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderBottomWidth: 3 },
  text: { color: Ink.text, textAlign: 'center', fontSize: 24, fontWeight: '800', includeFontPadding: false, fontVariant: ['tabular-nums'] },
  relation: { width: 24 },
  number: { backgroundColor: Quantity.teal.fill, borderBottomColor: Quantity.teal.edge },
  target: { backgroundColor: Quantity.amber.fill, borderBottomColor: Quantity.amber.edge },
  empty: { backgroundColor: Shape.empty, borderBottomColor: Shape.emptyLip },
  focus: { backgroundColor: Quantity.teal.fill, borderBottomColor: Quantity.teal.edge },
  key: { backgroundColor: Quantity.violet.fill, borderBottomColor: Quantity.violet.edge },
});
