import { RoundedTile } from '@/components/puzzle/kit/FriendlyShapes';
import { Quantity, Shape } from '@/constants/puzzle-theme';
import { fractionGridDimensions } from '@/utils/fraction-models';
import { moderateScale } from '@/utils/scale';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const violet = Quantity.violet;

type Preview = { start: number; end: number; opacity: SharedValue<number> };

export function FractionGridChart({ denominator, shaded, size = moderateScale(76), selected, highlighted, preview }: {
  denominator: number; shaded: number; size?: number;
  selected?: readonly number[]; highlighted?: readonly number[]; preview?: Preview;
}) {
  const { cols, rows } = fractionGridDimensions(denominator);
  const height = size * rows / cols;
  const gap = Math.min(Shape.space.seam, Math.max(0, (size - cols) / Math.max(1, cols - 1)));
  const width = (size - (cols - 1) * gap) / cols;
  const tileHeight = (height - (rows - 1) * gap) / rows;
  return <View style={{ width: size, height, alignSelf: 'center', backgroundColor: Shape.seamColor }}
    pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {Array.from({ length: denominator }, (_, index) => {
      const filled = selected ? selected.includes(index) : index < shaded;
      const fill = filled ? highlighted?.includes(index) ? violet.onFill : violet.fill : Shape.empty;
      return <View key={index} style={{ position: 'absolute', left: index % cols * (width + gap),
        top: Math.floor(index / cols) * (tileHeight + gap) }}>
        <RoundedTile width={width} height={tileHeight} fill={fill} edge={filled ? violet.edge : Shape.emptyLip} />
        {preview && index >= preview.start && index < preview.end ? <GridPreview width={width} height={tileHeight} opacity={preview.opacity} /> : null}
      </View>;
    })}
  </View>;
}

function GridPreview({ width, height, opacity }: { width: number; height: number; opacity: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>
    <RoundedTile width={width} height={height} fill={violet.fill} edge={violet.edge} />
  </Animated.View>;
}
