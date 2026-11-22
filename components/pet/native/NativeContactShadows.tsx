/* Worklets shared values cache transforms on Filament's drawing thread. */
/* eslint-disable react-hooks/immutability */
import { memo, useEffect, useMemo } from 'react';
import { RenderCallbackContext, useFilamentContext, useModel, useWorkletEffect } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import source from '@/assets/3d/native/room-contact-shadow.glb';
import { buildRugSurfaces } from '@/utils/native-ground-support';
import { contactShadowPose, contactShadowShape, fireShadowReach, hasContactShadow } from '@/utils/native-contact-shadow';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import type { NativeRoomObject, NativeRoomWorld, Vec3 } from '@/utils/native-room-world';

type Props = { world: NativeRoomWorld; active: boolean; catPosition?: ISharedValue<Vec3>; editingObject?: ISharedValue<NativeRoomObject | undefined> };
/** Cheap ground contact, including the simulator where shadow maps can fail. */
export function NativeContactShadows({ world, active, editingObject, catPosition }: Props) {
  const rugs = useMemo(() => buildRugSurfaces(world), [world]);
  const drawing = useSharedValue(active);
  useEffect(() => { drawing.value = active; }, [drawing, active]);
  const { lightManager } = useFilamentContext();
  const maps = lightManager?.shadowMapsSupported === true;
  const fires = useMemo(() => maps ? [] : world.objects.filter(o => o.modelId === 'livingFireplaceCream' && o.poweredOn), [maps, world.objects]);
  const shadows = world.objects.filter(hasContactShadow).map(object =>
    <ContactShadow key={object.instanceId} object={object} fires={fires} rugs={rugs} active={drawing} editingObject={editingObject}/>);
  if (catPosition && fires.length) shadows.push(<ContactShadow key="cat" catPosition={catPosition} catScale={world.catScale}
    fires={fires} rugs={rugs} active={drawing} editingObject={editingObject}/>);
  return <>{shadows}</>;
}

const ContactShadow = memo(function ContactShadow({ object, fires, rugs, active, editingObject, catScale = 1, catPosition }: {
  object?: NativeRoomObject; fires: NativeRoomObject[]; rugs: ReturnType<typeof buildRugSurfaces>;
  active: ISharedValue<boolean>; editingObject?: Props['editingObject']; catScale?: number; catPosition?: Props['catPosition'];
}) {
  'use no memo';
  const { transformManager, renderableManager, scene } = useFilamentContext();
  const model = useModel(source, { addToScene: false });
  const asset = model.state === 'loaded' ? model.asset : undefined;
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const modelId = object?.modelId;
  const shape = useMemo(() => modelId ? contactShadowShape({ modelId }) : { center: [0, 0], radius: [.37, .57] }, [modelId]);
  const identity = useMemo(() => transformManager.createIdentityMatrix(), [transformManager]);
  const applied = useSharedValue<number[]>([]);
  useWorkletEffect(() => {
    'worklet';
    if (!asset || !entity) return;
    const parts = asset.getRenderableEntities();
    for (const part of parts) {
      renderableManager.setCastShadow(part, false);
      renderableManager.setReceiveShadow(part, false);
    }
    if (parts.length) scene.addEntities(parts);
    applied.value = [];
    return () => {
      'worklet';
      // Capture entity IDs before useModel releases its asset during unmount.
      if (parts.length) scene.removeEntities(parts);
    };
  });
  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    if (!active.value || !entity) return;
    const live = object ? nativeRoomPreview(editingObject?.value, object.instanceId) ?? object
      : catPosition ? { position: catPosition.value, scale: catScale, heading: 0 } : undefined;
    if (!live) return;
    let fire: Pick<NativeRoomObject, 'position' | 'heading' | 'scale'> | undefined;
    let strongest = 0;
    for (const source of fires) {
      if (source.instanceId === object?.instanceId) continue;
      const candidate = nativeRoomPreview(editingObject?.value, source.instanceId) ?? source;
      const reach = fireShadowReach(live.position, candidate);
      if (reach > strongest) { fire = candidate; strongest = reach; }
    }
    const pose = contactShadowPose(live, shape, rugs, fire, !object);
    const key = [...pose.position, ...pose.scale, pose.heading];
    if (key.every((value, i) => value === applied.value[i])) return;
    transformManager.setTransform(entity, identity.scaling(pose.scale).rotate(pose.heading, [0, 1, 0]).translate(pose.position));
    applied.value = key;
  }, [active, entity, editingObject, object, fires, catPosition, catScale, shape, rugs, identity, applied, transformManager]);
  return null;
});
