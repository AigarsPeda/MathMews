import { roomTravelDirection, type HomeRoomId, type RoomTravelDirection } from '@/constants/home-rooms';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import type { PetProfile } from '@/types/game';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export type RoomSceneSlide = { progress: SharedValue<number>; direction: RoomTravelDirection; outgoing: boolean };
type Transition = { id: number; outgoing: PetProfile; destination: HomeRoomId; direction: RoomTravelDirection };

/** Prepared rooms switch immediately; retain the outgoing view for a cold scene. */
export function useRoomTransition(pet: PetProfile, onVisit: (room: HomeRoomId) => void) {
  const { active, reduceMotion } = useAnimationActivity();
  const progress = useSharedValue(1);
  const [transition, setTransition] = useState<Transition | null>(null);
  const sequence = useRef(0);
  const readyRooms = useRef(new Set<HomeRoomId>());
  const inFlight = useRef<number | null>(null);
  const finish = useCallback((id: number) => {
    if (inFlight.current !== id) return;
    inFlight.current = null;
    setTransition(current => current?.id === id ? null : current);
  }, []);
  const visit = useCallback((destination: HomeRoomId) => {
    const origin = pet.homeRoomId ?? 'livingRoom';
    if (origin === destination || inFlight.current !== null) return;
    if (active && !reduceMotion && pet.type === 'cat' && !readyRooms.current.has(destination)) {
      progress.set(0);
      const id = ++sequence.current;
      inFlight.current = id;
      setTransition({ id, outgoing: pet, destination, direction: roomTravelDirection(origin, destination) });
    }
    onVisit(destination);
  }, [active, onVisit, pet, progress, reduceMotion]);
  const ready = useCallback((room: HomeRoomId) => {
    readyRooms.current.add(room);
    if (!transition || room !== transition.destination) return;
    progress.set(1);
    finish(transition.id);
  }, [finish, progress, transition]);
  useEffect(() => {
    if (transition && (!active || reduceMotion)) {
      progress.set(1);
      finish(transition.id);
    }
  }, [active, finish, progress, reduceMotion, transition]);
  return { transition, progress, visit, ready };
}
