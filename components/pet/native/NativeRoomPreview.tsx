import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeRoomScene } from './NativeRoomScene';
import { buildNativeRoomWorld, placeNativePreview } from '@/utils/native-room-world';
import { getPetMediaRegistry } from '@/pet-display/registry/media-registry';
import { moderateScale } from '@/utils/scale';
import type { PetProfile, PlacedDecoration, PlacedToy } from '@/types/game';
import type { PetPlaybackState } from '@/pet-display/types';
type Props = {
  pet: PetProfile;
  roomId?: string;
  bedId?: string;
  skinId?: string;
  decorations: PlacedDecoration[];
  toys: PlacedToy[];
};
export function NativeRoomPreview({ pet, roomId, bedId, skinId, decorations, toys }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const world = useMemo(() => {
    const result = buildNativeRoomWorld({ ...size, petSize: 100, sizeScale: moderateScale(100) / 100,
      homeOffset: pet.roomPetOffset, bedId, bedOffset: pet.roomBedOffset, bedScale: pet.bedScale, bedFlipped: pet.bedFlipped, decorations, toys, layerOrder: pet.roomLayerOrder,
    });
    placeNativePreview(result, 'preview-decoration');
    placeNativePreview(result, 'preview-toy');
    return result;
  }, [bedId, decorations, pet.bedFlipped, pet.bedScale, pet.roomBedOffset, pet.roomLayerOrder, pet.roomPetOffset, size, toys]);
  const playback = useMemo<PetPlaybackState>(() => ({ kind: 'segment', mood: 'idle', segment: getPetMediaRegistry('cat').getSegment('idle') }), []);
  return <View style={StyleSheet.absoluteFill} onLayout={event => setSize(event.nativeEvent.layout)}>
  <NativeRoomScene world={world} roomId={roomId} skinId={skinId} playback={playback}/>
 </View>;
}
