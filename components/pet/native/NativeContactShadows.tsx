/* Worklets shared values cache transforms on Filament's drawing thread. */
/* eslint-disable react-hooks/immutability */
import { useMemo } from 'react';
import { RenderCallbackContext, useFilamentContext, useModel, useWorkletEffect } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import source from '@/assets/3d/native/room-contact-shadow.glb';
import { buildRugSurfaces } from '@/utils/native-ground-support';
import { contactShadowPose, contactShadowShape, hasContactShadow } from '@/utils/native-contact-shadow';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import type { NativeRoomObject, NativeRoomWorld } from '@/utils/native-room-world';

type Props = { world: NativeRoomWorld; active: boolean; editingObject?: ISharedValue<NativeRoomObject | undefined> };
/** Cheap ground contact, including the simulator where shadow maps can fail. */
export function NativeContactShadows({ world, active, editingObject }: Props) {
  const rugs = useMemo(() => buildRugSurfaces(world), [world]);
  return <>{world.objects.filter(hasContactShadow).map(object =>
    <ContactShadow key={object.instanceId} object={object} rugs={rugs} active={active} editingObject={editingObject}/>)}</>;
}

function ContactShadow({ object, rugs, active, editingObject }: Omit<Props, 'world'> & {
  object: NativeRoomObject; rugs: ReturnType<typeof buildRugSurfaces>;
}) {
  'use no memo';
  const { transformManager, renderableManager, scene } = useFilamentContext();
  const model = useModel(source, { addToScene: false });
  const asset = model.state === 'loaded' ? model.asset : undefined;
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const shape = useMemo(() => contactShadowShape(object), [object]);
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
    const pose = contactShadowPose(object, shape, rugs);
    transformManager.setTransform(entity, identity.scaling(pose.scale).rotate(pose.heading, [0, 1, 0]).translate(pose.position));
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
    if (!active || !entity) return;
    const live = nativeRoomPreview(editingObject?.value, object.instanceId) ?? object;
    const key = [...live.position, live.scale, live.heading];
    if (key.every((value, i) => value === applied.value[i])) return;
    const pose = contactShadowPose(live, shape, rugs);
    transformManager.setTransform(entity, identity.scaling(pose.scale).rotate(pose.heading, [0, 1, 0]).translate(pose.position));
    applied.value = key;
  }, [active, entity, editingObject, object, shape, rugs, identity, applied, transformManager]);
  return null;
}
