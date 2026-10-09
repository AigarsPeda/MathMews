/* Filament's drawing thread owns the reusable outdoor particle pool. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import { RenderCallbackContext, useFilamentContext, useModel } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import source from '@/assets/3d/native/window-weather.glb';
import paneData from '@/constants/window-weather-panes.json';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { worldDaylight, type WorldClock } from '@/utils/world-clock';
import { weatherParticle, worldWeather, WEATHER_PARTICLES, type WeatherPane } from '@/utils/world-weather';
import type { NativeRoomObject } from '@/utils/native-room-world';

const PANES: Record<string, WeatherPane[]> = paneData;
const KINDS = ['rain', 'snow', 'leaves'] as const;

export function NativeWindowWeather({ object, clock, active, reduceMotion, editingObject }: {
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
  object: NativeRoomObject; clock: WorldClock; active: boolean; reduceMotion: boolean;
}) {
  const { transformManager, renderableManager } = useFilamentContext();
  const model = useModel(source, { shouldReleaseSourceData: false });
  const asset = model.state === 'loaded' ? model.asset : undefined;
  const root = model.state === 'loaded' ? model.rootEntity : undefined;
  const identity = useMemo(() => transformManager.createIdentityMatrix(), [transformManager]);
  const rootTransform = useMemo(() => identity.scaling([object.scale, object.scale, object.scale])
    .rotate(object.heading, [0, 1, 0]).translate(object.position), [identity, object.heading, object.position, object.scale]);
  const particles = useMemo(() => KINDS.flatMap(kind => Array.from({ length: WEATHER_PARTICLES[kind] }, (_, index) => {
    const entity = asset?.getFirstEntityByName(`${kind} ${index}`);
    return entity ? [{ entity, kind, index }] : [];
  }).flat()), [asset]);
  const materials = useMemo(() => KINDS.flatMap(kind => {
    const entity = asset?.getFirstEntityByName(`${kind} 0`);
    return entity ? [{ kind, material: renderableManager.getMaterialInstanceAt(entity, 0) }] : [];
  }), [asset, renderableManager]);
  const now = useWorldClockNow(5000, active);
  const weather = worldWeather(clock, Math.max(now, clock.realMs));
  const daylight = worldDaylight(clock, Math.max(now, clock.realMs));
  const state = useSharedValue({ seconds: 0, rain: 0, snow: 0, leaves: 0, applied: false, position: [] as number[] });
  useEffect(() => { state.value = { ...state.value, applied: false }; }, [active, rootTransform, asset, daylight, reduceMotion, weather, state]);
  const panes = PANES[object.modelId];
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active || !root || !asset || !panes?.length) return;
    const current = state.value;
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    const position = preview ? preview.position : object.position;
    const moved = position.some((v, i) => v !== current.position[i]);
    const dt = Math.min(.1, timeSinceLastFrame);
    const next = { ...current, seconds: reduceMotion ? 0 : current.seconds + dt };
    for (const kind of KINDS) {
      const target = weather === kind ? 1 : 0;
      next[kind] = reduceMotion || Math.abs(target - current[kind]) < .002 ? target
        : current[kind] + (target - current[kind]) * (1 - Math.exp(-dt * 1.5));
    }
    const changed = KINDS.some(kind => current[kind] !== next[kind]);
    if (current.applied && !changed && !moved && (reduceMotion || weather === 'clear')) return;
    state.value = { ...next, applied: true, position };
    transformManager.openLocalTransformTransaction();
    transformManager.setTransform(root, preview
      ? identity.scaling([preview.scale, preview.scale, preview.scale]).rotate(preview.heading, [0, 1, 0]).translate(position) : rootTransform);
    for (const { entity, kind, index } of particles) {
      if (current.applied && current[kind] === 0 && next[kind] === 0) continue;
      const pane = panes[index % panes.length];
      const pose = weatherParticle(kind, index, next.seconds, pane);
      const visible = next[kind] > .002 && pose.visible;
      transformManager.setTransform(entity, visible
        ? identity.scaling([pose.sx, pose.sy, 1]).rotate(pose.rotation, [0, 0, 1]).translate([pose.x, pose.y, pose.z])
        : identity.scaling([.00001, .00001, .00001]).translate([0, 0, -10]));
    }
    transformManager.commitLocalTransformTransaction();
    // Unlit materials keep outdoor particles independent of interior lamps.
    for (const { kind, material } of materials) {
      if (current.applied && current[kind] === next[kind]) continue;
      const brightness = .45 + .55 * daylight;
      const alpha = next[kind] * (kind === 'rain' ? .75 : 1);
      material.setFloat4Parameter('baseColorFactor', kind === 'leaves'
        ? [.8 * brightness, .32 * brightness, .065 * brightness, alpha]
        : [.65 * brightness, .8 * brightness, brightness, alpha]);
    }
  }, [active, reduceMotion, root, asset, panes, weather, daylight, state, editingObject, object.instanceId, object.position, particles, materials, identity, rootTransform, transformManager]);
  return null;
}
