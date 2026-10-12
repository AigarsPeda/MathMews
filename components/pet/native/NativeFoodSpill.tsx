import { useMemo } from 'react';
import { RenderCallbackContext, useAnimator, useFilamentContext, useModel } from 'react-native-filament';
import type { ISharedValue } from 'react-native-worklets-core';
import { getFeedingEffectSource } from '@/constants/feeding-effects';
import type { NativeRoomObject } from '@/utils/native-room-world';

/** Each meal effect follows its feeder and the rendered cat's eating clock. */
export function NativeFoodSpill({ object, active, animationTime }: {
  object: NativeRoomObject;
  active: boolean;
  animationTime: ISharedValue<{ name: string; time: number }>;
}) {
  const { transformManager } = useFilamentContext();
  const model = useModel(getFeedingEffectSource(object.modelId), { shouldReleaseSourceData: false });
  const animator = useAnimator(model.state === 'loaded' ? model.asset : undefined);
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const transform = useMemo(() => transformManager.createIdentityMatrix()
    .scaling([object.scale, object.scale, object.scale])
    .rotate(object.heading, [0, 1, 0]).translate(object.position), [object, transformManager]);
  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    if (!entity || !animator || !active) return;
    transformManager.setTransform(entity, transform);
    const phase = animationTime.value;
    animator.applyAnimation(0, phase.name === 'eating' ? Math.min(phase.time, animator.getAnimationDuration(0)) : 0);
    animator.updateBoneMatrices();
  }, [active, animationTime, animator, entity, transform, transformManager]);
  return null;
}
