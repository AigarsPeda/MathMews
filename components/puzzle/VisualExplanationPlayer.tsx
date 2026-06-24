import { VisualExplanationScene } from '@/components/puzzle/VisualExplanationScene';
import { GameColors } from '@/constants/game';
import {
  getVisualFrameBlend,
  progressForVisualHelpStep,
  snapVisualHelpProgress,
} from '@/constants/visual-explanations';
import type { VisualExplanation } from '@/types/visual-explanation';
import { moderateScale } from '@/utils/scale';
import Slider from '@react-native-community/slider';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const SLIDE_DISTANCE = moderateScale(28);

type VisualExplanationPlayerProps = {
  explanation: VisualExplanation;
  progress: number;
  onProgressChange: (value: number) => void;
};

type CrossfadeLayerProps = {
  opacity: number;
  translateX: number;
  children: ReactNode;
};

function CrossfadeLayer({ opacity, translateX, children }: CrossfadeLayerProps) {
  if (opacity <= 0.01) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          opacity,
          transform: [{ translateX }],
        },
      ]}
    >
      {children}
    </View>
  );
}

export function VisualExplanationPlayer({
  explanation,
  progress,
  onProgressChange,
}: VisualExplanationPlayerProps) {
  const { t } = useTranslation();
  const stepCount = explanation.keyframes.length;
  const activeStep = Math.round(progress * Math.max(0, stepCount - 1));

  const frameBlend = useMemo(
    () => getVisualFrameBlend(explanation.keyframes, progress),
    [explanation.keyframes, progress],
  );

  const showTransition = frameBlend.blend > 0.01 && frameBlend.blend < 0.99;
  const outgoingOpacity = showTransition ? 1 - frameBlend.blend : frameBlend.blend < 0.5 ? 1 : 0;
  const incomingOpacity = showTransition ? frameBlend.blend : frameBlend.blend >= 0.5 ? 1 : 0;
  const outgoingShift = showTransition ? -frameBlend.blend * SLIDE_DISTANCE : 0;
  const incomingShift = showTransition ? (1 - frameBlend.blend) * SLIDE_DISTANCE : 0;

  const goToStep = useCallback(
    (stepIndex: number) => {
      onProgressChange(progressForVisualHelpStep(stepIndex, stepCount));
    },
    [onProgressChange, stepCount],
  );

  const handleSlidingComplete = useCallback(
    (value: number) => {
      onProgressChange(snapVisualHelpProgress(value, stepCount));
    },
    [onProgressChange, stepCount],
  );

  const canGoBack = activeStep > 0;
  const canGoForward = activeStep < stepCount - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.stageHost}>
        <CrossfadeLayer opacity={outgoingOpacity} translateX={outgoingShift}>
          <VisualExplanationScene scene={frameBlend.from.scene} />
        </CrossfadeLayer>
        <CrossfadeLayer opacity={incomingOpacity} translateX={incomingShift}>
          <VisualExplanationScene scene={frameBlend.to.scene} />
        </CrossfadeLayer>
      </View>

      <View style={styles.captionHost}>
        {showTransition ? (
          <>
            <Text style={[styles.caption, { opacity: outgoingOpacity }]}>
              {t(frameBlend.from.captionKey)}
            </Text>
            <View style={styles.captionOverlay} pointerEvents="none">
              <Text style={[styles.caption, { opacity: incomingOpacity }]}>
                {t(frameBlend.to.captionKey)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.caption}>
            {t(
              frameBlend.blend >= 0.5
                ? frameBlend.to.captionKey
                : frameBlend.from.captionKey,
            )}
          </Text>
        )}
      </View>

      <View style={styles.sliderRow}>
        <Pressable
          onPress={() => goToStep(activeStep - 1)}
          disabled={!canGoBack}
          style={[styles.stepBtn, !canGoBack && styles.stepBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('visualHelp.a11yPrevStep')}
        >
          <Text style={styles.sliderEmoji}>⏮️</Text>
        </Pressable>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={progress}
          onValueChange={onProgressChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor={GameColors.primary}
          maximumTrackTintColor={GameColors.cardBorder}
          thumbTintColor={GameColors.secondary}
          accessibilityLabel={t('visualHelp.a11ySlider')}
        />
        <Pressable
          onPress={() => goToStep(activeStep + 1)}
          disabled={!canGoForward}
          style={[styles.stepBtn, !canGoForward && styles.stepBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('visualHelp.a11yNextStep')}
        >
          <Text style={styles.sliderEmoji}>⏭️</Text>
        </Pressable>
      </View>

      <View style={styles.dots}>
        {explanation.keyframes.map((keyframe, index) => {
          const isActive = index === activeStep;

          return (
            <Pressable
              key={keyframe.captionKey}
              onPress={() => goToStep(index)}
              accessibilityRole="button"
              accessibilityLabel={t('visualHelp.a11yGoToStep', {
                step: index + 1,
                total: stepCount,
              })}
            >
              <View
                style={[styles.dot, isActive ? styles.dotActive : styles.dotIdle]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: moderateScale(12),
  },
  stageHost: {
    width: '100%',
    minHeight: moderateScale(180),
    position: 'relative',
    justifyContent: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  captionHost: {
    minHeight: moderateScale(48),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  caption: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    color: GameColors.text,
    textAlign: 'center',
    lineHeight: moderateScale(24),
    paddingHorizontal: moderateScale(4),
  },
  captionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  stepBtn: {
    minWidth: moderateScale(36),
    minHeight: moderateScale(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
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
    alignItems: 'center',
    gap: moderateScale(6),
    minHeight: moderateScale(10),
  },
  dot: {
    height: moderateScale(8),
    borderRadius: moderateScale(4),
  },
  dotIdle: {
    width: moderateScale(8),
    backgroundColor: GameColors.cardBorder,
  },
  dotActive: {
    width: moderateScale(22),
    backgroundColor: GameColors.primary,
  },
});
