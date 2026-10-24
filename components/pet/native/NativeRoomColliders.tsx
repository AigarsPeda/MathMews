import { memo } from 'react';
import { useBoxShape, useRigidBody, type DiscreteDynamicWorld, type Float3 } from 'react-native-filament';
import type { NativeRoomWorld } from '@/utils/native-room-world';

function BoxCollider({ world, id, size, position }: {
  world: DiscreteDynamicWorld;
  id: string;
  size: Float3;
  position: Float3;
}) {
  const shape = useBoxShape(...size);
  useRigidBody({ id, mass: 0, shape, origin: position, world, friction: .7 });
  return null;
}
// Room visibility changes pause drawing, not the static collision geometry.
export const NativeRoomColliders = memo(function NativeRoomColliders({ world, objects }: {
  world: DiscreteDynamicWorld;
  objects: NativeRoomWorld['objects'];
}) {
  return <>
  {([-1, 1] as const).flatMap(side => [
      <BoxCollider key={'x' + side} id={'wall-x' + side} world={world} size={[.05, 1.5, 2.5]} position={[side * 2.45, 1.5, 0]}/>,
      <BoxCollider key={'z' + side} id={'wall-z' + side} world={world} size={[2.5, 1.5, .05]} position={[0, 1.5, side * 2.45]}/>,
    ])}
  {objects.flatMap(object => (object.collisionBoxes ?? []).map((box, index) =>
    <BoxCollider key={object.instanceId + ':part:' + index} id={object.instanceId + ':part:' + index} world={world}
      size={box.max.map((v, i) => Math.max(.01, (v - box.min[i]) / 2)) as Float3}
      position={box.max.map((v, i) => (v + box.min[i]) / 2) as Float3}/>))}
  </>;
});
