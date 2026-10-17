import type { PetProfile, Progress } from "@/types/game";
import { captureRoomLayout, type RoomLayout } from "@/utils/room-layout";
import { useCallback, useEffect, useRef, useState } from "react";

type RoomOwnership = Pick<Progress, 'bedsUnlocked' | 'toyQuantities' | 'decorationQuantities'>;

export function useRoomEditor(pet: PetProfile, setPet: (update: (pet: PetProfile) => PetProfile) => void, ownership: RoomOwnership) {
  const roomKey = `${pet.homeRoomId ?? "livingRoom"}:${pet.roomId ?? "room1"}`;
  const last = useRef({ room: roomKey, layout: captureRoomLayout(pet), ownership });
  const restoring = useRef(false);
  const [history, setHistory] = useState<RoomLayout[]>([]);
  useEffect(() => {
    const layout = captureRoomLayout(pet);
    const previousOwnership = last.current.ownership;
    const inventoryChanged = ownership.bedsUnlocked !== previousOwnership.bedsUnlocked
      || ownership.toyQuantities !== previousOwnership.toyQuantities
      || ownership.decorationQuantities !== previousOwnership.decorationQuantities;
    // Reconciliation can revoke an item while the editor is open. Its previous
    // layouts must never restore that item through Undo.
    if (roomKey !== last.current.room || inventoryChanged) setHistory([]);
    else if (JSON.stringify(layout) !== JSON.stringify(last.current.layout) && !restoring.current) {
      const previous = last.current.layout;
      setHistory(items => [...items, previous].slice(-20));
    }
    last.current = { room: roomKey, layout, ownership };
    restoring.current = false;
  }, [pet, roomKey, ownership]);
  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous) return;
    restoring.current = true;
    setHistory(items => items.slice(0, -1));
    setPet(current => ({ ...current, ...previous }));
  }, [history, setPet]);
  const saveLayout = useCallback(() => setPet(current => ({ ...current,
    savedRoomLayouts: { ...current.savedRoomLayouts, [current.roomId ?? "room1"]: captureRoomLayout(current) } })), [setPet]);
  const restoreLayout = useCallback(() => setPet(current => {
    const layout = current.savedRoomLayouts?.[current.roomId ?? "room1"];
    return layout ? { ...current, ...layout } : current;
  }), [setPet]);
  return { undo, canUndo: history.length > 0, saveLayout, restoreLayout, canRestore: Boolean(pet.savedRoomLayouts?.[pet.roomId ?? "room1"]) };
}
