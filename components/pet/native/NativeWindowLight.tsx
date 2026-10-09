import { curtainLightTransmission, type CurtainCoverage, type CurtainProgress } from '@/utils/native-curtains';
import { nativeRoomPreview } from '@/utils/native-room-preview';
/* Filament's render callback owns native light updates. */
/* eslint-disable react-hooks/immutability */
import { RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity, type Float3 } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { useEffect } from 'react';
import type { NativeRoomObject } from '@/utils/native-room-world';
import { windowLightColor, windowLightConfig, windowLightIntensity } from '@/utils/native-window-light';

export function NativeWindowLight({ object, daylight, active, editingObject, curtains = [], curtainProgress, lightning }: {
  lightning?: ISharedValue<number>;
  curtains?: CurtainCoverage[]; curtainProgress?: ISharedValue<CurtainProgress>;
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
  object: NativeRoomObject; daylight: ISharedValue<{ daylight: number; transmission?: number }>; active: boolean;
}) {
  const { lightManager, scene } = useFilamentContext();
  const source = windowLightConfig(object);
  const light = useLightEntity(lightManager, { type: 'spot',
    intensity: 0, falloffRadius: 7, spotLightCone: [.55, 1], castShadows: false });
  useEntityInScene(scene, light);
  const applied = useSharedValue<{ key: number; position: number[] }>({ key: -1, position: [] });
  const [x, y, z] = source.position, [dx, dy, dz] = source.direction;
  useEffect(() => { applied.value = { key: -1, position: [] }; }, [applied, light, source.area, x, y, z, dx, dy, dz]);
  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    if (!active) return;
    const next = daylight.value.daylight;
    const flash = lightning?.value ?? 0;
    const transmission = (daylight.value.transmission ?? 1) * curtainLightTransmission(curtains, curtainProgress?.value ?? {});
    const key = next + 2 * transmission + 4 * flash;
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    const position: Float3 = preview
      ? source.position.map((v, i) => v + preview.position[i] - object.position[i]) as Float3 : source.position;
    if (Math.abs(key - applied.value.key) < .001 && position.every((v, i) => v === applied.value.position[i])) return;
    applied.value = { key, position };
    // The native setters accept one flat vector; Filament's TS declarations
    // incorrectly describe these two arguments as arrays of vectors.
    lightManager.setPosition(light, position as unknown as Float3[]);
    lightManager.setDirection(light, source.direction as unknown as Float3[]);
    lightManager.setIntensity(light, windowLightIntensity(source.area, next, flash) * transmission);
    const color = windowLightColor(next, flash);
    lightManager.setColor(light, color);
  }, [active, daylight, lightning, curtains, curtainProgress, applied, editingObject, object.instanceId, object.position, light, lightManager, source.area, x, y, z, dx, dy, dz]);
  return null;
}
