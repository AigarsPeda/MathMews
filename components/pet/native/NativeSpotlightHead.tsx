/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { RenderCallbackContext, useFilamentContext, type FilamentAsset } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import type { SpotlightAim } from '@/utils/native-spotlight-aim';
import { normalizeSpotlightAngle, normalizeSpotlightSwivel } from '@/constants/decoration-motion';

/** Only the head pivots; the backplate and support arm remain on the wall. */
export function NativeSpotlightHead({ asset, angle, swivel, instanceId, pose }: { asset: FilamentAsset; angle?: number; swivel?: number; instanceId: string; pose?: ISharedValue<SpotlightAim | undefined> }) {
  // Compiler-hoisted JS callbacks cannot cross Filament's worklet boundary.
  'use no memo';
  const { transformManager, nameComponentManager } = useFilamentContext();
  const head = useMemo(() => {
    const entity = asset.getEntities().find(entity => nameComponentManager.getEntityName(entity) === 'Spotlight head');
    if (!entity) return undefined;
    const transform = transformManager.getTransform(entity);
    return { entity, transform, pivot: transform.translation };
  }, [asset, transformManager, nameComponentManager]);
  const radians = normalizeSpotlightAngle(angle) * Math.PI / 180;
  const turn = normalizeSpotlightSwivel(swivel) * Math.PI / 180;
  const applied = useSharedValue<number[]>([]);
  useEffect(() => { applied.value = []; }, [applied, head]);
  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    if (!head) return;
    const current = pose?.value;
    const tilt = current?.instanceId === instanceId ? current.angle * Math.PI / 180 : radians;
    const yaw = current?.instanceId === instanceId ? current.swivel * Math.PI / 180 : turn;
    if (applied.value[0] === tilt && applied.value[1] === yaw) return;
    transformManager.setTransform(head.entity, head.transform.translate([-head.pivot[0], -head.pivot[1], -head.pivot[2]])
      .rotate(tilt, [1, 0, 0]).rotate(yaw, [0, 1, 0]).translate(head.pivot));
    applied.value = [tilt, yaw];
  }, [applied, head, instanceId, pose, radians, transformManager, turn]);
  return null;
}
