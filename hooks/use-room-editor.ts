import type { PetProfile, Progress } from "@/types/game";
import { captureRoomLayout, type RoomLayout } from "@/utils/room-layout";
import { restoreOwnedRoomLayout } from '@/utils/room-edit';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RoomOwnership = Progress;

export function useRoomEditor(pet: PetProfile, setPet: (update: (pet: PetProfile) => PetProfile) => void, ownership: RoomOwnership) {
  const roomKey = `${pet.homeRoomId ?? "livingRoom"}:${pet.roomId ?? "room1"}`;
  const last = useRef({ room: roomKey, layout: captureRoomLayout(pet), ownership });
  const restoring = useRef(false);
  // History is consumed by events. Only availability affects the UI; adding a
  // second Undo entry must not rerender every room or replace its controls.
  const history = useRef<RoomLayout[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    const layout = captureRoomLayout(pet);
    const previousOwnership = last.current.ownership;
    const inventoryChanged = ownership.bedsUnlocked !== previousOwnership.bedsUnlocked
      || ownership.toyQuantities !== previousOwnership.toyQuantities
      || ownership.decorationQuantities !== previousOwnership.decorationQuantities;
    // Reconciliation can revoke an item while the editor is open. Its previous
    // layouts must never restore that item through Undo.
    if (roomKey !== last.current.room || inventoryChanged) history.current = [];
    else if (JSON.stringify(layout) !== JSON.stringify(last.current.layout) && !restoring.current) {
      const previous = last.current.layout;
      history.current = [...history.current, previous].slice(-20);
    }
    last.current = { room: roomKey, layout, ownership };
    restoring.current = false;
    setCanUndo(history.current.length > 0);
  }, [pet, roomKey, ownership]);
  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (!previous) return;
    restoring.current = true;
    setCanUndo(history.current.length > 0);
    setPet(current => ({ ...current, ...previous }));
  }, [setPet]);
  const saveLayout = useCallback(() => setPet(current => ({ ...current,
    savedRoomLayouts: { ...current.savedRoomLayouts, [current.roomId ?? "room1"]: captureRoomLayout(current) } })), [setPet]);
  const restoreLayout = useCallback(() => setPet(current => {
    const layout = current.savedRoomLayouts?.[current.roomId ?? "room1"];
    return layout ? restoreOwnedRoomLayout(current, layout, ownership) : current;
  }), [setPet, ownership]);
  const canRestore = Boolean(pet.savedRoomLayouts?.[pet.roomId ?? "room1"]);
  return useMemo(() => ({ undo, canUndo, saveLayout, restoreLayout, canRestore }),
    [undo, canUndo, saveLayout, restoreLayout, canRestore]);
}
