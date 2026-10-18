/* Mutable native transforms run on Filament's drawing thread. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { RenderCallbackContext, useFilamentContext, type FilamentAsset } from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import { advanceFridge } from '@/utils/native-fridge';
import { NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';

/** Only named moving groups and their own materials change; the housing stays fixed. */
export function NativeItemInteraction({ asset, object, active, reduceMotion }: {
  asset: FilamentAsset; object: NativeRoomObject; active: boolean; reduceMotion: boolean;
}) {
  'use no memo';
  const { transformManager, renderableManager, nameComponentManager } = useFilamentContext();
  const metadata = NATIVE_MODEL_CATALOG[object.modelId];
  const parts = useMemo(() => (metadata.interactionParts ?? []).flatMap(part => {
    const entity = asset.getFirstEntityByName(part.node);
    return entity ? [{ ...part, entity }] : [];
  }), [asset, metadata]);
  const hasSpinningParts = parts.some(part => part.mode === 'spin');
  const materials = useMemo(() => asset.getRenderableEntities().flatMap(entity => {
    const authored = metadata.powerMaterials?.find(part => part.node === nameComponentManager.getEntityName(entity));
    return authored ? Array.from({ length: renderableManager.getPrimitiveCount(entity) }, (_, index) => ({
      material: renderableManager.getMaterialInstanceAt(entity, index), base: authored.color,
    })) : [];
  }), [asset, metadata, nameComponentManager, renderableManager]);
  const state = useSharedValue({ open: object.opened ? 1 : 0, power: object.poweredOn ? 1 : 0,
    appliedOpen: -1, appliedPower: -1, time: 0 });
  useEffect(() => { state.value = { ...state.value, appliedOpen: -1, appliedPower: -1 }; }, [parts, materials, state]);
  const identity = useMemo(() => transformManager.createIdentityMatrix(), [transformManager]);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const previous = state.value;
    const open = advanceFridge(previous.open, object.opened ? 1 : 0, timeSinceLastFrame, reduceMotion);
    const power = advanceFridge(previous.power, object.poweredOn ? 1 : 0, timeSinceLastFrame, reduceMotion);
    const time = previous.time + (hasSpinningParts && object.poweredOn && !reduceMotion ? Math.min(.067, timeSinceLastFrame) : 0);
    for (const part of parts) {
      const value = part.mode === 'open' ? open : power;
      if (part.mode === 'open' && open === previous.appliedOpen
        || part.mode !== 'open' && power === previous.appliedPower && (part.mode !== 'spin' || !object.poweredOn || reduceMotion)) continue;
      const angle = part.mode === 'spin' ? time * 12 : part.angle * value;
      const scale: Vec3 = part.mode === 'water' ? [1, value, 1] : part.mode === 'visible' ? [value, value, value] : [1, 1, 1];
      transformManager.setTransform(part.entity, identity.scaling(scale).rotate(angle, part.axis as Vec3)
        .translate(part.pivot.map((v, i) => v + part.offset[i] * value) as Vec3));
    }
    if (power !== previous.appliedPower) for (const { material, base } of materials) {
      const brightness = .025 + .975 * power;
      material.setFloat4Parameter('baseColorFactor', [base[0] * brightness, base[1] * brightness, base[2] * brightness, base[3]]);
      material.setFloat4Parameter('emissiveFactor', [base[0] * power * 1.5, base[1] * power * 1.5, base[2] * power * 1.5, 1]);
    }
    if (open !== previous.appliedOpen || power !== previous.appliedPower || time !== previous.time)
      state.value = { open, power, appliedOpen: open, appliedPower: power, time };
  }, [active, reduceMotion, object.opened, object.poweredOn, state, parts, hasSpinningParts, materials, identity, transformManager]);
  return null;
}
