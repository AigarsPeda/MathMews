import { useMemo } from 'react';
import { RenderCallbackContext, useFilamentContext, useModel } from 'react-native-filament';
import type { ISharedValue } from 'react-native-worklets-core';
import source from '@/assets/3d/native/guided-feather.glb';
import type { Vec3 } from '@/utils/native-room-world';

export function NativeGuidedFeather({ position, scale }: { position: ISharedValue<Vec3 | undefined>; scale: number }) {
  const model = useModel(source);
  const { transformManager } = useFilamentContext();
  const root = model.state === 'loaded' ? model.rootEntity : undefined;
  const identity = useMemo(() => transformManager.createIdentityMatrix(), [transformManager]);
  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    if (!root) return;
    const point = position.value;
    // Enlarge the tuft for a finger-sized target and place its center at the paw contact.
    const size = point ? scale * 1.55 : .00001;
    transformManager.setTransform(root, identity.scaling([size, size, size])
      .translate(point ? [point[0], point[1] + .09 * size, point[2]] : [0, -10, 0]));
  }, [root, identity, transformManager, position, scale]);
  return null;
}
