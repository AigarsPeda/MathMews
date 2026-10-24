import { projectWorld, type NativeRoomObject, type NativeRoomWorld } from '@/utils/native-room-world';
import { roomItemAnchor } from '@/utils/room-item-placement';
import type { RoomPoint } from '@/utils/room-activities';

/** Offer a chooser only for clustered small targets; ordinary furniture taps stay direct. */
export function ambiguousRoomItems(world: NativeRoomWorld, pickedId: string, point: RoomPoint, zoom: number) {
  const nearby = world.objects.flatMap(object => {
    const corners = [object.min[0], object.max[0]].flatMap(x => [object.min[1], object.max[1]]
      .flatMap(y => [object.min[2], object.max[2]].map(z => projectWorld([x, y, z], world.width))));
    const width = Math.max(...corners.map(p => p.x)) - Math.min(...corners.map(p => p.x));
    const height = Math.max(...corners.map(p => p.y)) - Math.min(...corners.map(p => p.y));
    const anchor = roomItemAnchor(object, world.width), distance = Math.hypot(anchor.x - point.x, anchor.y - point.y) * zoom;
    return width * zoom <= 48 && height * zoom <= 48 && distance <= 20 ? [{ id: object.instanceId, distance }] : [];
  }).sort((a, b) => a.distance - b.distance);
  return nearby.length > 1 && nearby.some(item => item.id === pickedId) ? nearby.slice(0, 4).map(item => item.id) : [];
}

/** The selected outline remains a drag target even when another model covers it. */
export function selectedRoomItemAtPoint(object: NativeRoomObject, point: RoomPoint, width: number, zoom = 1) {
  const corners = [object.min[0], object.max[0]].flatMap(x => [object.min[1], object.max[1]]
    .flatMap(y => [object.min[2], object.max[2]].map(z => projectWorld([x, y, z], width))));
  const pad = 8 / Math.max(1, zoom);
  return point.x >= Math.min(...corners.map(p => p.x)) - pad && point.x <= Math.max(...corners.map(p => p.x)) + pad
    && point.y >= Math.min(...corners.map(p => p.y)) - pad && point.y <= Math.max(...corners.map(p => p.y)) + pad;
}
