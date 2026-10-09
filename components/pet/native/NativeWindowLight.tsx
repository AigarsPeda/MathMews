/* Filament's render callback owns native light updates. */
/* eslint-disable react-hooks/immutability */
import { RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity, type Float3 } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { useEffect } from 'react';
import type { NativeRoomObject } from '@/utils/native-room-world';
import { windowLightColor, windowLightConfig, windowLightIntensity } from '@/utils/native-window-light';

export function NativeWindowLight({ object, daylight, active }: {
  object: NativeRoomObject; daylight: ISharedValue<{ daylight: number }>; active: boolean;
}) {
  const { lightManager, scene } = useFilamentContext();
  const source = windowLightConfig(object);
  const light = useLightEntity(lightManager, { type: 'spot',
    intensity: 0, falloffRadius: 7, spotLightCone: [.55, 1], castShadows: false });
  useEntityInScene(scene, light);
  const applied = useSharedValue(-1);
  const [x, y, z] = source.position, [dx, dy, dz] = source.direction;
  useEffect(() => { applied.value = -1; }, [applied, light, source.area, x, y, z, dx, dy, dz]);
  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    if (!active) return;
    const next = daylight.value.daylight;
    if (Math.abs(next - applied.value) < .001) return;
    applied.value = next;
    // The native setters accept one flat vector; Filament's TS declarations
    // incorrectly describe these two arguments as arrays of vectors.
    lightManager.setPosition(light, source.position as unknown as Float3[]);
    lightManager.setDirection(light, source.direction as unknown as Float3[]);
    lightManager.setIntensity(light, windowLightIntensity(source.area, next));
    const color = windowLightColor(next);
    lightManager.setColor(light, color);
  }, [active, daylight, applied, light, lightManager, source.area, x, y, z, dx, dy, dz]);
  return null;
}
