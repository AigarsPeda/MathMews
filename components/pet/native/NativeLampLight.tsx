/* Native positions are updated on Filament's drawing thread. */
/* eslint-disable react-hooks/immutability */
import { useEffect } from 'react';
import { RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity, type Float3 } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { lampLightConfig, lampLightPose } from '@/utils/native-lamp-light';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import type { NativeRoomObject } from '@/utils/native-room-world';

type Props = { object: NativeRoomObject; active: boolean; editingObject?: ISharedValue<NativeRoomObject | undefined> };
export function NativeLampLight({ object, active, editingObject }: Props) {
  // Numeric properties avoid sending native light handles through shared-value listeners.
  const light = active ? lampLightConfig(object) : undefined;
  return light ? <MovingLampLight object={object} editingObject={editingObject} config={light}/> : null;
}

function MovingLampLight({ object, editingObject, config }: Omit<Props, 'active'> & { config: NonNullable<ReturnType<typeof lampLightConfig>> }) {
  'use no memo';
  const { lightManager, scene } = useFilamentContext();
  // Pose changes update the same light handle, including slider previews.
  const light = useLightEntity(lightManager, { ...config, position: [0, 0, 0], direction: [0, -1, 0] });
  useEntityInScene(scene, light);
  const applied = useSharedValue<number[]>([]);
  // Refresh and light recreation replace the native entity, even at the same pose.
  useEffect(() => { applied.value = []; }, [applied, light]);
  // Capture numbers, not JS array iterators, across the native runtime boundary.
  const px = config.position[0], py = config.position[1], pz = config.position[2];
  const dx = config.direction[0], dy = config.direction[1], dz = config.direction[2];
  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    const { position, direction } = preview ? lampLightPose({ ...object, ...preview })
      : { position: [px, py, pz], direction: [dx, dy, dz] };
    const values = [position[0], position[1], position[2], direction[0], direction[1], direction[2]];
    let changed = false;
    for (let i = 0; i < 6; i++) if (values[i] !== applied.value[i]) changed = true;
    if (!changed) return;
    applied.value = values;
    lightManager.setPosition(light, position as unknown as Float3[]);
    if (object.modelId.startsWith('wallSpot')) lightManager.setDirection(light, direction as unknown as Float3[]);
  }, [px, py, pz, dx, dy, dz, editingObject, object, applied, lightManager, light]);
  return null;
}
