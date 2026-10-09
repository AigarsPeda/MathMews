import { useEffect, useRef } from 'react';
import { Image, StyleSheet } from 'react-native';
import { CAT_ANIMATION_CLIPS } from '@/constants/cat-animation-clips';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import type { PetPlaybackState } from '@/pet-display/types';

type Props = { playback: PetPlaybackState; loop?: boolean; playing?: boolean; onReady?: () => void;
  onAnimationComplete?: () => void; onStepComplete?: (index: number) => void };
/** Care commands still finish when native animation is unavailable. */
export function StaticCatDisplay(props: Props) {
  const { active } = useAnimationActivity();
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; });
  useEffect(() => { callbacks.current.onReady?.(); }, []);
  useEffect(() => {
    if (!active || props.playing === false) return;
    const steps = props.playback.kind === 'scenario' ? props.playback.steps : [props.playback.segment];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      if (step.loop ?? props.loop ?? false) break;
      const clip = CAT_ANIMATION_CLIPS[step.assetKey as keyof typeof CAT_ANIMATION_CLIPS] ?? CAT_ANIMATION_CLIPS.idle;
      const seconds = step.model ? step.model.duration / step.model.rate : clip[0] / clip[1];
      elapsed += Math.max(.1, Number.isFinite(seconds) ? seconds : 1) * 1000;
      timers.push(setTimeout(() => {
        if (callbacks.current.playback.kind === 'scenario') callbacks.current.onStepComplete?.(index);
        if (index === steps.length - 1) callbacks.current.onAnimationComplete?.();
      }, elapsed));
    }
    return () => timers.forEach(clearTimeout);
  }, [active, props.playback, props.loop, props.playing]);
  return <Image source={require('@/assets/3d/cat-preview.png')} resizeMode="contain" style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]} />;
}
