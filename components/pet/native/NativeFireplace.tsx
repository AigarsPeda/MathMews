/* Flame meshes and their light share one drawing-thread clock. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity, type FilamentAsset, type Float3 } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { FIREPLACE_FLAMES, fireplaceFlamePose, fireplaceFlicker, fireplaceLightPosition } from '@/utils/native-fireplace';
import { advanceFridge } from '@/utils/native-fridge';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import { NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';

export function NativeFireplace({ asset, object, active, reduceMotion, editingObject }: {
  asset: FilamentAsset; object: NativeRoomObject; active: boolean; reduceMotion: boolean;
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
}) {
  'use no memo';
  const { transformManager, renderableManager, lightManager, scene } = useFilamentContext();
  // Keep one native handle even when unlit; only numeric intensity/pose updates cross runtimes.
  const light = useLightEntity(lightManager, { type: 'point', colorKelvin: 1900, intensity: 0,
    position: [0, 0, 0], castShadows: false, falloffRadius: Math.max(3.5, 4.6 * object.scale) });
  useEntityInScene(scene, light);
  const identity = useMemo(() => transformManager.createIdentityMatrix(), [transformManager]);
  const group = useMemo(() => asset.getFirstEntityByName('Interaction part 0'), [asset]);
  const flames = useMemo(() => FIREPLACE_FLAMES.flatMap((part, index) => {
    const entity = asset.getFirstEntityByName(part.node);
    const color = NATIVE_MODEL_CATALOG.livingFireplaceCream.powerMaterials?.find(material => material.node === part.node)?.color;
    return entity && color ? [{ ...part, index, entity, color,
      materials: Array.from({ length: renderableManager.getPrimitiveCount(entity) }, (_, i) => renderableManager.getMaterialInstanceAt(entity, i)) }] : [];
  }), [asset, renderableManager]);
  const state = useSharedValue({ power: object.poweredOn ? 1 : 0, time: 0, appliedPower: -1, appliedTime: -1,
    appliedReduced: undefined as boolean | undefined, pose: [] as number[] });
  useEffect(() => { state.value = { ...state.value, appliedPower: -1, pose: [] }; }, [flames, group, light, state]);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const previous = state.value;
    const power = advanceFridge(previous.power, object.poweredOn ? 1 : 0, timeSinceLastFrame, reduceMotion);
    const time = previous.time + (power > 0 && !reduceMotion ? Math.max(0, Math.min(1 / 15, timeSinceLastFrame)) : 0);
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    const source = preview ?? object;
    const position = fireplaceLightPosition(source);
    const pose = [...position, source.scale];
    const moved = pose.some((v,i) => v !== previous.pose[i]);
    const changed = power !== previous.appliedPower || time !== previous.appliedTime || reduceMotion !== previous.appliedReduced;
    if (previous.appliedPower === -1 && group) transformManager.setTransform(group, identity);
    if (changed) for (const flame of flames) {
      const motion = fireplaceFlamePose(time, flame.index, reduceMotion);
      transformManager.setTransform(flame.entity, identity.translate(flame.base.map(v => -v) as Vec3)
        .scaling([motion.width * power, motion.height * power, motion.width * power]).rotate(motion.sway, [0, 0, 1]).translate(flame.base));
      const emission = power * fireplaceFlicker(time, reduceMotion) * .85;
      for (const material of flame.materials) {
        // Keep direct room lighting from bleaching the translucent orange fire.
        if (previous.appliedPower === -1) material.setFloat4Parameter('baseColorFactor', [.16, .16, .16, 1]);
        material.setFloat4Parameter('emissiveFactor',
          [flame.color[0] * emission, flame.color[1] * emission, flame.color[2] * emission, 1]);
      }
    }
    if (changed || moved) lightManager.setIntensity(light, 280_000 * source.scale * source.scale * power * fireplaceFlicker(time, reduceMotion));
    if (moved) {
      lightManager.setPosition(light, position as unknown as Float3[]);
      lightManager.setFalloff(light, Math.max(3.5, 4.6 * source.scale));
    }
    if (changed || moved) state.value = { power, time, appliedPower: power, appliedTime: time, appliedReduced: reduceMotion, pose };
  }, [active, reduceMotion, object, editingObject, state, group, flames, identity, transformManager, lightManager, light]);
  return null;
}
