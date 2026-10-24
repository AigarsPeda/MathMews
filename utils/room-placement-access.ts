import { findCatRoomRoute, findSeatApproach, findFoodBowlApproach, hasNativeArrived,
  nativeRoomEdge, nearestFree, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';

/** Called after the pointer rests or at commit, never once per animation frame. */
export function roomPlacementAccess(before: NativeRoomWorld, after: NativeRoomWorld, start: Vec3, includeOptional = true) {
  const origin = nearestFree(start, after);
  const reaches = (world: NativeRoomWorld, from: Vec3, target: Vec3) => {
    const last = findCatRoomRoute(from, target, world).path.at(-1);
    return !!last && hasNativeArrived(last, target);
  };
  const exits = [-1, 1].map(side => nativeRoomEdge(before, side as -1 | 1));
  const hadExit = exits.some(target => reaches(before, start, target));
  const blockedExit = hadExit && !exits.some(target => reaches(after, origin, target));
  const unreachable = (includeOptional ? after.objects : []).filter(object => {
    if (object.bed || object.seat) return !findSeatApproach(origin, object, after);
    if (/bowl/i.test(object.modelId)) return !findFoodBowlApproach(origin, object, after);
    return false;
  }).map(object => object.instanceId);
  return { blockedExit, unreachable, origin };
}
