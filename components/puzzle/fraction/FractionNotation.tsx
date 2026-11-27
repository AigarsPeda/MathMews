import { UnknownWell } from '@/components/puzzle/kit/PuzzleKit';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink, Quantity, Radius, Stroke } from '@/constants/puzzle-theme';
import { StyleSheet, View } from 'react-native';

export function FractionNotation({ numerator, denominator, given = false, compact = false }: {
  numerator: number | string; denominator: number | string; given?: boolean; compact?: boolean;
}) {
  const numberStyle = [styles.number, compact && styles.compactNumber];
  return <View accessible accessibilityLabel={`${numerator}/${denominator}`}
    style={[styles.stack, compact && styles.compact, given && styles.given]}>
    {numerator === '?' ? <UnknownWell size="sm" /> : <Text numberOfLines={1} style={numberStyle}>{numerator}</Text>}
    <View style={styles.rule} />
    <Text numberOfLines={1} style={numberStyle}>{denominator}</Text>
  </View>;
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center', gap: 2, minWidth: 30 },
  compact: { minWidth: 18, gap: 0 },
  compactNumber: { fontSize: 14, lineHeight: 17 },
  given: { minWidth: 56, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.piece, backgroundColor: Quantity.violet.soft },
  number: { color: Ink.text, fontVariant: ['tabular-nums'], fontSize: 26, fontWeight: '800' },
  rule: { height: Stroke.outline, alignSelf: 'stretch', backgroundColor: Ink.text, borderRadius: Radius.piece },
});
