import type { HomeRoomId } from '@/constants/home-rooms';
import type { PetProfile, RoomLayerItem } from '@/types/game';

export type RoomDecorationTarget = { kind: 'bed' | 'toy' | 'decoration'; id: string };
export type RoomDecorationEntry = { roomId: HomeRoomId; item?: RoomLayerItem };

/** Resolve against the committed purchase, including the newest copy of a repeatable item. */
export function roomDecorationEntry(pet: PetProfile, target?: RoomDecorationTarget): RoomDecorationEntry {
  const entry: RoomDecorationEntry = { roomId: pet.homeRoomId ?? 'livingRoom' };
  if (!target) return entry;
  if (target.kind === 'bed') {
    if (pet.bedId === target.id) entry.item = { kind: 'bed' };
  } else if (target.kind === 'toy') {
    const placed = pet.placedToys?.filter(item => item.toyId === target.id).at(-1);
    if (placed) entry.item = { kind: 'toy', toyId: placed.toyId, instanceId: placed.instanceId };
  } else {
    const placed = pet.placedDecorations?.filter(item => item.decorationId === target.id).at(-1);
    if (placed) entry.item = { kind: 'decoration', decorationId: placed.decorationId, instanceId: placed.instanceId };
  }
  return entry;
}
