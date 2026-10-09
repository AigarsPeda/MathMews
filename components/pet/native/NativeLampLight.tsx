import { Light } from 'react-native-filament';
import { lampLightConfig } from '@/utils/native-lamp-light';
import type { NativeRoomObject } from '@/utils/native-room-world';

export function NativeLampLight({ object, active }: { object: NativeRoomObject; active: boolean }) {
  // Numeric properties avoid sending native light handles through shared-value listeners.
  const light = active ? lampLightConfig(object) : undefined;
  return light ? <Light {...light}/> : null;
}
