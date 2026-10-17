import { useEffect, useRef } from 'react';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { isSleepingBed } from '@/constants/bedroom-activities';
import { previewHomeRoom } from '@/utils/home-rooms';
import { worldClockReading, type WorldClock } from '@/utils/world-clock';
import type { PetProfile } from '@/types/game';

/** Only placed, full-size bedroom beds can be used for the nightly routine. */
export function bedroomSleepTarget(pet: PetProfile): string | undefined {
  const bedroom = previewHomeRoom(pet, 'bedroom');
  return bedroom.placedDecorations?.find(item => isSleepingBed(item.decorationId))?.instanceId
    ?? (bedroom.bedId && isSleepingBed(`bed-${bedroom.bedId}`) ? 'bed' : undefined);
}

/** One automatic request per game night, including the hours after midnight.
 * Manual actions can interrupt it without being repeated by the clock poll. */
export function useCatBedtime({ pet, clock, enabled, busy, hasCommand, onBedtime, onMorning }: {
  pet: PetProfile;
  clock?: WorldClock;
  enabled: boolean;
  busy: boolean;
  hasCommand: boolean;
  onBedtime: (instanceId: string) => void;
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
    const target = bedroomSleepTarget(pet);
    if (!target) return;
    attemptedNight.current = night;
    onBedtime(target);
  }, [busy, clock, enabled, hasCommand, now, onBedtime, onMorning, pet]);
}
