import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';
import { clampRoomCamera, pinchRoomCamera } from '@/utils/room-camera';

/** Gestures live on the unscaled viewport so the artwork and its hit targets move together. */
export function useRoomCamera(width: number, height: number, enabled: boolean, reduceMotion: boolean, panEnabled = true) {
  const [zoom, setZoom] = useState(1);
  const x = useSharedValue(0), y = useSharedValue(0), scale = useSharedValue(1);
  const start = useSharedValue({ x: 0, y: 0, scale: 1, focalX: 0, focalY: 0 });
  const panStart = useSharedValue({ x: 0, y: 0 });
  const touchStart = useSharedValue({ x: 0, y: 0 });
  const reset = useCallback(() => {
    const duration = reduceMotion ? 0 : 180;
    x.set(withTiming(0, { duration })); y.set(withTiming(0, { duration }));
    scale.set(withTiming(1, { duration })); setZoom(1);
  }, [reduceMotion, scale, x, y]);
  useEffect(() => { reset(); }, [width, height, reset]);
  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch().enabled(enabled).onStart(event => {
      cancelAnimation(x); cancelAnimation(y); cancelAnimation(scale);
      start.set({ x: x.get(), y: y.get(), scale: scale.get(), focalX: event.focalX - width / 2, focalY: event.focalY - height / 2 });
    }).onUpdate(event => {
      const camera = pinchRoomCamera(start.get(), event.scale, event.focalX - width / 2, event.focalY - height / 2, width, height);
      x.set(camera.x); y.set(camera.y); scale.set(camera.scale);
    }).onFinalize(() => { scheduleOnRN(setZoom, scale.get()); });
    const pan = Gesture.Pan().enabled(enabled && panEnabled).minDistance(8).maxPointers(1)
      .manualActivation(true).onTouchesDown(event => {
        const touch = event.allTouches[0];
        if (touch) touchStart.set({ x: touch.x, y: touch.y });
      }).onTouchesMove((event, manager) => {
        // At 1× the surrounding page owns scrolling. A tap never activates pan.
        if (scale.get() <= 1.001) manager.fail();
        else if (event.numberOfTouches === 1) {
          const touch = event.allTouches[0];
          if (touch && Math.hypot(touch.x - touchStart.get().x, touch.y - touchStart.get().y) >= 8) manager.activate();
        }
      }).onStart(() => {
        cancelAnimation(x); cancelAnimation(y);
        panStart.set({ x: x.get(), y: y.get() });
      }).onUpdate(event => {
        const camera = clampRoomCamera(panStart.get().x + event.translationX, panStart.get().y + event.translationY, scale.get(), width, height);
        x.set(camera.x); y.set(camera.y);
      });
    return Gesture.Simultaneous(pinch, pan);
  }, [enabled, height, panEnabled, panStart, scale, start, touchStart, width, x, y]);
  return { x, y, scale, zoom, reset, gesture };
}
