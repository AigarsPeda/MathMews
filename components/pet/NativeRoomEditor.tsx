import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AppState, PanResponder, StyleSheet, View } from 'react-native';
import { reportAppError } from '@/lib/app-diagnostics';
import { createRoomDragController } from '@/utils/room-drag-controller';
import type { RoomPoint } from '@/utils/room-activities';
import { ROOM_MENU_OPEN_Z_INDEX } from '@/utils/room-layer-order';

type Props = {
  zoom: number;
  pick: (point: RoomPoint) => Promise<string | undefined>;
  anchor: (id: string) => RoomPoint | undefined;
  select: (id: string | undefined) => void;
  move: (id: string, point: RoomPoint) => RoomPoint;
  commit: (id: string, point: RoomPoint) => void;
  discard: (id: string) => void;
  tap?: (point: RoomPoint, id?: string) => void;
  pan?: (dx: number, dy: number) => void;
};

/** One geometry picker owns editing touches, rather than overlapping square sprite targets. */
export function NativeRoomEditor(props: Props) {
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  // The factory stores these handlers; it invokes them only during a gesture.
  // eslint-disable-next-line react-hooks/refs
  const controller = useMemo(() => createRoomDragController({
    pick: point => latest.current.pick(point),
    anchor: id => latest.current.anchor(id),
    select: id => latest.current.select(id),
    move: (id, point) => latest.current.move(id, point),
    commit: (id, point) => latest.current.commit(id, point),
    discard: id => latest.current.discard(id),
    tap: (point, id) => latest.current.tap?.(point, id),
    pan: (dx, dy) => latest.current.pan?.(dx, dy),
    schedule: requestAnimationFrame, cancel: cancelAnimationFrame,
    onError: error => reportAppError('room-picking', error),
  }), []);
  useEffect(() => () => controller.cancel(), [controller]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') controller.cancel(); });
    return () => subscription.remove();
  }, [controller]);
  // PanResponder stores callbacks without reading the ref during render.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: event => (event.nativeEvent.touches?.length ?? 1) === 1,
    // Keep RNGH's pinch possible after the first finger captures an item.
    onShouldBlockNativeResponder: () => false,
    onPanResponderGrant: event => controller.begin({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }),
    onPanResponderStart: event => {
      if (event.nativeEvent.touches.length > 1) controller.cancel();
    },
    onPanResponderMove: (_event, gesture) => {
      if (gesture.numberActiveTouches > 1) { controller.cancel(); return; }
      controller.update(gesture.dx / Math.max(.1, latest.current.zoom), gesture.dy / Math.max(.1, latest.current.zoom));
    },
    onPanResponderRelease: () => controller.release(),
    onPanResponderTerminate: () => controller.cancel(),
    onPanResponderTerminationRequest: (_event, gesture) => gesture.numberActiveTouches > 1,
  }), [controller]);
  return <View testID="native-room-editor" accessible={false} style={[StyleSheet.absoluteFill, { zIndex: ROOM_MENU_OPEN_Z_INDEX - 1 }]} {...responder.panHandlers}/>;
}
