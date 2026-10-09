/* Native material updates run on Filament's drawing thread. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { RenderCallbackContext, useFilamentContext, type FilamentAsset } from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { windowFrameEmission, windowPaneColor } from '@/utils/native-window-light';
import { worldDaylight, type WorldClock } from '@/utils/world-clock';

const PANE_NAMES = ['Window glass', 'Sky blue glass', 'Arched glass lower pane', 'Arched sky glass', 'Round sky glass',
  'Window light reflection', 'Porthole reflection'];

export function NativeWindowPane({ asset, clock, active }: {
  asset: FilamentAsset; clock: WorldClock; active: boolean;
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
  const level = useSharedValue({ daylight: target, applied: -1 });
  useEffect(() => { level.value = { ...level.value, applied: -1 }; }, [level, materials]);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const current = level.value;
    const delta = target - current.daylight;
    const next = Math.abs(delta) < .0001 ? target : current.daylight + delta * (1 - Math.exp(-Math.min(.1, timeSinceLastFrame) * 3));
    const changed = Math.abs(next - current.applied) >= .001;
    level.value = { daylight: next, applied: changed ? next : current.applied };
    if (!changed) return;
    for (const { material, sky, reflection } of materials) {
      if (!sky) {
        material.setFloat4Parameter('emissiveFactor', windowFrameEmission(next));
        continue;
      }
      // The opaque blue mesh represents the outside sky. Room lights must
      // not create bright spots on it or reverse the apparent light source.
      const color = windowPaneColor(next);
      const reflectionLift = .012 + .068 * next;
      material.setFloat4Parameter('baseColorFactor', reflection
        ? [color[0] + reflectionLift, color[1] + reflectionLift, color[2] + reflectionLift, 1] : color);
    }
  }, [active, asset, materials, level, target]);
  return null;
}
