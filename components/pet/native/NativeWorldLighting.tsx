/* Filament's render callback owns native light updates. */
/* eslint-disable react-hooks/immutability */
import { EnvironmentalLight, RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity } from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import { useEffect } from 'react';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { worldDaylight, type WorldClock } from '@/utils/world-clock';
import { isWindowLightSource } from '@/utils/native-window-light';
import type { NativeRoomObject } from '@/utils/native-room-world';
import { NativeWindowLight } from './NativeWindowLight';

const ENVIRONMENT = { uri: 'RNF_default_env_ibl.ktx' };

export function NativeWorldLighting({ clock, active, objects = [] }: { clock: WorldClock; active: boolean; objects?: NativeRoomObject[] }) {
  const now = useWorldClockNow(5000, active);
  const target = worldDaylight(clock, Math.max(now, clock.realMs));
  const level = useSharedValue({ daylight: target, applied: -1 });
  const { lightManager, scene } = useFilamentContext();
  const sun = useLightEntity(lightManager, { type: 'directional', intensity: 100_000, direction: [-1, -1, -1], castShadows: false });
  const fill = useLightEntity(lightManager, { type: 'point', intensity: 5_000_000, position: [3.5, 4, 3.5], falloffRadius: 14, castShadows: false });
  useEntityInScene(scene, sun);
  useEntityInScene(scene, fill);
  useEffect(() => { level.value = { ...level.value, applied: -1 }; }, [level, sun, fill]);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const current = level.value;
    if (current.daylight === target && Math.abs(current.applied - target) < .001) return;
    const delta = target - current.daylight;
    const next = Math.abs(delta) < .0001 ? target
      : current.daylight + delta * (1 - Math.exp(-Math.min(.1, timeSinceLastFrame) * 3));
    const changed = Math.abs(next - current.applied) >= .001;
    level.value = { daylight: next, applied: changed ? next : current.applied };
    if (!changed) return;
    const warmth = Math.max(0, 1 - Math.abs(next - .35) / .35);
    const color: [number, number, number] = [.48 + .52 * next + .1 * warmth, .58 + .38 * next - .12 * warmth, 1 - .1 * next - .38 * warmth];
    lightManager.setIntensity(sun, 1000 + 99_000 * next);
    lightManager.setIntensity(fill, 10_000 + 5_000_000 * next);
    lightManager.setColor(sun, color);
    lightManager.setColor(fill, color);
  }, [active, target, level, lightManager, sun, fill]);
  // Load the environment once. Changing its intensity would reload native textures.
  return <>
    <EnvironmentalLight source={ENVIRONMENT} intensity={2200}/>
    {objects.filter(object => isWindowLightSource(object.modelId)).map(object =>
      <NativeWindowLight key={object.instanceId} object={object} daylight={level} active={active}/>)}
  </>;
}
