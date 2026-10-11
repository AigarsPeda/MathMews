import type { HomeRoomId } from '@/constants/home-rooms';

const rooms = new Map<HomeRoomId, (source: number) => void>();

export function registerRoomModelWarmup(room: HomeRoomId, prepare: (source: number) => void) {
  rooms.set(room, prepare);
  return () => { if (rooms.get(room) === prepare) rooms.delete(room); };
}

/** Warm in the home renderer while the shop covers it. */
export function warmHomeRoomModel(room: HomeRoomId, source?: number) {
  if (source !== undefined) rooms.get(room)?.(source);
}
