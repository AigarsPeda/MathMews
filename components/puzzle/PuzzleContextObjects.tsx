import { PuzzleObjectImage } from '@/components/puzzle/PuzzleObjectImage';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as C } from '@/constants/puzzle-theme';
import type { Puzzle } from '@/types/puzzle';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

/** Authored givens only. Large sets use a labelled multiplier, never a solved total. */
export function PuzzleContextObjects({ objects }: { objects: NonNullable<Puzzle['contextObjects']> }) {
  const { t } = useTranslation();
  return <View style={styles.row}>{objects.map((item, index) => {
    const name = t(`taskObjects.${item.object}`);
    const role = item.role ? t(`objectGivens.${item.role}`) : '';
    const count = item.count !== undefined && item.count <= 12 ? item.count : 1;
    return <View key={index} style={styles.group} accessible accessibilityLabel={[role, item.count, name].filter(value => value !== undefined && value !== '').join(' ')}>
      {role ? <Text style={styles.label}>{role}</Text> : null}
      <View style={styles.pictures} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: count }, (_, i) => <View key={i} style={count > 1 ? styles.small : styles.picture}><PuzzleObjectImage object={item.object} primary={item.primary} /></View>)}
      </View>
      <Text style={styles.label}>{item.count !== undefined ? `${item.count > 12 ? '× ' : ''}${item.count} ` : ''}{name}</Text>
    </View>;
  })}</View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  group: { flex: 1, minWidth: 88, maxWidth: 132, alignItems: 'center', gap: 8 },
  pictures: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, maxWidth: 132 },
  picture: { width: 64, height: 64 },
  small: { width: 30, height: 30 },
  label: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: C.text, textAlign: 'center' },
});
