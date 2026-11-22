import { isBathroomLightDecorationId, isLampDecorationId } from '@/constants/decoration-motion';
import type { NativeRoomObject } from '@/utils/native-room-world';

/** One sun map and at most two local maps keep room GPU work bounded. */
export function shadowCastingLocalLightIds(objects: NativeRoomObject[]) {
  const fires = objects.filter(object => object.poweredOn && object.modelId === 'livingFireplaceCream');
  const lamps = objects.filter(object => object.poweredOn && isLampDecorationId(object.modelId)
    && !isBathroomLightDecorationId(object.modelId) && !object.modelId.startsWith('lavaLamp') && object.modelId !== 'halloweenGhostLantern');
  return new Set([...fires, ...lamps].slice(0, 2).map(object => object.instanceId));
}
