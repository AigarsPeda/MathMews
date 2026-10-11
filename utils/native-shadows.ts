import { isLampDecorationId } from '@/constants/decoration-motion';
import type { NativeRoomObject } from '@/utils/native-room-world';

/** One sun map and at most two local maps keep room GPU work bounded. */
export function shadowCastingLampIds(objects: NativeRoomObject[]) {
  return new Set(objects.filter(object => object.poweredOn && isLampDecorationId(object.modelId)
    && !object.modelId.startsWith('lavaLamp') && object.modelId !== 'halloweenGhostLantern').slice(0, 2).map(object => object.instanceId));
}
