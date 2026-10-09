/** Keep the cat's paused pose, the visible room, and the outgoing slide only. */
export function shouldMountNativeRoom(room: string, visible: string, catRoom: string, outgoing?: string): boolean {
  return room === visible || room === catRoom || room === outgoing;
}
