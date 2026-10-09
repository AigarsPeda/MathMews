/* Native material updates run on Filament's drawing thread. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { RenderCallbackContext, useFilamentContext, type FilamentAsset } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { windowFrameEmission, windowPaneColor } from '@/utils/native-window-light';
import { worldDaylight, type WorldClock } from '@/utils/world-clock';
import { weatherTransmission, worldWeather } from '@/utils/world-weather';

const PANE_NAMES = ['Window glass', 'Sky blue glass', 'Arched glass lower pane', 'Arched sky glass', 'Round sky glass',
  'Window light reflection', 'Porthole reflection'];

export function NativeWindowPane({ asset, clock, active, lightning }: {
  asset: FilamentAsset; clock: WorldClock; active: boolean; lightning?: ISharedValue<number>;
}) {
  const { renderableManager, nameComponentManager } = useFilamentContext();
  const materials = useMemo(() => asset.getRenderableEntities().flatMap(entity => {
    const name = nameComponentManager.getEntityName(entity) ?? '';
    const sky = PANE_NAMES.some(pane => name === pane || name.startsWith(pane + '.'));
    return Array.from({ length: renderableManager.getPrimitiveCount(entity) }, (_, index) =>
      ({ material: renderableManager.getMaterialInstanceAt(entity, index), sky, reflection: name.includes('reflection') }));
  }), [asset, renderableManager, nameComponentManager]);
  const now = useWorldClockNow(5000, active);
  const target = worldDaylight(clock, Math.max(now, clock.realMs));
  const transmission = weatherTransmission(worldWeather(clock, Math.max(now, clock.realMs)));
  const level = useSharedValue({ daylight: target, transmission, applied: -1, appliedTransmission: -1, appliedFlash: -1 });
  useEffect(() => { level.value = { ...level.value, applied: -1 }; }, [level, materials]);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const current = level.value;
    const flash = lightning?.value ?? 0;
    const delta = target - current.daylight;
    const next = Math.abs(delta) < .0001 ? target : current.daylight + delta * (1 - Math.exp(-Math.min(.1, timeSinceLastFrame) * 3));
    const clouds = Math.abs(transmission - current.transmission) < .0001 ? transmission
      : current.transmission + (transmission - current.transmission) * (1 - Math.exp(-Math.min(.1, timeSinceLastFrame) * 1.5));
    const changed = Math.abs(next - current.applied) >= .001 || Math.abs(clouds - current.appliedTransmission) >= .001 || Math.abs(flash - current.appliedFlash) >= .001;
    level.value = { daylight: next, transmission: clouds, applied: changed ? next : current.applied,
      appliedTransmission: changed ? clouds : current.appliedTransmission, appliedFlash: changed ? flash : current.appliedFlash };
    if (!changed) return;
    for (const { material, sky, reflection } of materials) {
      if (!sky) {
        const emission = windowFrameEmission(next, flash);
        material.setFloat4Parameter('emissiveFactor', [emission[0] * clouds, emission[1] * clouds, emission[2] * clouds, 1]);
        continue;
      }
      // The opaque blue mesh represents the outside sky. Room lights must
      // not create bright spots on it or reverse the apparent light source.
      const outside = windowPaneColor(next, flash);
      const color: [number, number, number, number] = [outside[0] * clouds, outside[1] * clouds, outside[2] * clouds, 1];
      const reflectionLift = .012 + .068 * next;
      material.setFloat4Parameter('baseColorFactor', reflection
        ? [color[0] + reflectionLift, color[1] + reflectionLift, color[2] + reflectionLift, 1] : color);
    }
  }, [active, asset, materials, level, target, transmission, lightning]);
  return null;
}
