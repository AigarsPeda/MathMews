/* Curtain motion and material updates stay on the native drawing thread. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { RenderCallbackContext, useFilamentContext, type FilamentAsset } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { worldDaylight, type WorldClock } from '@/utils/world-clock';
import { weatherTransmission, worldWeather } from '@/utils/world-weather';
import { advanceCurtain, curtainEmission, curtainPanelPose, curtainPanelTilt, curtainWindowCoverage, CURTAIN_ROD_HEIGHT, type CurtainProgress } from '@/utils/native-curtains';
import type { NativeRoomObject } from '@/utils/native-room-world';

export function NativeCurtain({ asset, object, windows, clock, progress, active, reduceMotion, lightning }: {
  lightning?: ISharedValue<number>;
  asset: FilamentAsset; object: NativeRoomObject; windows: NativeRoomObject[]; clock?: WorldClock;
  progress: ISharedValue<CurtainProgress>; active: boolean; reduceMotion: boolean;
}) {
  const { transformManager, renderableManager, nameComponentManager } = useFilamentContext();
  const parts = useMemo(() => ['Left', 'Right'].flatMap((side, i) => {
    const entity = asset.getFirstEntityByName(`${side} curtain panel`);
    const tie = asset.getFirstEntityByName(`${side} curtain tieback`);
    return entity ? [{ entity, side: i === 0 ? -1 : 1, tie,
      identity: transformManager.createIdentityMatrix(),
      tieTransform: tie ? transformManager.getTransform(tie) : undefined }] : [];
  }), [asset, transformManager]);
  const materials = useMemo(() => asset.getRenderableEntities().flatMap(entity => {
    if (!(nameComponentManager.getEntityName(entity) ?? '').startsWith('Folded curtain fabric')) return [];
    return Array.from({ length: renderableManager.getPrimitiveCount(entity) }, (_, i) => {
      const material = renderableManager.getMaterialInstanceAt(entity, i);
      return { material, base: material.getFloat4Parameter('baseColorFactor') };
    });
  }), [asset, nameComponentManager, renderableManager]);
  const exposure = useMemo(() => Math.max(0, ...windows.map(window => curtainWindowCoverage(window, object))), [windows, object]);
  const tilt = useMemo(() => curtainPanelTilt(object, windows), [object, windows]);
  const target = object.curtainOpen === false ? 0 : 1;
  const state = useSharedValue({ open: target, applied: -1, light: -1 });
  useEffect(() => { state.value = { ...state.value, applied: -1, light: -1 }; }, [state, parts, materials, tilt]);
  const now = useWorldClockNow(5000, active);
  const daylight = clock ? worldDaylight(clock, Math.max(now, clock.realMs)) : 1;
  const clouds = clock ? weatherTransmission(worldWeather(clock, Math.max(now, clock.realMs))) : 1;
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const previous = state.value;
    const open = advanceCurtain(previous.open, target, timeSinceLastFrame, reduceMotion);
    if (open !== previous.applied) {
      for (const part of parts) {
        const pose = curtainPanelPose(open, part.side);
        transformManager.setTransform(part.entity, part.identity.scaling([pose.width, 1, 1])
          .translate([0, -CURTAIN_ROD_HEIGHT, 0]).rotate(-tilt, [1, 0, 0]).translate([pose.x, CURTAIN_ROD_HEIGHT, 0]));
        if (part.tie && part.tieTransform)
          transformManager.setTransform(part.tie, part.tieTransform.scaling([Math.max(.0001, pose.tieback), Math.max(.0001, pose.tieback), Math.max(.0001, pose.tieback)]));
      }
      progress.value = { ...progress.value, [object.instanceId]: open };
    }
    const flash = lightning?.value ?? 0;
    const light = daylight + 2 * clouds + 4 * exposure + 8 * flash;
    if (open !== previous.applied || light !== previous.light) {
      for (const { material, base } of materials)
        material.setFloat4Parameter('emissiveFactor', curtainEmission(base, daylight, clouds, exposure, open, flash));
    }
    if (open !== previous.applied || light !== previous.light)
      state.value = { open, applied: open, light };
  }, [active, reduceMotion, target, state, parts, materials, progress, object.instanceId, exposure, daylight, clouds, lightning, transformManager, tilt]);
  return null;
}
