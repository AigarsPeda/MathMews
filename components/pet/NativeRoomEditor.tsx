import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { reportAppError } from '@/lib/app-diagnostics';
import { createRoomDragController } from '@/utils/room-drag-controller';
import type { RoomPoint } from '@/utils/room-activities';
import type { RoomDragBase, RoomDragMotion } from '@/utils/room-drag-motion';
import { ROOM_MENU_OPEN_Z_INDEX } from '@/utils/room-layer-order';

type Props = {
  zoom: number;
  cameraGesture: ReturnType<typeof Gesture.Simultaneous>;
  motion: SharedValue<RoomDragMotion>;
  base: SharedValue<RoomDragBase | undefined>;
  measure: SharedValue<boolean>;
  stop: () => void;
  pick: (point: RoomPoint) => Promise<string | undefined>;
  anchor: (id: string) => RoomPoint | undefined;
  select: (id: string | undefined) => void;
  prepare: (id: string, point: RoomPoint, motion: RoomDragMotion) => void;
  move: (id: string, point: RoomPoint, motion: RoomDragMotion) => RoomPoint;
  commit: (id: string, point: RoomPoint, motion?: RoomDragMotion) => void;
  discard: (id: string) => void;
  tap?: (point: RoomPoint, id?: string) => void;
  pan?: (dx: number, dy: number) => void;
};

/** Native pointer motion never waits for placement feedback or a React commit. */
export function NativeRoomEditor(props: Props) {
  'use no memo';
  const latest = useRef(props);
  const preparedId = useRef<string | undefined>(undefined);
  const sample = useRef<RoomDragMotion | undefined>(undefined);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  // The factory stores handlers; refs are read only when handling a gesture.
  // eslint-disable-next-line react-hooks/refs
  const [controller] = useState(() => createRoomDragController({
    pick: point => latest.current.pick(point),
    anchor: id => latest.current.anchor(id),
    select: id => latest.current.select(id),
    prepare: (id, anchor) => { if (sample.current) { preparedId.current = id; latest.current.prepare(id, anchor, { ...sample.current, x: 0, y: 0 }); } },
    move: (id, point) => sample.current ? latest.current.move(id, point, sample.current) : point,
    commit: (id, point) => { preparedId.current = undefined; latest.current.commit(id, point, sample.current); },
    discard: id => { preparedId.current = undefined; latest.current.discard(id); },
    tap: (point, id) => { preparedId.current = undefined; latest.current.stop(); latest.current.tap?.(point, id); },
    pan: (dx, dy) => latest.current.pan?.(dx, dy),
    schedule: requestAnimationFrame, cancel: cancelAnimationFrame,
    onError: error => { preparedId.current = undefined; latest.current.stop(); reportAppError('room-picking', error); },
  }));
  const { motion, base, measure, zoom, cameraGesture } = props;
  const cancel = useCallback(() => {
    controller.cancel();
    if (preparedId.current) { latest.current.discard(preparedId.current); preparedId.current = undefined; }
    latest.current.stop();
    const session = sample.current?.session;
    motion.set(current => current.session === session ? { ...current, active: false } : current);
  }, [controller, motion]);
  useEffect(() => cancel, [cancel]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    return () => subscription.remove();
  }, [cancel]);
  const begin = useCallback((point: RoomPoint, next: RoomDragMotion) => {
    sample.current = next; controller.begin(point);
  }, [controller]);
  const update = useCallback((next: RoomDragMotion) => {
    sample.current = next; controller.update(next.x, next.y, next.moved);
  }, [controller]);
  const finish = useCallback((next: RoomDragMotion) => {
    sample.current = next; controller.update(next.x, next.y, next.moved); controller.release();
    // A delayed picker may still finish this gesture; the base is cleared by commit/discard.
  }, [controller]);
  const lastFeedbackAt = useSharedValue(0);
  const touchStart = useSharedValue({ x: 0, y: 0 });
  const ended = useSharedValue(false);
  // Gesture builders register callbacks; refs/timestamps are read only on touch events.
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const gesture = useMemo(() => Gesture.Pan().minDistance(0).maxPointers(1)
    // A second finger must still be able to start the enclosing camera pinch.
    .simultaneousWithExternalGesture(...cameraGesture.toGestureArray())
    .onTouchesDown((event, manager) => {
      if (event.numberOfTouches > 1) { motion.set({ ...motion.get(), active: false }); manager.fail(); return; }
      const touch = event.allTouches[0];
      if (!touch) return;
      touchStart.set({ x: touch.absoluteX, y: touch.absoluteY }); ended.set(false);
      const next = { session: motion.get().session + 1, sequence: 0, x: 0, y: 0, active: true, moved: false, at: Date.now(), measure: measure.get() };
      motion.set(next); lastFeedbackAt.set(0);
      scheduleOnRN(begin, { x: touch.x, y: touch.y }, next);
    })
    .onTouchesMove(event => {
      const touch = event.allTouches[0], previous = motion.get();
      if (!touch || !previous.active || event.numberOfTouches !== 1) return;
      const x = (touch.absoluteX - touchStart.get().x) / Math.max(.1, zoom);
      const y = (touch.absoluteY - touchStart.get().y) / Math.max(.1, zoom);
      const next = { ...previous, sequence: previous.sequence + 1, x, y,
        moved: previous.moved || Math.hypot(x, y) > 6, at: Date.now() };
      motion.set(next);
      // Native preview runs every frame; collision/status feedback has its own budget.
      // Empty-space panning and the cat still use JS movement at frame rate.
      const interval = base.get()?.session === next.session ? 80 : 16;
      if (next.at - lastFeedbackAt.get() >= interval) { lastFeedbackAt.set(next.at); scheduleOnRN(update, next); }
    })
    .onTouchesUp(event => {
      const touch = event.changedTouches[0], previous = motion.get();
      if (!touch || ended.get() || !previous.active) return;
      const x = (touch.absoluteX - touchStart.get().x) / Math.max(.1, zoom);
      const y = (touch.absoluteY - touchStart.get().y) / Math.max(.1, zoom);
      const next = { ...previous, sequence: previous.sequence + 1, x, y,
        moved: previous.moved || Math.hypot(x, y) > 6, at: Date.now() };
      ended.set(true); motion.set(next); scheduleOnRN(finish, next);
    })
    .onFinalize((_event, success) => {
      if (!success && !ended.get()) { motion.set({ ...motion.get(), active: false }); scheduleOnRN(cancel); }
    }),
  [base, begin, cameraGesture, cancel, ended, finish, lastFeedbackAt, measure, motion, touchStart, update, zoom]);
  /* eslint-enable react-hooks/refs, react-hooks/purity */
  return <GestureDetector gesture={gesture}><View testID="native-room-editor" accessible={false} collapsable={false}
    style={[StyleSheet.absoluteFill, { zIndex: ROOM_MENU_OPEN_Z_INDEX - 1 }]}/></GestureDetector>;
}
