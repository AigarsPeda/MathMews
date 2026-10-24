import { PetStage } from '@/components/pet/PetStage';
import type { useGame } from '@/contexts/GameProvider';
import type { RoomActivityKind } from '@/utils/room-activities';
import { roomFurnitureVersion } from '@/utils/room-edit';
import type { RoomLayout } from '@/utils/room-layout';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, type ComponentProps } from 'react';

// Rest/spread props can invalidate the compiler's JSX cache even when the
// forwarded values are unchanged (for example another room's Undo controls).
const MemoPetStage = memo(PetStage);

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
  const decorating = props.roomToolbar?.decorating;
  const onDecoratingChange = props.roomToolbar?.onDecoratingChange;
  const roomToolbar = useMemo(() => onDecoratingChange && decorating !== undefined
    ? { decorating, onDecoratingChange } : undefined, [decorating, onDecoratingChange]);
  // Moving one item refreshes Home's removal lookup. Existing room menus should
  // keep their handlers while still consulting that latest lookup when pressed.
  const { onPlacedToyRemove, onPlacedDecorationRemove } = props;
  const removals = useRef({ onPlacedToyRemove, onPlacedDecorationRemove });
  useLayoutEffect(() => { removals.current = { onPlacedToyRemove, onPlacedDecorationRemove }; },
    [onPlacedToyRemove, onPlacedDecorationRemove]);
  const removeToy = useCallback((id: string) => removals.current.onPlacedToyRemove?.(id), []);
  const removeDecoration = useCallback((id: string) => removals.current.onPlacedDecorationRemove?.(id), []);
  const onCommitRoomEdit = useCallback<NonNullable<ComponentProps<typeof PetStage>['onCommitRoomEdit']>>(
    (edits, remove) => commitRoomEdit(homeRoomId ?? 'livingRoom', edits, remove, version),
    [commitRoomEdit, homeRoomId, version]);
  const onRoomActivityCompleted = useCallback((kind: RoomActivityKind, id?: string) => completeRoomActivity(kind,
    stagedToys?.find(item => item.instanceId === id)?.toyId
      ?? stagedDecorations?.find(item => item.instanceId === id)?.decorationId),
  [completeRoomActivity, stagedToys, stagedDecorations]);
  return <MemoPetStage {...props} roomToolbar={roomToolbar} roomEditor={decorating === false ? undefined : props.roomEditor}
    onPlacedToyRemove={onPlacedToyRemove ? removeToy : undefined}
    onPlacedDecorationRemove={onPlacedDecorationRemove ? removeDecoration : undefined}
    onCommitRoomEdit={onCommitRoomEdit} onRoomActivityCompleted={onRoomActivityCompleted} />;
}
