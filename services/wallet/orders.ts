import type { GameSave } from '@/types/save';
import { switchRoomLayout } from '@/utils/room-layout';
import { getToyOwnedCount } from '@/utils/toy-store';
import { getDecorationOwnedCount } from '@/utils/decoration-store';
import { buyOneLife } from '@/utils/lives';
import type { CatRoomId } from '@/constants/cat-rooms';
import type { CatToyId } from '@/constants/cat-toys';
import type { CatDecorationId } from '@/constants/cat-decorations';

export type WalletOrder = {
  id: string;
  request_payload: { save_id: string; kind: string; item_id: string };
};

// Delivery is replayed from immutable server receipts after a crash or restore.
// Keep every applied receipt ID, independently of the bounded history UI.
export function applyWalletOrder(save: GameSave, order: WalletOrder): GameSave {
  if (save.appliedWalletOrderIds?.includes(order.id)) return save;
  const { kind, item_id: id } = order.request_payload;
  const progress = { ...save.progress };
  let pet = save.pet;
  const add = (ids: string[]) => [...new Set([...ids, id])];
  switch (kind) {
    case 'room': progress.roomsUnlocked = add(progress.roomsUnlocked); pet = switchRoomLayout(pet,id as CatRoomId); break;
    case 'bed':
      progress.bedsUnlocked = add(progress.bedsUnlocked);
      break;
    case 'skin': progress.skinsUnlocked = add(progress.skinsUnlocked); pet = { ...pet,catSkinId:id }; break;
    case 'toy':
      progress.toysUnlocked = add(progress.toysUnlocked);
      progress.toyQuantities = { ...progress.toyQuantities, [id]:getToyOwnedCount(id as CatToyId,save.progress)+1 };
      break;
    case 'decoration':
      progress.decorationsUnlocked = add(progress.decorationsUnlocked);
      progress.decorationQuantities = { ...progress.decorationQuantities,[id]:getDecorationOwnedCount(id as CatDecorationId,save.progress)+1 };
      break;
    case 'life': progress.lives = buyOneLife(progress.lives); break;
    default: throw new Error('Unknown wallet order');
  }
  if (progress.storeGoal?.kind === kind && progress.storeGoal.id === id) progress.storeGoal = undefined;
  return { ...save,pet,progress,appliedWalletOrderIds:[...(save.appliedWalletOrderIds ?? []),order.id] };
}
