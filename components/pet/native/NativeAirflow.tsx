import { useMemo } from 'react';
import { RenderCallbackContext, useAnimator, useFilamentContext, useModel } from 'react-native-filament';
import source from '@/assets/3d/native/airflow.glb';
import { NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';
export function NativeAirflow({ object, active }: {
  object: NativeRoomObject;
  active: boolean;
}) {
  const { transformManager } = useFilamentContext();
  const model = useModel(source, { shouldReleaseSourceData: false });
  const animator = useAnimator(model.state === 'loaded' ? model.asset : undefined);
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const transform = useMemo(() => {
    const center = NATIVE_MODEL_CATALOG[object.modelId].center;
    const c = Math.cos(object.heading), s = Math.sin(object.heading);
    const position: Vec3 = [object.position[0] + (c * center[0] + s * center[2]) * object.scale,
      object.position[1] + center[1] * object.scale, object.position[2] + (-s * center[0] + c * center[2]) * object.scale];
    return transformManager.createIdentityMatrix().scaling([object.scale, object.scale, object.scale]).rotate(object.heading, [0, 1, 0]).translate(position);
  }, [object, transformManager]);
  RenderCallbackContext.useRenderCallback(({ passedSeconds }) => {
    'worklet';
    if (!entity || !animator)
      return;
    transformManager.setTransform(entity, transform);
    animator.applyAnimation(0, active ? passedSeconds : 0);
    animator.updateBoneMatrices();
  }, [active, animator, entity, transform, transformManager]);
  return null;
}
