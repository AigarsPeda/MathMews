import { HOME_ROOM_IDS, type HomeRoomId } from '@/constants/home-rooms';

/** Warm all furnished home scenes at startup and retain their native assets. */
export function shouldMountNativeRoom(room: string): boolean {
  return HOME_ROOM_IDS.includes(room as HomeRoomId);
}
