/* One drawing-thread storm clock synchronizes every window in the room. */
/* eslint-disable react-hooks/immutability */
import { RenderCallbackContext } from 'react-native-filament';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { weatherLightning, worldWeather } from '@/utils/world-weather';
import type { WorldClock } from '@/utils/world-clock';

export function NativeLightning({ clock, active, reduceMotion, flash }: {
  clock: WorldClock; active: boolean; reduceMotion: boolean; flash: ISharedValue<number>;
}) {
  const now = useWorldClockNow(5000, active);
  const weather = worldWeather(clock, Math.max(now, clock.realMs));
  const seconds = useSharedValue(0);
  RenderCallbackContext.useRenderCallback(({ timeSinceLastFrame }) => {
    'worklet';
    if (!active) return;
    const time = weather === 'rain' && !reduceMotion ? seconds.value + Math.max(0, Math.min(.1, timeSinceLastFrame)) : 0;
    if (time !== seconds.value) seconds.value = time;
    const next = weatherLightning(weather, time, reduceMotion);
    if (next !== flash.value) flash.value = next;
  }, [active, reduceMotion, weather, seconds, flash]);
  return null;
}
