import { EntryBuild } from '../kit/PracticeAffordances';
import { UnitRun } from '../kit/UnitRun';
import { Quantity, Shape } from '@/constants/puzzle-theme';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const STRIP = 64;
type Part = { numerator: number; denominator: number };

function cellHue(index: number, end: number, submitted?: number) {
  return submitted !== undefined && index >= Math.min(submitted, end) && index < Math.max(submitted, end) ? 'amber' : 'teal';
}

function PartitionCell({ width, height, index, filled, split, end, submitted, position, reduced }: {
  width: number; height: number; index: number; filled: boolean; split: number;
  end: number; submitted?: number; position?: SharedValue<number>; reduced?: boolean;
}) {
  const cut = useAnimatedStyle(() => {
    const progress = position ? Math.max(0, Math.min(1, position.get() - (reduced ? 0 : index))) : 0;
    // While the cut grows, the cells being split are a plain tint of their own face; the white gaps only settle in at the end.
    const backgroundColor = interpolateColor(progress, [.7, 1], [filled ? Quantity.teal.fill : Shape.empty, Shape.seamColor]);
    return { height: reduced ? height : height * progress, opacity: reduced ? progress : 1, backgroundColor };
  });
  const count = Math.min(split, Math.max(0, Math.max(submitted ?? end, end) - index * split));
  const subcellGap = 4; // 4 pt between cells, 8 pt between fifths. A narrow fifth folds into 2 x 2 chunky cells so one amber cell reads at a glance.
  const wrapFour = split === 4 && (width - 3 * subcellGap) / 4 < 24;
  return <View style={{ width, height }}>
    <UnitRun width={width} height={height} count={1} filled={Number(filled)} hue="teal" />
    {position || submitted !== undefined ? <Animated.View style={[styles.overlay, position ? cut : { height, backgroundColor: Shape.seamColor }]}>
      <UnitRun width={width} height={height} count={split} columns={wrapFour ? 2 : split}
        gap={subcellGap} filled={count} hue={cell => cellHue(index * split + cell, end, submitted)} />
    </Animated.View> : null}
  </View>;
}

export function EquivalentBar({ given, denominator, width, position, reduced, submitted, enter }: {
  given: Part; denominator: number; width: number; position?: SharedValue<number>; reduced?: boolean; submitted?: number; enter?: boolean;
}) {
  const split = denominator / given.denominator;
  const inPlace = Number.isInteger(split) && split >= 1;
  const gap = split > 1 ? 8 : Math.min(10, Math.max(Shape.space.seam, width / given.denominator / 5));
  const w = (width - gap * (given.denominator - 1)) / given.denominator;
  if (!inPlace && (position || submitted !== undefined)) {
    const end = Math.round(given.numerator * split);
    return <UnitRun width={width} height={STRIP} count={denominator} filled={Math.max(submitted ?? end, end)}
      hue={index => cellHue(index, end, submitted)} />;
  }
  return <View style={[styles.run, { gap, width }]}>
    {Array.from({ length: given.denominator }, (_, i) => {
      const face = <PartitionCell width={w} height={STRIP} index={i} filled={i < given.numerator} split={inPlace ? split : 1}
        end={given.numerator * split} submitted={submitted} position={position} reduced={reduced} />;
      return enter ? <EntryBuild key={i} index={i}>{face}</EntryBuild> : <View key={i}>{face}</View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  run: { alignSelf: 'center', flexDirection: 'row', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
