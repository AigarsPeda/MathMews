import { PetStage } from '@/components/pet/PetStage';
import type { useGame } from '@/contexts/GameProvider';
import type { RoomActivityKind } from '@/utils/room-activities';
import { roomFurnitureVersion } from '@/utils/room-edit';
import type { RoomLayout } from '@/utils/room-layout';
import { useCallback, useMemo, type ComponentProps } from 'react';

/** Keep per-room edit and reward callbacks independent of pet-stat updates. */
export function HomeRoomStage({ savedRoom, commitRoomEdit, completeRoomActivity, ...props }: Omit<ComponentProps<typeof PetStage>,
  'onCommitRoomEdit' | 'onRoomActivityCompleted'> & {
  savedRoom: RoomLayout;
  commitRoomEdit: ReturnType<typeof useGame>['commitRoomEdit'];
  completeRoomActivity: (kind: RoomActivityKind, modelId?: string) => void;
}) {
  const { bedId, roomBedOffset, bedFlipped, bedScale, bedRotationDegrees, placedToys, placedDecorations, roomLayerOrder } = savedRoom;
  const version = useMemo(() => roomFurnitureVersion({ bedId, roomBedOffset, bedFlipped, bedScale,
    bedRotationDegrees, placedToys, placedDecorations, roomLayerOrder }),
  [bedId, roomBedOffset, bedFlipped, bedScale, bedRotationDegrees, placedToys, placedDecorations, roomLayerOrder]);
  const { homeRoomId, placedToys: stagedToys, placedDecorations: stagedDecorations } = props;
  const onCommitRoomEdit = useCallback<NonNullable<ComponentProps<typeof PetStage>['onCommitRoomEdit']>>(
    (edits, remove) => commitRoomEdit(homeRoomId ?? 'livingRoom', edits, remove, version),
    [commitRoomEdit, homeRoomId, version]);
  const onRoomActivityCompleted = useCallback((kind: RoomActivityKind, id?: string) => completeRoomActivity(kind,
    stagedToys?.find(item => item.instanceId === id)?.toyId
      ?? stagedDecorations?.find(item => item.instanceId === id)?.decorationId),
  [completeRoomActivity, stagedToys, stagedDecorations]);
  return <PetStage {...props} onCommitRoomEdit={onCommitRoomEdit} onRoomActivityCompleted={onRoomActivityCompleted} />;
}
