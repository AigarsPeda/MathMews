import { VisualExplanationScene } from '@/components/puzzle/VisualExplanationScene';
import { GameColors } from '@/constants/game';
import type { VisualExplanation } from '@/types/visual-explanation';
import { interpolateVisualFrame } from '@/constants/visual-explanations';
import { moderateScale } from '@/utils/scale';
import Slider from '@react-native-community/slider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

type VisualExplanationPlayerProps = {
  explanation: VisualExplanation;
  progress: number;
  onProgressChange: (value: number) => void;
};

export function VisualExplanationPlayer({
  explanation,
  progress,
  onProgressChange,
}: VisualExplanationPlayerProps) {
  const { t } = useTranslation();
  const frame = useMemo(
    () => interpolateVisualFrame(explanation.keyframes, progress),
    [explanation.keyframes, progress],
  );

  const stepCount = explanation.keyframes.length;
  const activeStep = Math.round(progress * Math.max(0, stepCount - 1));

  return (
    <View style={styles.wrap}>
      <VisualExplanationScene scene={frame.scene} />

      <Text style={styles.caption}>
        {frame.captionKey ? t(frame.captionKey) : ''}
      </Text>

      <View style={styles.sliderRow}>
        <Text style={styles.sliderEmoji}>⏮️</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={progress}
          onValueChange={onProgressChange}
          minimumTrackTintColor={GameColors.primary}
          maximumTrackTintColor={GameColors.cardBorder}
          thumbTintColor={GameColors.secondary}
          accessibilityLabel={t('visualHelp.a11ySlider')}
        />
        <Text style={styles.sliderEmoji}>⏭️</Text>
      </View>

      <View style={styles.dots}>
        {explanation.keyframes.map((keyframe, index) => (
          <View
            key={keyframe.captionKey}
            style={[styles.dot, index === activeStep && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: moderateScale(12),
  },
  caption: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    color: GameColors.text,
    textAlign: 'center',
    lineHeight: moderateScale(24),
    minHeight: moderateScale(48),
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  slider: {
    flex: 1,
    height: moderateScale(40),
  },
  sliderEmoji: {
    fontSize: moderateScale(18),
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: moderateScale(6),
  },
  dot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: GameColors.cardBorder,
  },
  dotActive: {
    backgroundColor: GameColors.primary,
    width: moderateScale(20),
  },
});
