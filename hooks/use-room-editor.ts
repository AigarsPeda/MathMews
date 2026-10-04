import type { PetProfile } from "@/types/game";
import { captureRoomLayout, type RoomLayout } from "@/utils/room-layout";
import { useCallback, useEffect, useRef, useState } from "react";

export function useRoomEditor(pet: PetProfile, setPet: (update: (pet: PetProfile) => PetProfile) => void) {
  const last = useRef({ room: pet.roomId, layout: captureRoomLayout(pet) });
  const restoring = useRef(false);
  const [history, setHistory] = useState<RoomLayout[]>([]);
  useEffect(() => {
    const layout = captureRoomLayout(pet);
    if (pet.roomId !== last.current.room) setHistory([]);
    else if (JSON.stringify(layout) !== JSON.stringify(last.current.layout) && !restoring.current) {
      const previous = last.current.layout;
      setHistory(items => [...items, previous].slice(-20));
    }
    last.current = { room: pet.roomId, layout };
    restoring.current = false;
  }, [pet]);
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
