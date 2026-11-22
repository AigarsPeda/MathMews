import { useEffect, useRef } from 'react';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { isSleepingBed } from '@/constants/bedroom-activities';
import { getCatHomeRoomId, previewHomeRoom } from '@/utils/home-rooms';
import { worldClockReading, type WorldClock } from '@/utils/world-clock';
import type { HomeRoomId } from '@/constants/home-rooms';
import type { PetProfile } from '@/types/game';

/** Use a quilt in the cat’s room when one is available. */
export function roomSleepTarget(pet: PetProfile): string | undefined {
  const room = previewHomeRoom(pet, getCatHomeRoomId(pet));
  return room.placedDecorations?.find(item => isSleepingBed(item.decorationId))?.instanceId
    ?? (room.bedId && isSleepingBed(`bed-${room.bedId}`) ? 'bed' : undefined);
}

/** One automatic request per game night, including the hours after midnight.
 * Manual actions can interrupt it without being repeated by the clock poll. */
export function useCatBedtime({ pet, clock, enabled, busy, hasCommand, onBedtime, onMorning }: {
  pet: PetProfile;
  clock?: WorldClock;
  enabled: boolean;
  busy: boolean;
  hasCommand: boolean;
  onBedtime: (roomId: HomeRoomId, instanceId: string) => void;
  onMorning: () => void;
}) {
  const now = useWorldClockNow(5000, enabled && !!clock);
  const attemptedNight = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || !clock || pet.type !== 'cat') return;
    const reading = worldClockReading(clock, now);
    if (reading.period !== 'night') { attemptedNight.current = null; onMorning(); return; }
    const night = reading.day - (reading.minute < 360 ? 1 : 0);
    if (attemptedNight.current === night || busy || hasCommand) return;
    const target = roomSleepTarget(pet);
    if (!target) return;
    attemptedNight.current = night;
    onBedtime(getCatHomeRoomId(pet), target);
  }, [busy, clock, enabled, hasCommand, now, onBedtime, onMorning, pet]);
}
