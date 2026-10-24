import type { CatToyId } from '@/constants/cat-toys';
import type { CatDecorationId } from '@/constants/cat-decorations';
import type { CoinTransaction } from '@/types/coin-transaction';
import type { GameSave } from '@/types/save';
import type { PetProfile, PlacedToy, PlacedDecoration } from '@/types/game';
import type { RoomLayout } from '@/utils/room-layout';
import { applyWalletOrder } from '@/services/wallet/orders';
import { normalizeRoomLayerOrder, syncPetLayerOrder } from '@/utils/room-layer-order';
import { getDecorationOwnedCount } from '@/utils/decoration-store';
import { getToyOwnedCount } from '@/utils/toy-store';

export type PurchaseKind = 'room' | 'bed' | 'toy' | 'decoration' | 'skin' | 'life';
export type PurchaseRejection = 'insufficient_funds' | 'price_changed' | 'already_owned' | 'not_for_sale';
export type PendingWalletPurchase = {
  id: string; userId: string; environment: string; saveId: string;
  kind: PurchaseKind; itemId: string; expectedPrice: number; at: number;
  status: 'pending' | 'confirmed' | 'rejected'; receiptId?: string; rejection?: PurchaseRejection;
  confirmedWallet?: { user_id:string;environment:string;balance:number;revision:number };
  undo: { wasOwned: boolean; previousSelection?: string; addedInstances: string[] };
};
export type WalletNotice = { id: string; kind: PurchaseKind; itemId: string; reason: PurchaseRejection };
export const rejectedReceiptId = (id: string) => `rejected:${id}`;
export const provisionalReceiptId = (id: string) => `pending:${id}`;

