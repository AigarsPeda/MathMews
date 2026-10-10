import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
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
    schedule: requestAnimationFrame, cancel: cancelAnimationFrame,
    onError: error => reportAppError('room-picking', error),
  }), []);
  useEffect(() => () => controller.cancel(), [controller]);
  // PanResponder stores callbacks without reading the ref during render.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: event => (event.nativeEvent.touches?.length ?? 1) === 1,
    onPanResponderGrant: event => controller.begin({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }),
    onPanResponderMove: (_event, gesture) => {
      if (gesture.numberActiveTouches > 1) { controller.cancel(); return; }
      controller.update(gesture.dx / Math.max(1, latest.current.zoom), gesture.dy / Math.max(1, latest.current.zoom));
    },
    onPanResponderRelease: () => controller.release(),
    onPanResponderTerminate: () => controller.release(),
    onPanResponderTerminationRequest: (_event, gesture) => gesture.numberActiveTouches > 1,
  }), [controller]);
  return <View testID="native-room-editor" accessible={false} style={[StyleSheet.absoluteFill, { zIndex: ROOM_MENU_OPEN_Z_INDEX - 1 }]} {...responder.panHandlers}/>;
}
