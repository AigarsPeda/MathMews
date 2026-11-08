import { DiagramColors as D } from '@/constants/puzzle-theme';
import { moderateScale } from '@/utils/scale';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/** A level scale represents equality; both pans always have the same dimensions. */
export function BalanceScale({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <View style={styles.scale}>
    <View style={styles.row}>
      {[left, right].map((content, index) => <View key={index} style={styles.arm}>
        <View style={styles.pan}>{content}</View>
        <View pointerEvents="none" style={styles.support} />
      </View>)}
    </View>
    <View pointerEvents="none" style={styles.beam}><View style={styles.pivot} /></View>
    <View pointerEvents="none" style={styles.stem} />
    <View pointerEvents="none" style={styles.foot} />
  </View>;
}

const styles = StyleSheet.create({
  scale: { width: '100%', alignItems: 'center', paddingHorizontal: moderateScale(8), paddingVertical: moderateScale(6) },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: moderateScale(28), width: '100%' },
  arm: { flex: 1, alignItems: 'center' },
  pan: { flex: 1, width: '100%', minHeight: moderateScale(64), padding: moderateScale(10),
    flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', gap: moderateScale(6), alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderBottomWidth: moderateScale(6), borderColor: D.geometryEdge,
    borderTopLeftRadius: moderateScale(12), borderTopRightRadius: moderateScale(12),
    borderBottomLeftRadius: moderateScale(24), borderBottomRightRadius: moderateScale(24), backgroundColor: D.geometrySurface },
  support: { height: moderateScale(14), width: moderateScale(6), backgroundColor: D.geometryEdge },
  beam: { width: '84%', height: moderateScale(12), borderRadius: moderateScale(6), backgroundColor: D.gold,
    borderBottomWidth: 3, borderColor: D.goldEdge, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  pivot: { width: moderateScale(20), height: moderateScale(20), borderRadius: moderateScale(10),
    backgroundColor: D.goldLight, borderWidth: 3, borderColor: D.goldEdge },
  stem: { width: moderateScale(18), height: moderateScale(20), backgroundColor: D.gold },
  foot: { width: moderateScale(92), height: moderateScale(14), borderRadius: moderateScale(7),
    backgroundColor: D.gold, borderBottomWidth: 4, borderColor: D.goldEdge },
});
