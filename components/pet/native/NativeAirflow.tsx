import { useMemo } from 'react';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import type { ISharedValue } from 'react-native-worklets-core';
import { RenderCallbackContext, useAnimator, useFilamentContext, useModel } from 'react-native-filament';
import source from '@/assets/3d/native/airflow.glb';
import { type NativeRoomObject } from '@/utils/native-room-world';
import { airflowOrigin } from '@/utils/native-airflow';
export function NativeAirflow({ object, active, editingObject }: {
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
  object: NativeRoomObject;
  active: boolean;
}) {
  const { transformManager } = useFilamentContext();
  const model = useModel(source, { shouldReleaseSourceData: false });
  const animator = useAnimator(model.state === 'loaded' ? model.asset : undefined);
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const transform = useMemo(() => {
    const position = airflowOrigin(object);
    return transformManager.createIdentityMatrix().scaling([object.scale, object.scale, object.scale]).rotate(object.heading, [0, 1, 0]).translate(position);
  }, [object, transformManager]);
  RenderCallbackContext.useRenderCallback(({ passedSeconds }) => {
    'worklet';
    if (!entity || !animator)
      return;
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    transformManager.setTransform(entity, preview
      ? transform.translate(preview.position.map((v, i) => v - object.position[i]) as [number, number, number]) : transform);
    animator.applyAnimation(0, active ? passedSeconds : 0);
    animator.updateBoneMatrices();
  }, [active, animator, entity, editingObject, object.instanceId, object.position, transform, transformManager]);
  return null;
}
