import { DiagramColors as D } from '@/constants/puzzle-theme';
import { moderateScale } from '@/utils/scale';
import { useState, type ReactNode } from 'react';
import { Animated, Image, StyleSheet, useWindowDimensions, View } from 'react-native';

const weightArt = require('@/assets/3d/education-props/balance-weight.png');
const beamArt = require('@/assets/3d/education-props/balance-beam.png');
const baseArt = require('@/assets/3d/education-props/balance-base.png');
const armGap = moderateScale(28);

function NumberWeight({ width, children }: { width: number; children: ReactNode }) {
  const [labelHeight, setLabelHeight] = useState(0);
  // The enamel plate occupies the middle third of the render. Allow wrapped
  // equations and larger system text to enlarge both the weight and its mate.
  return <View style={[styles.weight, { minHeight: Math.max(width * 492 / 672, labelHeight / .33) }]}>
    <Image source={weightArt} style={styles.sprite} accessible={false} resizeMode="stretch" />
    <View style={styles.plate}>
      <View style={styles.inscription} onLayout={e => setLabelHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </View>
  </View>;
}

/** Each load stays upright as the beam rotates around its fixed pedestal. */
export function BalanceScale({ left, right, tilt, numberWeights = false }: {
  left: ReactNode; right: ReactNode; tilt?: Animated.Value; numberWeights?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [span, setSpan] = useState(0);
  const rowWidth = span || Math.min(width, 480) - moderateScale(48);
  const weightWidth = (rowWidth - armGap) / 2;
  const lift = (rowWidth + armGap) / 4 * Math.tan(6 * Math.PI / 180);
  const beamWidth = rowWidth * .84;
  const beamHeight = beamWidth * 126 / 1200;
  return <View style={styles.scale}>
    <View style={styles.row} onLayout={e => setSpan(e.nativeEvent.layout.width)}>
      {[left, right].map((content, index) => <Animated.View key={index} style={[styles.arm, index === 0 && styles.front, tilt && {
        transform: [{ translateY: Animated.multiply(tilt, index === 0 ? -lift : lift) }],
      }]}>
        {numberWeights ? <NumberWeight width={weightWidth}>{content}</NumberWeight> : <>
          <View style={styles.pan}>{content}</View>
          <View pointerEvents="none" style={styles.support} />
        </>}
      </Animated.View>)}
    </View>
    <Animated.View pointerEvents="none" style={[{ width: beamWidth, height: beamHeight, marginTop: -beamHeight / 2 }, styles.beam, tilt && {
      transform: [{ rotate: tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) }],
    }]}>
      <Image source={beamArt} accessible={false} style={styles.sprite} resizeMode="stretch" />
    </Animated.View>
    <Image source={baseArt} accessible={false} resizeMode="stretch"
      style={{ width: beamWidth * 2.19 / 7.64, aspectRatio: 468 / 225, height: undefined, marginTop: -beamHeight / 2 }} />
  </View>;
}

const styles = StyleSheet.create({
  scale: { width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', paddingHorizontal: moderateScale(8), paddingVertical: moderateScale(6) },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: armGap, width: '100%' },
  front: { zIndex: 1 },
  arm: { flex: 1, alignItems: 'center' },
  weight: { flexGrow: 1, width: '100%' },
  sprite: { position: 'absolute', width: '100%', height: '100%' },
  plate: { position: 'absolute', top: '42%', bottom: '24%', left: '16%', right: '16%', justifyContent: 'center' },
  inscription: { flexDirection: 'row', flexWrap: 'wrap', columnGap: moderateScale(3), alignItems: 'center', justifyContent: 'center' },
  pan: { flex: 1, width: '100%', minHeight: moderateScale(64), padding: moderateScale(10),
    flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', gap: moderateScale(6), alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderBottomWidth: moderateScale(6), borderColor: D.geometryEdge,
    borderTopLeftRadius: moderateScale(12), borderTopRightRadius: moderateScale(12),
    borderBottomLeftRadius: moderateScale(24), borderBottomRightRadius: moderateScale(24), backgroundColor: D.geometrySurface },
  support: { height: moderateScale(14), width: moderateScale(6), backgroundColor: D.geometryEdge },
  beam: { zIndex: 1 },
});