export function normalizePendingWalletPurchases(value: unknown): PendingWalletPurchase[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((entry): entry is PendingWalletPurchase => {
    if (!entry || typeof entry !== 'object') return false;
    const e = entry as PendingWalletPurchase;
    if (!['id','userId','saveId','itemId'].every(key => typeof e[key as keyof PendingWalletPurchase] === 'string' && e[key as keyof PendingWalletPurchase]) ||
        !['sandbox','production'].includes(e.environment) || !['room','bed','toy','decoration','skin','life'].includes(e.kind) ||
        !Number.isSafeInteger(e.expectedPrice) || e.expectedPrice < 0 || !Number.isFinite(e.at) ||
        !['pending','confirmed','rejected'].includes(e.status) || !e.undo || typeof e.undo.wasOwned !== 'boolean' ||
        !Array.isArray(e.undo.addedInstances) || e.undo.addedInstances.some(id => typeof id !== 'string') ||
        (e.undo.previousSelection !== undefined && typeof e.undo.previousSelection !== 'string') ||
        (e.status === 'confirmed' && (typeof e.receiptId !== 'string' || !e.confirmedWallet || !Number.isFinite(e.confirmedWallet.balance) || !Number.isFinite(e.confirmedWallet.revision) || e.confirmedWallet.user_id !== e.userId || e.confirmedWallet.environment !== e.environment)) ||
        (e.status === 'rejected' && !['insufficient_funds','price_changed','already_owned','not_for_sale'].includes(e.rejection!)) || seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

export function projectedWalletCoins(save: GameSave, userId = save.walletAuthority?.user_id, environment = save.walletAuthority?.environment) {
  const authority = save.walletAuthority;
  if (!authority || authority.user_id !== userId || authority.environment !== environment) return save.wallet.coins;
  const reserved = (save.pendingWalletPurchases ?? []).filter(p => p.userId === userId && p.environment === environment && p.status === 'pending')
    .reduce((sum,p) => sum + p.expectedPrice,0);
  const rewards = (save.pendingCoinRewards ?? []).filter(r => r.userId === userId && r.environment === environment)
    .reduce((sum,r) => sum + (r.amount ?? 0),0);
  return Math.max(0, Number(authority.balance) + rewards - reserved);
}

export function createPendingPurchase(save: GameSave, input: Omit<PendingWalletPurchase,'undo'|'status'>): PendingWalletPurchase {
  const selection = input.kind === 'room' ? save.pet.roomId : input.kind === 'bed' ? save.pet.bedId : input.kind === 'skin' ? save.pet.catSkinId : undefined;
  const owned = input.kind === 'room' ? save.progress.roomsUnlocked : input.kind === 'bed' ? save.progress.bedsUnlocked : input.kind === 'skin' ? save.progress.skinsUnlocked
    : input.kind === 'toy' ? save.progress.toysUnlocked : input.kind === 'decoration' ? save.progress.decorationsUnlocked : [];
  return { ...input,status:'pending',undo:{wasOwned:owned.includes(input.itemId),previousSelection:selection,addedInstances:[]} };
}

/** Grant once locally. The durable marker is replaced by the actual receipt. */
export function applyProvisionalPurchase(save: GameSave, purchase: PendingWalletPurchase): GameSave {
  const marker = provisionalReceiptId(purchase.id);
  const existing = save.pendingWalletPurchases?.find(p=>p.id===purchase.id);
  const pending = [...(save.pendingWalletPurchases ?? []).filter(p => p.id !== purchase.id),existing ?? purchase];
  if (save.appliedWalletOrderIds?.includes(marker) || (purchase.receiptId && save.appliedWalletOrderIds?.includes(purchase.receiptId))) {
    const next = { ...save,pendingWalletPurchases:pending };
    return { ...next,wallet:{coins:projectedWalletCoins(next)} };
  }
  const before = new Set([...(save.pet.placedToys ?? []),...(save.pet.placedDecorations ?? [])].map(item => item.instanceId));
  const granted = applyWalletOrder(save,{id:marker,request_payload:{save_id:purchase.saveId,kind:purchase.kind,item_id:purchase.itemId}});
  const addedInstances = [...(granted.pet.placedToys ?? []),...(granted.pet.placedDecorations ?? [])].filter(item => !before.has(item.instanceId)).map(item => item.instanceId);
  const withUndo = { ...purchase,undo:{...purchase.undo,addedInstances} };
  const next: GameSave = { ...granted,pendingWalletPurchases:pending.map(p => p.id === purchase.id ? withUndo : p),
    coinTransactions:[...(save.coinTransactions ?? []),{id:marker,kind:purchase.kind === 'life' ? 'life_purchase' : `store_${purchase.kind}`,
      amount:-purchase.expectedPrice,balanceAfter:0,at:purchase.at,itemId:purchase.itemId,syncStatus:'pending'} as CoinTransaction].slice(-150) };
  next.wallet = {coins:projectedWalletCoins(next)};
  next.coinTransactions![next.coinTransactions!.length-1].balanceAfter = next.wallet.coins;
  return next;
}

function cleanRooms(pet: PetProfile, clean: (layout: RoomLayout & { roomId?: string }) => RoomLayout & { roomId?: string }): PetProfile {
  const normalized = (layout: RoomLayout & { roomId?: string }) => {
    const next = clean(layout);
    return {...next,roomLayerOrder:normalizeRoomLayerOrder(next)};
  };
  const layouts = (value: PetProfile['roomLayouts']) => value && Object.fromEntries(Object.entries(value).map(([id,room]) => [id,normalized(room)]));
  return { ...pet,...normalized(pet),roomLayouts:layouts(pet.roomLayouts),savedRoomLayouts:layouts(pet.savedRoomLayouts),
    homeRooms:pet.homeRooms && Object.fromEntries(Object.entries(pet.homeRooms).map(([id,room]) => [id,{...room,...normalized(room),
      roomLayouts:layouts(room.roomLayouts),savedRoomLayouts:layouts(room.savedRoomLayouts)}])) };
}

/** Remove the rejected grant from active, named and saved room layouts. */
export function rejectProvisionalPurchase(save: GameSave, purchase: PendingWalletPurchase, reason: PurchaseRejection): GameSave {
  const marker = provisionalReceiptId(purchase.id);
  let next: GameSave = { ...save,pendingWalletPurchases:(save.pendingWalletPurchases ?? []).filter(p => p.id !== purchase.id) };
  if (save.appliedWalletOrderIds?.includes(marker)) {
    const progress = { ...save.progress }, id = purchase.itemId;
    let pet = save.pet;
    if (purchase.kind === 'room' || purchase.kind === 'bed' || purchase.kind === 'skin') {
      const key = purchase.kind === 'room' ? 'roomsUnlocked' : purchase.kind === 'bed' ? 'bedsUnlocked' : 'skinsUnlocked';
      if (!purchase.undo.wasOwned && reason !== 'already_owned') progress[key] = progress[key].filter(owned => owned !== id);
      const fallback = purchase.undo.previousSelection && progress[key].includes(purchase.undo.previousSelection) ? purchase.undo.previousSelection
        : purchase.kind === 'room' ? 'room1' : purchase.kind === 'skin' ? progress.skinsUnlocked[0] ?? 'orange' : undefined;
      if (reason !== 'already_owned' && !purchase.undo.wasOwned) {
        if (purchase.kind === 'room') pet = cleanRooms(pet,layout => layout.roomId === id ? {...layout,roomId:fallback} : layout);
        if (purchase.kind === 'bed') pet = cleanRooms(pet,layout => layout.bedId === id ? {...layout,bedId:fallback,bedScale:undefined,bedFlipped:undefined,bedRotationDegrees:undefined} : layout);
        if (purchase.kind === 'skin' && pet.catSkinId === id) pet = {...pet,catSkinId:fallback};
      }
    } else if (purchase.kind === 'toy' || purchase.kind === 'decoration') {
      const count = Math.max(0,(purchase.kind === 'toy' ? getToyOwnedCount(id as CatToyId,progress) : getDecorationOwnedCount(id as CatDecorationId,progress))-1);
      if (purchase.kind === 'toy') {
        progress.toyQuantities = {...progress.toyQuantities,[id]:count};
        if (!count) progress.toysUnlocked = progress.toysUnlocked.filter(owned => owned !== id);
      } else {
        progress.decorationQuantities = {...progress.decorationQuantities,[id]:count};
        if (!count) progress.decorationsUnlocked = progress.decorationsUnlocked.filter(owned => owned !== id);
      }
      const rejectedInstances = new Set([...purchase.undo.addedInstances, ...(save.pendingWalletPurchases?.find(order => order.id === purchase.id)?.undo.addedInstances ?? [])]);
      pet = cleanRooms(pet,layout => {
        const key = purchase.kind === 'toy' ? 'placedToys' : 'placedDecorations';
        let kept = 0;
        const removed = new Set<string>();
        const list = (layout[key] ?? []).filter(item => {
          const matches = 'toyId' in item ? item.toyId === id : item.decorationId === id;
          const keep = !matches || (!rejectedInstances.has(item.instanceId) && kept++ < count);
          if (!keep) removed.add(item.instanceId);
          return keep;
        });
        return {...layout,[key]:list,roomLayerOrder:layout.roomLayerOrder?.filter(item => item.kind === 'bed' || !removed.has(item.instanceId))};
      });
      // Live named rooms share one owned quantity. Alternate saved layouts are
      // snapshots, but cannot retain an instance revoked from a live room.
      const key = purchase.kind === 'toy' ? 'placedToys' : 'placedDecorations';
      const activeRoom = pet.homeRoomId ?? 'livingRoom';
      const liveRooms = [pet, ...Object.entries(pet.homeRooms ?? {}).filter(([roomId]) => roomId !== activeRoom).map(([, room]) => room)];
      const copies = [...new Map(liveRooms.flatMap<PlacedToy | PlacedDecoration>(room => room[key] ?? []).filter(item =>
        ('toyId' in item ? item.toyId : item.decorationId) === id).map(item => [item.instanceId, item])).values()]
        .sort((a, b) => a.instanceId.localeCompare(b.instanceId));
      const excess = new Set(copies.slice(count).map(item => item.instanceId));
      if (excess.size) pet = cleanRooms(pet, layout => ({ ...layout,
        [key]: layout[key]?.filter(item => !excess.has(item.instanceId)),
        roomLayerOrder: layout.roomLayerOrder?.filter(item => item.kind === 'bed' || !excess.has(item.instanceId)),
      }));
    } else if (purchase.kind === 'life') {
      // A provisional life may already have been consumed; never undo progress.
      progress.lives = {...progress.lives,current:Math.max(0,progress.lives.current-1)};
    }
    next = {...next,pet:syncPetLayerOrder(pet),progress,appliedWalletOrderIds:save.appliedWalletOrderIds.filter(id => id !== marker)};
  }
  const alreadyRejected = save.appliedWalletOrderIds?.includes(rejectedReceiptId(purchase.id));
  next = {...next,appliedWalletOrderIds:[...new Set([...(next.appliedWalletOrderIds ?? []),rejectedReceiptId(purchase.id)])]};
  const notices = next.walletNotices ?? [];
  return {...next,wallet:{coins:projectedWalletCoins(next)},
    walletNotices:alreadyRejected || notices.some(n => n.id === purchase.id) ? notices : [...notices,{id:purchase.id,kind:purchase.kind,itemId:purchase.itemId,reason}],
    coinTransactions:(next.coinTransactions ?? []).map(tx => tx.id === marker ? {...tx,amount:0,syncStatus:'rejected',failureReason:reason} : tx)};
}

export function confirmProvisionalPurchase(save: GameSave, purchase: PendingWalletPurchase, receiptId: string): GameSave {
  const marker = provisionalReceiptId(purchase.id);
  let next = save;
  if (save.appliedWalletOrderIds?.includes(marker)) next = {...save,appliedWalletOrderIds:[...new Set([...save.appliedWalletOrderIds.filter(id => id !== marker),receiptId])]};
  else next = applyWalletOrder(save,{id:receiptId,request_payload:{save_id:purchase.saveId,kind:purchase.kind,item_id:purchase.itemId}});
  next = {...next,pendingWalletPurchases:(next.pendingWalletPurchases ?? []).filter(p => p.id !== purchase.id),
    coinTransactions:(next.coinTransactions ?? []).filter(tx => tx.id !== marker)};
  return {...next,wallet:{coins:projectedWalletCoins(next)}};
}
