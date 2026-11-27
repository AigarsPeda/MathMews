import { BaseTenGrid } from '@/components/puzzle/BaseTenGrid';
import { useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { countabilityFloor } from '@/components/puzzle/kit/DenseLayout';
import { ValueChip } from '@/components/puzzle/kit/PuzzleKit';
import { PercentageShareBar } from '@/components/puzzle/percentage/PercentageShareBar';
import { Shape, Stroke } from '@/constants/puzzle-theme';
import type { PercentageExample } from '@/types/puzzle';
import { percentageShareParts } from '@/utils/percentage-reveal';
import { moderateScale } from '@/utils/scale';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

const gap = Shape.space.group;
const preferredGridSize = 246;

export function PercentageGivenModel({ example }: { example: PercentageExample }) {
  const { t } = useTranslation();
  const { whole, percent } = example;
  const { width, fontScale } = useWindowDimensions();
  const viewport = useProofViewport();
  const [shareWidth, setShareWidth] = useState(0);
  const [labelLayout, setLabelLayout] = useState<{ key: string; height: number }>();
  const share = example.kind === 'amount' ? percentageShareParts(percent) : null;
  const wholeLabel = t('percentageSolution.whole', { whole: t('percentageSolution.coins', { count: whole }) });
  const availableWidth = viewport?.innerWidth ?? width - 52;
  const availableHeight = viewport?.availableModelHeight ?? Infinity;
  if (share) return <View nativeID="play-entry-model" testID="play-entry-model" style={styles.model} onLayout={e => setShareWidth(e.nativeEvent.layout.width)}>
    <PercentageShareBar parts={share} width={Math.min(shareWidth || availableWidth, availableWidth, width - 32)} whole={whole} />
  </View>;

  const cell = countabilityFloor('cell', fontScale >= 1.5);
  const minimumGridSize = 10 * (cell + Shape.space.seam) + Stroke.outline;
  const labelKey = `${availableWidth}:${fontScale}:${wholeLabel}`;
  const stackedLabelHeight = labelLayout?.key === labelKey ? labelLayout.height : Math.max(32, 25 * fontScale);
  const stackedGridHeight = availableHeight - stackedLabelHeight - gap;
  const sideGap = Shape.space.seam;
  const widthWithSideLabels = availableWidth - 2 * (58 * fontScale + sideGap);
  const labelsBeside = stackedGridHeight < minimumGridSize && widthWithSideLabels >= minimumGridSize;
  const size = Math.max(minimumGridSize, Math.min(preferredGridSize,
    labelsBeside ? widthWithSideLabels : availableWidth,
    labelsBeside ? availableHeight : stackedGridHeight));
  const sideLabelWidth = (availableWidth - size) / 2 - sideGap;
  const percentChip = <ValueChip label={`${percent}%`} tone="amber" size="sm" />;

  return <View nativeID="play-entry-model" testID="play-entry-model" style={styles.model}>
    <View testID="percentage-grid" nativeID="percentage-grid" collapsable={false}>
      <BaseTenGrid size={size} amount={percent} selected={Array.from({ length: percent }, (_, index) => index)} />
    </View>
    <View testID="percentage-chips" nativeID="percentage-chips" collapsable={false}
      style={labelsBeside ? [styles.sideLabels, { height: size }] : styles.labels}
      onLayout={labelsBeside ? undefined : event => {
        const { height } = event.nativeEvent.layout;
        setLabelLayout(previous => previous?.key === labelKey && previous.height === height ? previous : { key: labelKey, height });
      }}>
      {labelsBeside ? <View style={[styles.sideLane, { width: sideLabelWidth }]}>{percentChip}</View> : percentChip}
      <ValueChip label={wholeLabel} size="sm"
        style={labelsBeside ? [styles.sideChip, { width: sideLabelWidth }] : undefined}
        textStyle={labelsBeside ? styles.sideChipText : undefined} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  model: { alignSelf: 'stretch', alignItems: 'center', gap },
  labels: { maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap },
  sideLabels: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideLane: { alignItems: 'center' },
  sideChip: { paddingHorizontal: 2 },
  sideChipText: { fontSize: moderateScale(14) },
});
