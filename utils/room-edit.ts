import { getBedPlacementScale } from '@/constants/cat-beds';
import type { PetProfile, PlacedDecoration, PlacedToy, Progress, RoomItemSupport, RoomLayerItem } from '@/types/game';
import type { RoomDecorationTarget } from '@/utils/room-decoration-entry';
import { appendPlacedDecoration, appendPlacedToy, createPlacementInstanceId } from '@/utils/room-placement';
import { syncPetLayerOrder } from '@/utils/room-layer-order';
import { getDecorationOwnedCount } from '@/utils/decoration-store';
import { getToyOwnedCount } from '@/utils/toy-store';
import type { CatDecorationId } from '@/constants/cat-decorations';
import type { CatToyId } from '@/constants/cat-toys';
import type { RoomLayout } from '@/utils/room-layout';

export type RoomPlacementDraft = { target: RoomDecorationTarget; item: RoomLayerItem; initial?: PlacedToy | PlacedDecoration };
export type RoomObjectEdit = {
  instanceId: string; offset: { x: number; y: number }; rotationDegrees?: number;
  support?: RoomItemSupport; scale?: number;
};

export function roomFurnitureVersion(room: RoomLayout) {
  return JSON.stringify([room.bedId, room.roomBedOffset, room.bedFlipped, room.bedScale, room.bedRotationDegrees,
    room.placedToys, room.placedDecorations, room.roomLayerOrder]);
}

export function houseFurnitureInventory(
  pet: Pick<PetProfile, 'homeRoomId' | 'homeRooms' | 'bedId' | 'placedToys' | 'placedDecorations'>,
  progress: Pick<Progress, 'bedsUnlocked' | 'toysUnlocked' | 'decorationsUnlocked' | 'toyQuantities' | 'decorationQuantities'>,
) {
  const current = pet.homeRoomId ?? 'livingRoom';
  const rooms = { ...pet.homeRooms, [current]: pet };
  const inventory = new Map<string, { target: RoomDecorationTarget; count: number; rooms: Map<string, number> }>();
  function add(target: RoomDecorationTarget, count: number) {
    inventory.set(`${target.kind}:${target.id}`, { target, count, rooms: new Map() });
  }
  for (const id of progress.bedsUnlocked) add({ kind: 'bed', id }, 1);
  for (const id of progress.toysUnlocked) add({ kind: 'toy', id }, getToyOwnedCount(id as CatToyId, progress));
  for (const id of progress.decorationsUnlocked) add({ kind: 'decoration', id }, getDecorationOwnedCount(id as CatDecorationId, progress));
  function recordPlacement(key: string, roomId: string) {
    const entry = inventory.get(key);
    if (!entry) return;
    entry.count = Math.max(0, entry.count - 1);
    entry.rooms.set(roomId, (entry.rooms.get(roomId) ?? 0) + 1);
  }
  // Bed styles can be equipped once per room. Toys and decorations share copies across rooms.
  if (pet.bedId) recordPlacement(`bed:${pet.bedId}`, current);
  for (const [roomId, room] of Object.entries(rooms)) {
    for (const toy of room.placedToys ?? []) recordPlacement(`toy:${toy.toyId}`, roomId);
    for (const decoration of room.placedDecorations ?? []) recordPlacement(`decoration:${decoration.decorationId}`, roomId);
  }
  return inventory;
}

export function storedRoomItems(pet: PetProfile, progress: Progress) {
  return [...houseFurnitureInventory(pet, progress).values()].filter(item => item.count > 0)
    .map(({ target, count }) => ({ target, count }));
}

export function createRoomPlacementDraft(target: RoomDecorationTarget, room?: RoomLayout): RoomPlacementDraft {
  if (target.kind === 'bed') return { target, item: { kind: 'bed' } };
  const initial = target.kind === 'toy' ? appendPlacedToy(room?.placedToys, target.id as CatToyId).at(-1)!
    : appendPlacedDecoration(room?.placedDecorations, target.id as CatDecorationId).at(-1)!;
  const instanceId = initial.instanceId ?? createPlacementInstanceId();
  return { target, initial, item: target.kind === 'toy' ? { kind: 'toy', toyId: target.id, instanceId }
    : { kind: 'decoration', decorationId: target.id, instanceId } };
}

