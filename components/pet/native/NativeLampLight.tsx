/* Native positions are updated on Filament's drawing thread. */
/* eslint-disable react-hooks/immutability */
import { RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity, type Float3 } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { lampLightConfig } from '@/utils/native-lamp-light';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import type { NativeRoomObject } from '@/utils/native-room-world';

type Props = { object: NativeRoomObject; active: boolean; editingObject?: ISharedValue<NativeRoomObject | undefined> };
export function NativeLampLight({ object, active, editingObject }: Props) {
  // Numeric properties avoid sending native light handles through shared-value listeners.
  const light = active ? lampLightConfig(object) : undefined;
  return light ? <MovingLampLight object={object} editingObject={editingObject} config={light}/> : null;
}

function MovingLampLight({ object, editingObject, config }: Omit<Props, 'active'> & { config: NonNullable<ReturnType<typeof lampLightConfig>> }) {
  const { lightManager, scene } = useFilamentContext();
  const light = useLightEntity(lightManager, config);
  useEntityInScene(scene, light);
  const applied = useSharedValue<number[]>([]);
  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    const position: Float3 = preview
      ? config.position.map((v, i) => v + preview.position[i] - object.position[i]) as Float3 : config.position;
    if (position.every((v, i) => v === applied.value[i])) return;
    applied.value = position;
    lightManager.setPosition(light, position as unknown as Float3[]);
  }, [config.position, editingObject, object.instanceId, object.position, applied, lightManager, light]);
  return null;
}
