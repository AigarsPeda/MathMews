/* Filament's drawing thread owns the reusable outdoor particle pool. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import { RenderCallbackContext, useFilamentContext, useModel, useWorkletEffect } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import source from '@/assets/3d/native/window-weather.glb';
import paneData from '@/constants/window-weather-panes.json';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { worldDaylight, type WorldClock } from '@/utils/world-clock';
import { weatherParticle, weatherTransmission, windowWatchLeaf, worldWeather, WEATHER_PARTICLES, type WeatherPane } from '@/utils/world-weather';
import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

const PANES: Record<string, WeatherPane[]> = paneData;
const KINDS = ['rain', 'snow', 'leaves'] as const;
const RAIN_HAZE = 1 - weatherTransmission('rain');
const SNOW_HAZE = 1 - weatherTransmission('snow');

export function NativeWindowWeather({ object, clock, active, reduceMotion, editingObject, watchTarget, lightning }: {
  lightning?: ISharedValue<number>;
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
  watchTarget?: ISharedValue<Vec3 | undefined>;
  object: NativeRoomObject; clock?: WorldClock; active: boolean; reduceMotion: boolean;
}) {
  const { transformManager, renderableManager, scene } = useFilamentContext();
  const model = useModel(source, { shouldReleaseSourceData: false, addToScene: false });
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
  const scenery = useMemo(() => ['Landscape', 'Wet terrain', 'Snow cover', 'Autumn foliage', 'Night lights', 'Cottage lights'].flatMap(name => {
    const entity = asset?.getFirstEntityByName(`${name} ${object.modelId}`);
    return entity ? [{ entity, material: renderableManager.getMaterialInstanceAt(entity, 0) }] : [];
  }), [asset, object.modelId, renderableManager]);
  useWorkletEffect(() => {
    'worklet';
    if (!asset) return;
    const entities = [...particles.map(p => p.entity), ...scenery.map(p => p.entity)];
    for (const { entity } of scenery) renderableManager.setCastShadow(entity, false);
    scene.addEntities(entities);
    return () => { 'worklet'; scene.removeEntities(entities); };
  });
  const now = useWorldClockNow(5000, active);
  const weather = clock ? worldWeather(clock, Math.max(now, clock.realMs)) : 'clear';
  const daylight = clock ? worldDaylight(clock, Math.max(now, clock.realMs)) : 1;
  const showLandscape = !!clock;
  const state = useSharedValue({ seconds: 0, rain: Number(weather === 'rain'), snow: Number(weather === 'snow'),
    leaves: Number(weather === 'leaves'), light: daylight, flash: 0, applied: false, placement: [] as number[] });
  useEffect(() => { state.value = { ...state.value, applied: false }; }, [active, rootTransform, asset, daylight, showLandscape, reduceMotion, weather, state]);
  const watchSeconds = useSharedValue(0);
  useEffect(() => {
    watchSeconds.value = 0;
    state.value = { ...state.value, applied: false };
    return () => { if (watchTarget) watchTarget.value = undefined; };
  }, [watchTarget, watchSeconds, state]);
  const panes = PANES[object.modelId];
  const windowSeed = useMemo(() => {
    let n = 0;
    for (const ch of object.instanceId ?? '') n = (31 * n + ch.charCodeAt(0)) % 8191;
    return n;
  }, [object.instanceId]);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active || !root || !asset || !panes?.length) return;
    const current = state.value;
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    const position = preview ? preview.position : object.position;
    const placement = [...position, preview?.heading ?? object.heading, preview?.scale ?? object.scale];
    const moved = placement.some((v, i) => v !== current.placement[i]);
    const dt = Math.min(.1, timeSinceLastFrame);
    const next = { ...current, seconds: reduceMotion ? 0 : current.seconds + dt };
    for (const kind of KINDS) {
      const target = weather === kind ? 1 : 0;
      next[kind] = reduceMotion || Math.abs(target - current[kind]) < .002 ? target
        : current[kind] + (target - current[kind]) * (1 - Math.exp(-dt * 1.5));
    }
    next.light = reduceMotion || Math.abs(daylight-current.light) < .001 ? daylight
      : current.light + (daylight-current.light) * (1-Math.exp(-dt*3));
    next.flash = reduceMotion ? 0 : lightning?.value ?? 0;
    const changed = KINDS.some(kind => current[kind] !== next[kind]) || current.light !== next.light || current.flash !== next.flash;
    if (watchTarget && !reduceMotion) watchSeconds.value += dt;
    if (current.applied && !changed && !moved && (reduceMotion || (!watchTarget && weather === 'clear'))) return;
    transformManager.openLocalTransformTransaction();
    if (moved || !current.applied) transformManager.setTransform(root, preview
      ? identity.scaling([preview.scale, preview.scale, preview.scale]).rotate(preview.heading, [0, 1, 0]).translate(position) : rootTransform);
    for (const { entity, kind, index } of particles) {
      const watched = !!watchTarget && kind === 'leaves' && index === 0;
      if (!watched && current.applied && current[kind] === 0 && next[kind] === 0) continue;
      const pane = panes[index % panes.length];
      const pose = watched ? windowWatchLeaf(reduceMotion ? 1.2 : watchSeconds.value, pane) : weatherParticle(kind, index, next.seconds, pane, windowSeed);
      const visible = (watched || next[kind] > .002) && pose.visible;
      if (watched && visible) {
        const heading = preview?.heading ?? object.heading, scale = preview?.scale ?? object.scale;
        const c = Math.cos(heading), s = Math.sin(heading);
        watchTarget!.value = [position[0] + scale*(c*pose.x+s*pose.z),
          position[1] + scale*pose.y, position[2] + scale*(c*pose.z-s*pose.x)];
      }
      transformManager.setTransform(entity, visible
        ? identity.scaling([pose.sx, pose.sy, 1]).rotate(pose.rotation, [0, 0, 1]).translate([pose.x, pose.y, pose.z])
        : identity.scaling([.00001, .00001, .00001]).translate([0, 0, -10]));
    }
    transformManager.commitLocalTransformTransaction();
    if (scenery.length === 6 && (!current.applied || changed)) {
      const light = next.light;
      const transmission = 1 - RAIN_HAZE*next.rain - SNOW_HAZE*next.snow;
      const night = showLandscape ? (1-light)*(1-light) : 0;
      const [landscape, wetTerrain, snowCover, foliage, skyLights, cottageLights] = scenery;
      // The same lightning pulse lights the landscape, the glass and the room.
      const ambient = transmission * (1-next.flash);
      const r = (.055+.945*light)*ambient + .7*next.flash, g = (.078+.922*light)*ambient + .84*next.flash;
      const b = (.17+.83*light)*ambient + next.flash;
      landscape.material.setFloat4Parameter('baseColorFactor', [r,g,b,showLandscape ? 1 : 0]);
      wetTerrain.material.setFloat4Parameter('baseColorFactor', [r,g,b,showLandscape ? next.rain : 0]);
      snowCover.material.setFloat4Parameter('baseColorFactor', [r,g,b,showLandscape ? next.snow : 0]);
      foliage.material.setFloat4Parameter('baseColorFactor', [r,g,b,showLandscape ? next.leaves : 0]);
      skyLights.material.setFloat4Parameter('baseColorFactor', [.9,.85,.78, night*Math.max(0, 1-next.rain-next.snow)]);
      cottageLights.material.setFloat4Parameter('baseColorFactor', [.9,.85,.78, night*transmission]);
    }
    // Unlit materials keep outdoor particles independent of interior lamps.
    for (const { kind, material } of materials) {
      if (current.applied && current[kind] === next[kind]) continue;
      const brightness = .45 + .55 * daylight;
      const alpha = (watchTarget && kind === 'leaves' ? 1 : next[kind]) * (kind === 'rain' ? .82 : 1);
      material.setFloat4Parameter('baseColorFactor', kind === 'leaves'
        ? [brightness, brightness, brightness, alpha]
        : kind === 'snow' ? [.89 * brightness, .96 * brightness, brightness, alpha]
        : [.65 * brightness, .8 * brightness, brightness, alpha]);
    }
    // Commit last because current is a live view of the shared object.
    state.value = { ...next, applied: true, placement };
  }, [active, reduceMotion, watchTarget, watchSeconds, object.heading, object.scale, root, asset, panes, windowSeed, weather, daylight, showLandscape, lightning, scenery, state, editingObject, object.instanceId, object.position, particles, materials, identity, rootTransform, transformManager]);
  return null;
}
