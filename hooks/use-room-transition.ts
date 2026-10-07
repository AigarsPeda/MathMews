import { roomTravelDirection, type HomeRoomId, type RoomTravelDirection } from '@/constants/home-rooms';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import type { PetProfile } from '@/types/game';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelAnimation, Easing, runOnJS, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

export type RoomSceneSlide = { progress: SharedValue<number>; direction: RoomTravelDirection; outgoing: boolean };
type Transition = { id: number; outgoing: PetProfile; destination: HomeRoomId; direction: RoomTravelDirection };

/** Keep the previous scene until the destination has rendered and the slide ends. */
export function useRoomTransition(pet: PetProfile, onVisit: (room: HomeRoomId) => void) {
  const { active, reduceMotion } = useAnimationActivity();
  const progress = useSharedValue(1);
  const [transition, setTransition] = useState<Transition | null>(null);
  const sequence = useRef(0);
  const started = useRef(0);
  const inFlight = useRef<number | null>(null);
  const finish = useCallback((id: number) => {
    if (inFlight.current !== id) return;
    inFlight.current = null;
    setTransition(current => current?.id === id ? null : current);
  }, []);
  const visit = useCallback((destination: HomeRoomId) => {
    const origin = pet.homeRoomId ?? 'livingRoom';
    if (origin === destination || inFlight.current !== null) return;
    if (active && !reduceMotion && pet.type === 'cat') {
      progress.set(0);
      const id = ++sequence.current;
      inFlight.current = id;
      setTransition({ id, outgoing: pet, destination, direction: roomTravelDirection(origin, destination) });
    }
    onVisit(destination);
  }, [active, onVisit, pet, progress, reduceMotion]);
  const ready = useCallback((room: HomeRoomId) => {
    if (!transition || room !== transition.destination || started.current === transition.id) return;
    started.current = transition.id;
    const id = transition.id;
    progress.set(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }, finished => {
      if (finished) runOnJS(finish)(id);
    }));
  }, [finish, progress, transition]);
  useEffect(() => {
    if (transition && (!active || reduceMotion)) {
      cancelAnimation(progress);
      progress.set(1);
      finish(transition.id);
    }
  }, [active, finish, progress, reduceMotion, transition]);
  useEffect(() => () => cancelAnimation(progress), [progress]);
  return { transition, progress, visit, ready };
}
