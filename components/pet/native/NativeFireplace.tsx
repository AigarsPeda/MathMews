/* Flame meshes and their light share one drawing-thread clock. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { RenderCallbackContext, useEntityInScene, useFilamentContext, useLightEntity, type FilamentAsset, type Float3 } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { FIREPLACE_FLAMES, fireplaceFlamePose, fireplaceLightPosition } from '@/utils/native-fireplace';
import { advanceFridge } from '@/utils/native-fridge';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import { NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from '@/utils/native-room-world';

export function NativeFireplace({ asset, object, active, reduceMotion, editingObject, castShadows }: {
  castShadows: boolean; asset: FilamentAsset; object: NativeRoomObject; active: boolean; reduceMotion: boolean;
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
}) {
  'use no memo';
  const { transformManager, renderableManager, lightManager, scene } = useFilamentContext();
  const mappedShadows = castShadows && lightManager.shadowMapsSupported === true;
  const light = useLightEntity(lightManager, { type: 'spot', colorKelvin: 2150, intensity: 0,
    position: [0, 0, 0], direction: [0, -.28, .96], spotLightCone: [.66, 1.46],
    castShadows: mappedShadows, falloffRadius: 4 });
  // Local bounce reaches the recess and stone returns behind the outward light.
  const bounce = useLightEntity(lightManager, { type: 'point', colorKelvin: 1750, intensity: 0,
    position: [0, 0, 0], castShadows: false, falloffRadius: 1 });
  useEntityInScene(scene, light);
  useEntityInScene(scene, bounce);
  const identity = useMemo(() => transformManager.createIdentityMatrix(), [transformManager]);
  const group = useMemo(() => asset.getFirstEntityByName('Interaction part 0'), [asset]);
  const grateShadow = useMemo(() => asset.getFirstEntityByName('Grate penumbra'), [asset]);
  const flames = useMemo(() => FIREPLACE_FLAMES.flatMap((part, index) => {
    const entity = asset.getFirstEntityByName(part.node);
    const color = NATIVE_MODEL_CATALOG.livingFireplaceCream.powerMaterials?.find(material => material.node === part.node)?.color;
    return entity && color ? [{ ...part, index, entity, color,
      materials: Array.from({ length: renderableManager.getPrimitiveCount(entity) }, (_, i) => renderableManager.getMaterialInstanceAt(entity, i)) }] : [];
  }), [asset, renderableManager]);
  const state = useSharedValue({ power: object.poweredOn ? 1 : 0, time: 0, appliedPower: -1, appliedTime: -1,
    appliedReduced: undefined as boolean | undefined, pose: [] as number[] });
  useEffect(() => { state.value = { ...state.value, appliedPower: -1, pose: [] }; }, [flames, group, light, bounce, state]);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const previous = state.value;
    const power = advanceFridge(previous.power, object.poweredOn ? 1 : 0, timeSinceLastFrame, reduceMotion);
    const time = previous.time + (power > 0 && !reduceMotion ? Math.max(0, Math.min(1 / 15, timeSinceLastFrame)) : 0);
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    const source = preview ?? object;
    const pose = [...source.position, source.heading, source.scale];
    const moved = pose.some((v, i) => v !== previous.pose[i]);
    const changed = power !== previous.appliedPower || time !== previous.appliedTime || reduceMotion !== previous.appliedReduced;
    if (!changed && !moved) return;
    if (previous.appliedPower === -1 && group) transformManager.setTransform(group, identity);
    let brightness = 0, sway = 0;
    for (const flame of flames) {
      const motion = fireplaceFlamePose(time, flame.index, reduceMotion);
      brightness += motion.emission;
      sway += motion.sway;
      if (!changed) continue;
      transformManager.setTransform(flame.entity, identity.translate(flame.base.map(v => -v) as Vec3)
        .scaling([motion.width * power, motion.height * power, motion.width * power]).rotate(motion.sway, [0, 0, 1]).translate(flame.base));
      const emission = power * motion.emission * (flame.index < 3 ? .92 : 1.12);
      for (const material of flame.materials) {
        if (previous.appliedPower === -1) material.setFloat4Parameter('baseColorFactor', [.16, .16, .16, 1]);
        material.setFloat4Parameter('emissiveFactor',
          [flame.color[0] * emission, flame.color[1] * emission, flame.color[2] * emission, 1]);
      }
    }
    const glow = brightness / Math.max(1, flames.length);
    const drift = -.38 * sway / Math.max(1, flames.length);
    lightManager.setIntensity(light, 150_000 * source.scale * source.scale * power * glow);
    lightManager.setPosition(light, fireplaceLightPosition(source, drift, (glow - 1) * .16) as unknown as Float3[]);
    lightManager.setIntensity(bounce, 24_000 * source.scale * source.scale * power * (.75 + .25 * glow));
    if (moved) {
      lightManager.setPosition(bounce, fireplaceLightPosition(source, 0, .08) as unknown as Float3[]);
      lightManager.setFalloff(bounce, 1.1 * source.scale);
      lightManager.setDirection(light, [.96 * Math.sin(source.heading), -.28, .96 * Math.cos(source.heading)] as unknown as Float3[]);
      lightManager.setFalloff(light, Math.max(1.2, 4.2 * source.scale));
    }
    if (grateShadow && changed && (!mappedShadows || previous.appliedPower === -1)) {
      const reach = mappedShadows ? 0 : power;
      transformManager.setTransform(grateShadow, identity.translate([0, 0, -.312])
        .scaling([1, 1, reach]).rotate(-drift * .9, [0, 1, 0]).translate([0, 0, .312]));
    }
    state.value = { power, time, appliedPower: power, appliedTime: time, appliedReduced: reduceMotion, pose };
  }, [active, reduceMotion, object, editingObject, state, group, grateShadow, mappedShadows, flames, identity, transformManager, lightManager, light, bounce]);
  return null;
}
