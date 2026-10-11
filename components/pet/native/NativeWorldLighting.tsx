import { windowCurtains, type CurtainProgress } from '@/utils/native-curtains';
/* Filament's render callback owns native light updates. */
/* eslint-disable react-hooks/immutability */
import { EnvironmentalLight, RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { useEffect, useMemo } from 'react';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { worldDaylight, type WorldClock } from '@/utils/world-clock';
import { weatherTransmission, worldWeather } from '@/utils/world-weather';
import { isWindowLightSource } from '@/utils/native-window-light';
import type { NativeRoomObject } from '@/utils/native-room-world';
import { NativeWindowLight } from './NativeWindowLight';

const ENVIRONMENT = { uri: 'RNF_default_env_ibl.ktx' };

export function NativeWorldLighting({ clock, active, objects = [], editingObject, curtainProgress, lightning }: { clock: WorldClock; active: boolean; lightning?: ISharedValue<number>; curtainProgress?: ISharedValue<CurtainProgress>; objects?: NativeRoomObject[]; editingObject?: ISharedValue<NativeRoomObject | undefined> }) {
  const windows = useMemo(() => objects.filter(object => isWindowLightSource(object.modelId)).map(object => ({ object, curtains: windowCurtains(object, objects) })), [objects]);
  const now = useWorldClockNow(5000, active);
  const target = worldDaylight(clock, Math.max(now, clock.realMs));
  const transmission = weatherTransmission(worldWeather(clock, Math.max(now, clock.realMs)));
  const level = useSharedValue({ daylight: target, transmission, applied: -1, appliedTransmission: -1 });
  const { lightManager, scene } = useFilamentContext();
  const sun = useLightEntity(lightManager, { type: 'directional', intensity: 1000, direction: [-1, -1, -1], castShadows: lightManager.shadowMapsSupported === true });
  const fill = useLightEntity(lightManager, { type: 'point', intensity: 10_000, position: [3.5, 4, 3.5], falloffRadius: 14, castShadows: false });
  useEntityInScene(scene, sun);
  useEntityInScene(scene, fill);
  useEffect(() => { level.value = { ...level.value, applied: -1 }; }, [level, sun, fill, active]);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const current = level.value;
    if (current.daylight === target && current.transmission === transmission && Math.abs(current.applied - target) < .001) return;
    const delta = target - current.daylight;
    // Initialize/resume at the current time; only an already visible room fades.
    const next = current.applied < 0 || Math.abs(delta) < .0001 ? target
      : current.daylight + delta * (1 - Math.exp(-Math.min(.1, timeSinceLastFrame) * 3));
    const clouds = current.applied < 0 || Math.abs(transmission - current.transmission) < .0001 ? transmission
      : current.transmission + (transmission - current.transmission) * (1 - Math.exp(-Math.min(.1, timeSinceLastFrame) * 1.5));
    const changed = Math.abs(next - current.applied) >= .001 || Math.abs(clouds - current.appliedTransmission) >= .001;
    level.value = { daylight: next, transmission: clouds, applied: changed ? next : current.applied,
      appliedTransmission: changed ? clouds : current.appliedTransmission };
    if (!changed) return;
    const warmth = Math.max(0, 1 - Math.abs(next - .35) / .35);
    const color: [number, number, number] = [.48 + .52 * next + .1 * warmth, .58 + .38 * next - .12 * warmth, 1 - .1 * next - .38 * warmth];
    lightManager.setIntensity(sun, (1000 + 99_000 * next) * clouds);
    lightManager.setIntensity(fill, (10_000 + 5_000_000 * next) * clouds);
    lightManager.setColor(sun, color);
    lightManager.setColor(fill, color);
  }, [active, target, transmission, level, lightManager, sun, fill]);
  // Load the environment once. Changing its intensity would reload native textures.
  return <>
    <EnvironmentalLight source={ENVIRONMENT} intensity={2200}/>
    {windows.map(({ object, curtains }) =>
      <NativeWindowLight key={object.instanceId} object={object} curtains={curtains} curtainProgress={curtainProgress} lightning={lightning} editingObject={editingObject} daylight={level} active={active}/>)}
  </>;
}
