import type { RoomPoint } from '@/utils/room-activities';

/** Pick once per gesture; keep the object captured and process only the newest move per frame. */
export function createRoomDragController(options: {
  pick: (point: RoomPoint) => Promise<string | undefined>;
  anchor: (id: string) => RoomPoint | undefined;
  prepare?: (id: string, anchor: RoomPoint) => void;
  select: (id: string | undefined) => void;
  move: (id: string, point: RoomPoint) => RoomPoint;
  commit: (id: string, point: RoomPoint) => void;
  discard: (id: string) => void;
  tap?: (point: RoomPoint, id?: string) => void;
  pan?: (dx: number, dy: number) => void;
  schedule: (callback: () => void) => number;
  cancel: (id: number) => void;
  onError: (error: unknown) => void;
}) {
  type Drag = { start: RoomPoint; picked?: boolean; id?: string; anchor?: RoomPoint; point?: RoomPoint; dx: number; dy: number; appliedX?: number; appliedY?: number; moved: boolean; released: boolean };
  let current: Drag | undefined, frame: number | undefined;
  function stopFrame() { if (frame !== undefined) options.cancel(frame); frame = undefined; }
  function flush(drag: Drag) {
    if (current !== drag || !drag.moved) return;
    if (!drag.id) { if (drag.picked) options.pan?.(drag.dx, drag.dy); return; }
    if (!drag.anchor) return;
    if (drag.appliedX === drag.dx && drag.appliedY === drag.dy) return;
    drag.point = options.move(drag.id, { x: drag.anchor.x + drag.dx, y: drag.anchor.y + drag.dy });
    drag.appliedX = drag.dx; drag.appliedY = drag.dy;
  }
  function finish(drag: Drag) {
    stopFrame(); flush(drag);
    if (drag.id && drag.point) options.commit(drag.id, drag.point);
    else if (!drag.moved) options.tap?.(drag.start, drag.id);
    if (current === drag) current = undefined;
  }
  function cancel() {
    stopFrame();
    if (current?.id && current.point) options.discard(current.id);
    current = undefined;
  }
  return {
    begin(point: RoomPoint) {
      cancel();
      const drag: Drag = { start: point, dx: 0, dy: 0, moved: false, released: false };
      current = drag;
      void options.pick(point).then(id => {
        if (current !== drag) return;
        drag.picked = true; drag.id = id; drag.anchor = id ? options.anchor(id) : undefined;
        options.select(id);
        if (id && drag.anchor) options.prepare?.(id, drag.anchor);
        if (drag.released) finish(drag);
        else if (drag.moved) flush(drag);
      }).catch(error => { if (current === drag) { current = undefined; options.onError(error); } });
    },
    update(dx: number, dy: number, moved = false) {
      const drag = current;
      if (!drag || drag.released) return;
      drag.dx = dx; drag.dy = dy;
      drag.moved ||= moved || Math.hypot(dx, dy) > 6;
      if (!drag.moved || !drag.picked || frame !== undefined) return;
      frame = options.schedule(() => { frame = undefined; flush(drag); });
    },
    release() {
      const drag = current;
      if (!drag) return;
      drag.released = true;
      if (drag.picked) finish(drag);
    },
    cancel,
  };
}