/** The draft exists only in the editor. Cancel never changes ownership or the saved bed. */
export function withRoomPlacementDraft<T extends RoomLayout>(room: T, draft?: RoomPlacementDraft | null): T {
  if (!draft) return room;
  const item = draft.item, offset = { x: 0, y: 0 };
  if (item.kind === 'bed') {
    const detach = <I extends PlacedDecoration | PlacedToy>(items: I[] | undefined) =>
      items?.some(i => i.support?.parentId === 'bed')
        ? items.map(i => i.support?.parentId === 'bed' ? { ...i, support: undefined } : i) : items;
    return { ...room, bedId: draft.target.id, roomBedOffset: offset,
      placedToys: detach(room.placedToys), placedDecorations: detach(room.placedDecorations),
      bedFlipped: undefined, bedScale: getBedPlacementScale(draft.target.id), bedRotationDegrees: undefined };
  }
  if (item.kind === 'toy') return { ...room, placedToys: [...(room.placedToys ?? []), { ...item, offset, ...draft.initial } as PlacedToy] };
  return { ...room, placedDecorations: [...(room.placedDecorations ?? []), { ...item, offset, ...draft.initial } as PlacedDecoration] };
}

/** One state update makes replacement and supported-object movement one Undo action. */
export function applyRoomObjectEdits(pet: PetProfile, edits: RoomObjectEdit[], remove: string[] = [], draft?: RoomPlacementDraft | null): PetProfile {
  const room = withRoomPlacementDraft(pet, draft);
  const removed = new Set(remove), byId = new Map(edits.map(edit => [edit.instanceId, edit]));
  const bed = byId.get('bed');
  const updateItems = <T extends PlacedToy | PlacedDecoration>(items: T[] | undefined): T[] | undefined => {
    if (!items) return items;
    const next = items.filter(item => !removed.has(item.instanceId)).map(item => {
      const edit = byId.get(item.instanceId);
      if (!edit) return removed.has(item.support?.parentId ?? '') ? { ...item, support: undefined } : item;
      const updated = { ...item, ...edit,
        offset: reuseOffset(item.offset, edit.offset),
        support: 'support' in edit ? reuseSupport(item.support, edit.support) : item.support };
      return Object.keys(updated).every(key => Object.is(updated[key as keyof T], item[key as keyof T])) ? item : updated;
    });
    return next.length === items.length && next.every((item, index) => item === items[index]) ? items : next;
  };
  const next = { ...room,
    roomPetOffset: reuseOffset(room.roomPetOffset, byId.get('cat')?.offset ?? room.roomPetOffset),
    bedId: removed.has('bed') ? undefined : room.bedId,
    roomBedOffset: reuseOffset(room.roomBedOffset, bed?.offset ?? room.roomBedOffset),
    bedRotationDegrees: bed?.rotationDegrees ?? room.bedRotationDegrees,
    bedScale: bed?.scale ?? room.bedScale,
    placedToys: updateItems(room.placedToys),
    placedDecorations: updateItems(room.placedDecorations),
  };
  return syncPetLayerOrder(Object.keys(next).every(key => Object.is(next[key as keyof PetProfile], room[key as keyof PetProfile])) ? room : next);
}

function reuseOffset(previous: RoomObjectEdit['offset'] | undefined, next: RoomObjectEdit['offset'] | undefined) {
  return previous?.x === next?.x && previous?.y === next?.y ? previous : next;
}

function reuseSupport(previous: RoomItemSupport | undefined, next: RoomItemSupport | undefined) {
  return previous && next && previous.parentId === next.parentId && previous.heading === next.heading
    && previous.position.every((value, index) => value === next.position[index]) ? previous : next;
}

/** A saved layout cannot allocate copies that are now used in another named room. */
export function restoreOwnedRoomLayout(pet: PetProfile, layout: RoomLayout, progress: Progress): PetProfile {
  const available = new Map(storedRoomItems({ ...pet, bedId: undefined, placedToys: [], placedDecorations: [] }, progress)
    .map(entry => [`${entry.target.kind}:${entry.target.id}`, entry.count]));
  const take = (kind: string, id: string) => {
    const key = `${kind}:${id}`, count = available.get(key) ?? 0;
    if (!count) return false;
    available.set(key, count - 1); return true;
  };
  const toys = layout.placedToys?.filter(item => take('toy', item.toyId));
  const decorations = layout.placedDecorations?.filter(item => take('decoration', item.decorationId));
  const bedId = layout.bedId && take('bed', layout.bedId) ? layout.bedId : undefined;
  const retained = new Set([...(bedId ? ['bed'] : []), ...(toys ?? []).map(item => item.instanceId), ...(decorations ?? []).map(item => item.instanceId)]);
  const support = <T extends { support?: RoomItemSupport }>(item: T): T => item.support && !retained.has(item.support.parentId) ? { ...item, support: undefined } : item;
  return syncPetLayerOrder({ ...pet, ...layout, bedId, placedToys: toys?.map(support), placedDecorations: decorations?.map(support) });
}
