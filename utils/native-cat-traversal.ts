import type { NativeRoomObject, NativeRoomWorld, Vec3 } from '@/utils/native-room-world';
import { catJumpPoint, catJumpDuration, type CatMotionLeg } from '@/utils/native-cat-locomotion';
import { CAT_FURNITURE } from '@/constants/cat-furniture';

export type CatTraversalLink = { from: Vec3; to: Vec3; leg: CatMotionLeg };
const length = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, i) => v - b[i]));

/** Sweep the torso volume, including the crossed furnishing and its open doors. */
export function catFlightClear(from: Vec3, to: Vec3, height: number, world: NativeRoomWorld): boolean {
  const radius = .32 * world.catScale, bodyHeight = 1.35 * world.catScale;
  const samples = Math.max(40, Math.ceil((length(from, to) + height * 2) / (.08 * world.catScale)));
  const edge = 2.32 - radius;
  for (let i = 0; i <= samples; i++) {
    const p = catJumpPoint(from, to, i / samples, height);
    if (Math.abs(p[0]) > edge || Math.abs(p[2]) > edge || p[1] < .06) return false;
    for (const object of world.objects) {
      if (!object.solid && !object.collidable) continue;
      for (const box of [...(object.collisionBoxes?.length ? object.collisionBoxes : [object]), ...(object.interactionBoxes ?? [])]) {
        if (box.max[1] <= p[1] + .025 * world.catScale || box.min[1] >= p[1] + bodyHeight) continue;
        const dx = p[0] - Math.max(box.min[0], Math.min(box.max[0], p[0]));
        const dz = p[2] - Math.max(box.min[2], Math.min(box.max[2], p[2]));
        if (dx * dx + dz * dz < radius * radius) return false;
      }
    }
  }
  return true;
}

function jumpLink(from: Vec3, to: Vec3, world: NativeRoomWorld, supportId: string): CatTraversalLink | undefined {
  const scale = world.catScale, distance = length(from, to);
  if (distance > 4 * scale || Math.abs(to[1] - from[1]) > 1.65 * scale) return undefined;
  for (let height = Math.max(.24 * scale,Math.abs(to[1]-from[1])*.25+.06*scale); height <= 2.21 * scale; height += .13 * scale) {
    if (!catFlightClear(from, to, height, world)) continue;
    const duration = catJumpDuration(from,to,height,scale);
    return { from, to, leg: { kind: 'hop', path: [from, to], duration, arcHeight: height, supportId } };
  }
  return undefined;
}

/** Anchors follow the live instance transform; decorative/fragile items are never perches. */
export function buildCatTraversalLinks(world: NativeRoomWorld, floorFree: (point: Vec3) => boolean): CatTraversalLink[] {
  const links: CatTraversalLink[] = [], floor = .068, scale = world.catScale;
  const addJump = (from: Vec3, to: Vec3, object: NativeRoomObject, animation: CatMotionLeg['animation'] = 'hop') => {
    const link = jumpLink(from, to, world, object.instanceId);
    if (link) links.push({ ...link, leg: { ...link.leg, animation } });
  };
  for (const object of world.objects) {
    if (!object.solid || object.opened || object.movable) continue;
    const { min, max } = object;
    if (/^(books|sofaPillow|bedroomBench|japaneseCartonBox|officeCartonBox|officeWhiteBox)/.test(object.modelId)
      && max[1] - floor <= .65 * scale) {
      for (const axis of [0, 2]) {
        const from: Vec3 = [(min[0] + max[0]) / 2, floor, (min[2] + max[2]) / 2], to: Vec3 = [...from];
        from[axis] = min[axis] - world.radius - .08 * scale;
        to[axis] = max[axis] + world.radius + .08 * scale;
        if (floorFree(from) && floorFree(to)) { addJump(from, to, object); addJump(to, from, object); }
      }
    }
    const furniture = CAT_FURNITURE[object.modelId];
    if (!object.seat || !furniture && !/^(kitchenChair|chairRockingOak|sofa)/.test(object.modelId)
      || object.modelId === 'sofaPillow' || object.seat[1] - floor > 1.65 * scale) continue;
    // Reserve room for all four paws on the cushion, excluding narrow miniatures.
    if (Math.min(max[0] - min[0], max[2] - min[2]) < .65 * scale) continue;
    const frontHeading = object.heading+(furniture?.front ?? (object.modelId === 'sofaB' ? Math.PI/2 : 0));
    const sin = Math.sin(frontHeading), cos = Math.cos(frontHeading);
    if (furniture) {
      const dx=(object.seat[0]-object.position[0])/object.scale,dz=(object.seat[2]-object.position[2])/object.scale;
      const x=Math.cos(object.heading)*dx-Math.sin(object.heading)*dz,z=Math.sin(object.heading)*dx+Math.cos(object.heading)*dz;
      const paws=[-.30,.30].flatMap(side=>[-.55,.55].map(forward=>{
        const s=Math.sin(furniture.front),c=Math.cos(furniture.front),r=scale/object.scale;
        return [x+(side*c+forward*s)*r,z+(forward*c-side*s)*r];
      }));
      if (!furniture.surfaces.some(top=>paws.every(p=>top.footprint.every((a,i,poly)=>{const b=poly[(i+1)%poly.length];
        return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=0;})))) continue;
    }
    const seatFront: Vec3 = [...object.seat];
    // Gather toward the cushion's front before turning to clear the backrest.
    const seatBack: Vec3 = [object.seat[0] + sin * .06 * object.scale, object.seat[1], object.seat[2] + cos * .06 * object.scale];
    const extent = (direction: number) => {
      const x = sin * direction, z = cos * direction;
      return Math.min(Math.abs(x) < 1e-6 ? Infinity : ((x > 0 ? max[0] : min[0]) - object.seat![0]) / x,
        Math.abs(z) < 1e-6 ? Infinity : ((z > 0 ? max[2] : min[2]) - object.seat![2]) / z) + world.radius + .12 * scale;
    };
    const frontDistance = extent(1), backDistance = extent(-1);
    const front: Vec3 = [object.seat[0] + sin * frontDistance, floor, object.seat[2] + cos * frontDistance];
    const back: Vec3 = [object.seat[0] - sin * backDistance, floor, object.seat[2] - cos * backDistance];
    if (!floorFree(front) || !floorFree(back)) continue;
    // The short step on the cushion must also clear arms, backrests and neighbors.
    if (!catFlightClear(seatFront, seatBack, 0, world)) continue;
    addJump(front, seatFront, object, 'jumpOn'); addJump(seatFront, front, object, 'jumpOff');
    addJump(seatBack, back, object, 'jumpOff'); addJump(back, seatBack, object, 'jumpOn');
    const duration = Math.max(.25, length(seatFront, seatBack) / (.9 * scale));
    links.push({ from: seatFront, to: seatBack, leg: { kind: 'walk', animation: 'sit', path: [seatFront, seatBack], duration, supportId: object.instanceId } },
      { from: seatBack, to: seatFront, leg: { kind: 'walk', animation: 'sit', path: [seatBack, seatFront], duration, supportId: object.instanceId } });
  }
  return links;
}
