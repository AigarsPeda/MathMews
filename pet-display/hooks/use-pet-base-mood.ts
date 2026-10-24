import { worldClockReading, type WorldClock } from '@/utils/world-clock';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { reuseShallowEqual } from '@/utils/reuse-shallow-equal';
import type { PetAnimationState, PetProfile } from '@/types/game';
import { derivePetVideoMood, getLastInteractionAt, shouldPetSleep } from '@/pet-display/engine/derive-mood';
import { useCallback, useEffect, useState } from 'react';

type MoodReading = {
  pet: PetProfile; clock: WorldClock | undefined;
  active: boolean; interactionAt: number; asleep: boolean; night: boolean | undefined;
  lieDownDone: boolean; fallAsleepDone: boolean; mood: PetAnimationState;
};

function readMood(pet: PetProfile, clock: WorldClock | undefined, active: boolean, previous?: MoodReading): MoodReading {
  const now = Date.now();
  const night = clock ? worldClockReading(clock, now).period === 'night' : undefined;
  const interactionAt = getLastInteractionAt(pet);
  const asleep = pet.isAsleep === true && (pet.type !== 'cat' || night !== false);
  const samePhase = previous?.interactionAt === interactionAt && previous.asleep === asleep && previous.night === night;
  const lieDownDone = samePhase ? previous.lieDownDone : asleep;
  const fallAsleepDone = samePhase ? previous.fallAsleepDone : asleep;
  const next = { pet, clock, active, interactionAt, asleep, night, lieDownDone, fallAsleepDone,
    mood: derivePetVideoMood(pet, fallAsleepDone, now, lieDownDone, night) };
  return reuseShallowEqual(previous, next)!;
}

export function usePetBaseMood(pet: PetProfile, clock?: WorldClock) {
  const { active } = useAnimationActivity();
  const [reading, setReading] = useState(() => readMood(pet, clock, active));
  // Refresh changed inputs before commit, including the first focused render.
  if (reading.pet !== pet || reading.clock !== clock || reading.active !== active) {
    setReading(previous => readMood(pet, clock, active, previous));
  }

  useEffect(() => {
    if (!active) return;
    // Publish mood/phase changes, not every tick of the underlying clock.
    const update = () => setReading(previous => readMood(pet, clock, active, previous));
    const frame = requestAnimationFrame(update);
    const interval = setInterval(update, clock ? 5000 : 30_000);
    return () => { cancelAnimationFrame(frame); clearInterval(interval); };
  }, [active, clock, pet]);

  const { interactionAt, night, mood } = reading;
  const onFallAsleepComplete = useCallback(() => {
    setReading(previous =>
      previous.interactionAt === interactionAt && !previous.fallAsleepDone && shouldPetSleep(previous.pet, Date.now(), night)
        ? readMood(previous.pet, previous.clock, previous.active, { ...previous, fallAsleepDone: true }) : previous);
  }, [interactionAt, night]);
  const onLieDownComplete = useCallback(() => {
    setReading(previous => previous.interactionAt === interactionAt && !previous.lieDownDone
      ? readMood(previous.pet, previous.clock, previous.active, { ...previous, lieDownDone: true }) : previous);
  }, [interactionAt]);
  return { mood, onFallAsleepComplete, onLieDownComplete };
}
