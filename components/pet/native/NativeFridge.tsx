/* Door motion and its light share one drawing-thread callback. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity, type FilamentAsset, type Float3 } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { advanceFridge, fridgeLightIntensity, fridgeLightPose } from '@/utils/native-fridge';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import type { NativeRoomObject, Vec3 } from '@/utils/native-room-world';

export function NativeFridge({ asset, object, active, reduceMotion, editingObject }: {
  asset: FilamentAsset; object: NativeRoomObject; active: boolean; reduceMotion: boolean;
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
}) {
  'use no memo';
  const { transformManager, renderableManager, nameComponentManager, lightManager, scene } = useFilamentContext();
  const retro = object.modelId === 'kitchenFridge';
  const hinge = useMemo(() => {
    const entity = asset.getFirstEntityByName('Fridge door hinge');
    const handle = asset.getFirstEntityByName('Fridge door handle');
    // Always start from the authored closed pose. A retained asset may already
    // have an animated transform when this component remounts or refreshes.
    return entity ? { entity,
      transform: transformManager.createIdentityMatrix().translate(retro ? [.51, 0, .46] : [-.585, 0, .55]), handle,
      handleTransform: handle ? transformManager.createIdentityMatrix().translate(retro ? [-.85, 1.16, .08] : [1.085, 1.54, .024]) : undefined } : undefined;
  }, [asset, retro, transformManager]);
  const materials = useMemo(() => asset.getRenderableEntities().flatMap(entity => {
    const name = nameComponentManager.getEntityName(entity) ?? '';
    if (!name.startsWith('Fridge interior') && !name.startsWith('Fridge door liner') && !name.startsWith('Fridge door rack') && !name.startsWith('Fridge food') && !name.startsWith('Fridge juice') && !name.startsWith('Fridge bottle')) return [];
    return Array.from({ length: renderableManager.getPrimitiveCount(entity) }, (_, i) => ({
      material: renderableManager.getMaterialInstanceAt(entity, i), led: name === 'Fridge interior LED',
      base: renderableManager.getMaterialInstanceAt(entity, i).getFloat4Parameter('baseColorFactor'),
    }));
  }), [asset, nameComponentManager, renderableManager]);
  // Two bounded sources approximate a tall opening and spread onto the floor.
  // Both handles remain allocated when the fridge closes.
  const lightConfig = { type: 'spot' as const, colorKelvin: 8000, intensity: 0,
    position: [0, 0, 0] as Float3, direction: [0, -.85, 1] as Float3,
    falloffRadius: 3, spotLightCone: [.55, 1.15] as [number, number], castShadows: false };
  const upperLight = useLightEntity(lightManager, lightConfig);
  const lowerLight = useLightEntity(lightManager, lightConfig);
  useEntityInScene(scene, upperLight);
  useEntityInScene(scene, lowerLight);
  const lights = useMemo(() => [upperLight, lowerLight], [upperLight, lowerLight]);
  const target = object.fridgeOpen === true ? 1 : 0;
  const state = useSharedValue({ open: target, applied: -1, side: "" });
  const appliedPose = useSharedValue<number[]>([]);
  useEffect(() => { state.value = { ...state.value, applied: -1 }; appliedPose.value = []; }, [appliedPose, hinge, lights, materials, state]);
  const side = object.fridgeHingeSide ?? (retro ? 'right' : 'left');
  const angle = (side === 'right' ? 1 : -1) * 85 * Math.PI / 180;
  const hingeX = (side === 'right' ? 1 : -1) * (retro ? .51 : .585);
  const handleShift = side === (retro ? 'right' : 'left') ? 0 : retro ? .68 : -1;
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active || !hinge) return;
    const previous = state.value;
    const open = advanceFridge(previous.open, target, timeSinceLastFrame, reduceMotion);
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    const pose = preview ? { ...object, ...preview } : object;
    const values = [pose.scale, pose.heading, ...pose.position];
    let moved = values.length !== appliedPose.value.length;
    for (let i = 0; i < values.length && !moved; i++) if (values[i] !== appliedPose.value[i]) moved = true;
    if (open === previous.applied && previous.side === side && !moved) return;
    if (open !== previous.applied || previous.side !== side) {
      const pivot: Vec3 = [hingeX, hinge.transform.translation[1], hinge.transform.translation[2]];
      transformManager.setTransform(hinge.entity, open === 0 ? hinge.transform : hinge.transform.translate(pivot.map(v => -v) as Vec3)
        .rotate(open * angle, [0, 1, 0]).translate(pivot));
      if (hinge.handle && hinge.handleTransform) transformManager.setTransform(hinge.handle, hinge.handleTransform.translate([handleShift, 0, 0]));
      for (const { material, led, base } of materials) {
        const strength = (led ? 5 : .22) * Math.min(1, open * 3);
        material.setFloat4Parameter('emissiveFactor', led ? [strength * .65, strength * .85, strength, 1]
          : [base[0] * strength * .7, base[1] * strength * .85, base[2] * strength, 1]);
      }
    }
    if (moved) {
      for (let i = 0; i < lights.length; i++) {
        const location = fridgeLightPose(pose, i === 0 ? .8 : .2);
        lightManager.setPosition(lights[i], location.position as unknown as Float3[]);
        lightManager.setDirection(lights[i], location.direction as unknown as Float3[]);
        lightManager.setColor(lights[i], [.58, .78, 1]);
      }
      appliedPose.value = values;
    }
    const intensity = fridgeLightIntensity(open, pose.scale) / lights.length;
    for (const light of lights) lightManager.setIntensity(light, intensity);
    state.value = { open, applied: open, side };
  }, [active, reduceMotion, target, angle, hingeX, handleShift, side, hinge, materials, lights, lightManager, object, editingObject, appliedPose, state, transformManager]);
  return null;
}
