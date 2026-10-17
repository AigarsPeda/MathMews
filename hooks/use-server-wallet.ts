import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getWalletEnvironment } from '@/services/wallet/environment';
import { applyWalletOrder, type WalletOrder } from '@/services/wallet/orders';
import { applyProvisionalPurchase, confirmProvisionalPurchase, createPendingPurchase, projectedWalletCoins,
  rejectProvisionalPurchase, rejectedReceiptId, type PendingWalletPurchase, type PurchaseKind, type PurchaseRejection } from '@/services/wallet/offline-orders';
import { readWalletOutbox, updateWalletOutbox } from '@/services/wallet/outbox';
import type { GameSave } from '@/types/save';
import { saveGameSave } from '@/utils/game-storage';
import { createSaveId } from '@/utils/save-id';
import type { StorePurchaseResult } from '@/types/store';
import type { CoinTransaction } from '@/types/coin-transaction';
import { getStoreCoinPrice } from '@/utils/store-catalog';
import { refreshStoreCatalog } from '@/services/store-catalog';
import { reportAppError } from '@/lib/app-diagnostics';
import { MAX_LIVES } from '@/constants/game';
import { applyLifeRegen } from '@/utils/lives';

export type ServerWallet = { user_id:string; environment:string; balance:number; revision:number };
type LegacyOrder = { id:string; saveId:string; kind:string; itemId:string; expectedPrice?:number };
type Options = {
  userId:string|null; enabled:boolean; activeSaveIdRef:MutableRefObject<string|null>;
  getSave:()=>GameSave; setSave:(update:GameSave|((save:GameSave)=>GameSave))=>void;
  authorityRef:MutableRefObject<ServerWallet|null>; syncRef:MutableRefObject<(()=>Promise<void>)|null>;
};
async function withSyncDeadline<T>(request: PromiseLike<T>, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{onTimeout?.();reject(new Error('Wallet sync timed out'));},10000);})]);
  } finally { clearTimeout(timer); }
}

function rejection(error: unknown): PurchaseRejection | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const {code,message} = error as {code?:string;message?:string};
  if (code === '22003') return 'insufficient_funds';
  if (code === '23505') return 'already_owned';
  if (code === 'P0001' && message === 'Store price changed') return 'price_changed';
  if (code === 'P0001' && message === 'Item unavailable') return 'not_for_sale';
  return undefined;
}

export function useServerWallet({ userId,enabled,activeSaveIdRef,getSave,setSave,authorityRef,syncRef }:Options) {
  const environment = getWalletEnvironment(), scope = `${userId}:${environment}`;
  const scopeRef = useRef(scope);
  useLayoutEffect(()=>{scopeRef.current=scope;},[scope]);
  const running = useRef<Promise<void>|null>(null);
  const enqueueing = useRef<Promise<unknown>>(Promise.resolve());
  const results = useRef(new Map<string,StorePurchaseResult>());
  const initializedScope = useRef<string|null>(null);
  const reconciliationRequest = useRef<{scope:string;at:number}|null>(null);
  const [readyScope,setReadyScope] = useState<string|null>(null);
  const legacyKey = `@mathmews/wallet-order:${scope}`;

  const run = useCallback(async ():Promise<void> => {
    if (!userId || !supabase) return;
    if (running.current) return running.current;
    const current = () => scopeRef.current === scope;
    const rpc = async (name:string,args:Record<string,unknown>) => {
      if (!current()) throw new Error('Account changed');
      const controller = new AbortController();
      const query = supabase!.rpc(name,args);
      const {data,error} = await withSyncDeadline(typeof query.abortSignal === 'function' ? query.abortSignal(controller.signal) : query,()=>controller.abort());
      if (error) throw error;
      if (!current()) throw new Error('Account changed');
      return data;
    };
    const accept = (wallet:ServerWallet) => {
      const previous = authorityRef.current;
      if (wallet.user_id !== userId || wallet.environment !== environment) throw new Error('Wrong wallet');
      if (previous?.user_id===userId && previous.environment===environment && previous.revision>wallet.revision) return;
      authorityRef.current=wallet;
      setSave(save=>{
        const next={...save,walletAuthority:wallet};
        const coins=projectedWalletCoins(next,userId,environment);
        return save.walletAuthority?.revision===wallet.revision && save.walletAuthority.user_id===userId && save.wallet.coins===coins
          ? save : {...next,wallet:{coins}};
      });
    };
    const settle = async (purchase:PendingWalletPurchase) => {
      if (!current() || activeSaveIdRef.current !== purchase.saveId) return;
      // Persist the server outcome before changing the grant, so a crash between
      // local save and outbox cleanup cannot deliver or revoke an item twice.
      await updateWalletOutbox(scope,orders=>orders.some(p=>p.id===purchase.id)
        ? orders.map(p=>p.id===purchase.id?purchase:p) : [...orders,purchase]);
      if (!current() || activeSaveIdRef.current !== purchase.saveId) return;
      if (purchase.status==='confirmed' && purchase.confirmedWallet && (!authorityRef.current || authorityRef.current.user_id!==userId || authorityRef.current.revision<=purchase.confirmedWallet.revision)) authorityRef.current=purchase.confirmedWallet;
      setSave(save=>purchase.status==='confirmed'
        ? confirmProvisionalPurchase({...save,walletAuthority:authorityRef.current ?? purchase.confirmedWallet},purchase,purchase.receiptId!)
        : rejectProvisionalPurchase(save,purchase,purchase.rejection!));
      await saveGameSave(getSave());
      // Keep rejection tombstones so restoring an older snapshot cannot retry
      // a cancelled purchase or bring its room placement back.
      if (purchase.status==='confirmed') await updateWalletOutbox(scope,orders=>orders.filter(p=>p.id!==purchase.id));
      results.current.set(purchase.id,purchase.status==='confirmed'?'purchased':purchase.rejection!);
      if (results.current.size>150) results.current.delete(results.current.keys().next().value!);
    };
    const work = (async () => {
      try {
        const saveId=activeSaveIdRef.current;
        if (!saveId || getSave().accountOwnerId && getSave().accountOwnerId!==userId) return;
        // Restore pending grants after process death or an older cloud restore.
        const stored=await readWalletOutbox(scope);
        if (!current() || activeSaveIdRef.current!==saveId) return;
        const own=stored.filter(p=>p.userId===userId && p.environment===environment && p.saveId===saveId);
        for (const purchase of own) {
          if (purchase.status!=='pending') {
            if (purchase.status!=='rejected' || !getSave().appliedWalletOrderIds?.includes(rejectedReceiptId(purchase.id)) || getSave().pendingWalletPurchases?.some(p=>p.id===purchase.id)) await settle(purchase);
            continue;
          }
          const saved=getSave().pendingWalletPurchases?.find(p=>p.id===purchase.id);
          if (!saved || !getSave().appliedWalletOrderIds?.includes(`pending:${purchase.id}`)) {
            setSave(save=>applyProvisionalPurchase(save,saved ?? purchase));
            const restored=getSave().pendingWalletPurchases!.find(p=>p.id===purchase.id)!;
            await updateWalletOutbox(scope,orders=>orders.map(p=>p.id===purchase.id && p.status==='pending'?restored:p));
          }
        }
        if (own.length) await saveGameSave(getSave());
        if (!enabled) return;
        const wallet:ServerWallet=await rpc(initializedScope.current===scope?'get_my_coin_wallet':'initialize_my_game_wallet',{p_environment:environment});
        initializedScope.current=scope; accept(wallet);
        if (reconciliationRequest.current?.scope!==scope || Date.now()-reconciliationRequest.current.at>300000) {
          reconciliationRequest.current={scope,at:Date.now()};
          await rpc('request_my_purchase_reconciliation',{p_environment:environment}).catch(()=>undefined);
          if (!current()) return;
        }
        // Upgrade an interrupted request from app versions with one pending slot.
        const raw=await AsyncStorage.getItem(legacyKey);
        const legacy:LegacyOrder|undefined=raw?JSON.parse(raw):undefined;
        if (legacy) {
          try {
            await rpc('spend_game_coins',{p_environment:environment,p_save_id:legacy.saveId,p_kind:legacy.kind,p_item_id:legacy.itemId,p_request_id:legacy.id,
              ...(legacy.expectedPrice===undefined?{}:{p_expected_price:legacy.expectedPrice})});
            await AsyncStorage.removeItem(legacyKey);
          } catch(error) { if(rejection(error)) await AsyncStorage.removeItem(legacyKey); else throw error; }
        }
        // Sync the save before debiting. Failure leaves every queued action intact.
        if (own.length || getSave().pendingWalletPurchases?.length) await withSyncDeadline(syncRef.current?.() ?? Promise.resolve());
        while (current() && activeSaveIdRef.current===saveId) {
          const reward=(getSave().pendingCoinRewards??[]).filter(r=>r.userId===userId && r.environment===environment)
            .sort((a,b)=>(a.at??0)-(b.at??0))[0];
          const purchase=(getSave().pendingWalletPurchases??[]).filter(p=>p.userId===userId && p.environment===environment && p.saveId===saveId && p.status==='pending')
            .sort((a,b)=>a.at-b.at)[0];
          if (!reward && !purchase) break;
          if (reward && (!purchase || (reward.at??0)<=purchase.at)) {
            const rewarded:ServerWallet=await rpc('claim_puzzle_coins',{p_environment:environment,p_puzzle_id:reward.puzzleId,p_attempt_id:reward.attemptId});
            setSave(save=>({...save,pendingCoinRewards:(save.pendingCoinRewards??[]).filter(r=>r.attemptId!==reward.attemptId)}));
            accept(rewarded); await saveGameSave(getSave()); continue;
          }
          try {
            const receipt=await rpc('spend_game_coins',{p_environment:environment,p_save_id:purchase!.saveId,p_kind:purchase!.kind,p_item_id:purchase!.itemId,
              p_request_id:purchase!.id,p_expected_price:purchase!.expectedPrice});
            if (activeSaveIdRef.current!==saveId) break;
            // Update the authoritative balance together with releasing the reserve.
            const confirmedWallet:ServerWallet=await rpc('get_my_coin_wallet',{p_environment:environment});
            await settle({...purchase!,status:'confirmed',receiptId:receipt.id,confirmedWallet});
          } catch(error) {
            const reason=rejection(error);
            if (!reason) throw error;
            if (reason==='price_changed') await withSyncDeadline(refreshStoreCatalog()).catch(()=>undefined);
            await settle({...purchase!,status:'rejected',rejection:reason});
          }
        }
        if (!current() || activeSaveIdRef.current!==saveId) return;
        const delivery:{wallet:ServerWallet;orders:WalletOrder[]}=await rpc('get_my_game_delivery',{p_environment:environment,p_save_id:saveId});
        if (activeSaveIdRef.current!==saveId) return;
        setSave(save=>delivery.orders.reduce(applyWalletOrder,save)); accept(delivery.wallet);
        const {data:entries,error}=await withSyncDeadline(supabase.from('coin_wallet_entries').select('*').eq('user_id',userId)
          .eq('environment',environment).order('created_at',{ascending:false}).limit(150));
        if (error) throw error;
        if (!current() || activeSaveIdRef.current!==saveId) return;
        const history:CoinTransaction[]=(entries??[]).reverse().map(e=>({id:e.id,kind:e.kind==='store_spend'
          ? e.request_payload.kind==='life'?'life_purchase':`store_${e.request_payload.kind}`:e.kind,
          amount:Number(e.delta),balanceAfter:Number(e.balance_after),at:Date.parse(e.created_at),
          itemId:e.request_payload.item_id,productId:e.request_payload.product_id,transactionId:e.request_payload.transaction_id,label:e.reason}));
        setSave(save=>({...save,coinTransactions:[...history,...(save.coinTransactions??[]).filter(tx=>tx.syncStatus==='pending'||tx.syncStatus==='rejected')].sort((a,b)=>a.at-b.at).slice(-150)}));
        await saveGameSave(getSave()); setReadyScope(scope);
        void syncRef.current?.().catch(error=>reportAppError('wallet-save-sync',error));
      } catch(error) {
        if (current()) setReadyScope(null);
        reportAppError('wallet-sync',error);
        if (__DEV__) console.warn('[MathMews wallet] Sync unavailable',(error as {message?:string}).message??'Connection unavailable');
      }
    })();
    running.current=work;
    try { await work; } finally { if(running.current===work) running.current=null; }
  },[enabled,userId,scope,legacyKey,environment,authorityRef,setSave,getSave,activeSaveIdRef,syncRef]);

  useEffect(()=>{
    void run();
    const timer=setInterval(()=>{if(AppState.currentState==='active')void run();},10000);
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void run();});
    return()=>{clearInterval(timer);subscription.remove();};
  },[run]);

  const spend=useCallback(async(kind:string,itemId:string,displayedPrice?:number):Promise<StorePurchaseResult>=>{
    const requestScope=scope;
    const enqueue=enqueueing.current.catch(()=>undefined).then(async()=>{
      const saveId=activeSaveIdRef.current;
      if (!userId || scopeRef.current!==requestScope || !saveId) return {result:'unavailable' as StorePurchaseResult};
      const save=getSave(),expectedPrice=displayedPrice??getStoreCoinPrice(kind,itemId);
      if (expectedPrice===undefined || !Number.isSafeInteger(expectedPrice) || expectedPrice<0 || !['room','bed','toy','decoration','skin','life'].includes(kind)) return {result:'not_for_sale' as StorePurchaseResult};
      const authority=save.walletAuthority;
      if (!authority || authority.user_id!==userId || authority.environment!==environment || save.accountOwnerId && save.accountOwnerId!==userId) return {result:'unavailable' as StorePurchaseResult};
      if(projectedWalletCoins(save,userId,environment)<expectedPrice)return {result:'insufficient_funds' as StorePurchaseResult};
      if(kind==='life' && applyLifeRegen(save.progress.lives).current>=MAX_LIVES)return {result:'already_owned' as StorePurchaseResult};
      const unique=kind==='room'?save.progress.roomsUnlocked:kind==='bed'?save.progress.bedsUnlocked:kind==='skin'?save.progress.skinsUnlocked:[];
      if(unique.includes(itemId))return {result:'already_owned' as StorePurchaseResult};
      const purchase=createPendingPurchase(save,{id:createSaveId(),userId,environment,saveId,kind:kind as PurchaseKind,itemId,expectedPrice,at:Date.now()});
      await updateWalletOutbox(scope,orders=>[...orders,purchase]);
      if(scopeRef.current!==requestScope || activeSaveIdRef.current!==saveId)return {result:'queued' as StorePurchaseResult};
      setSave(current=>applyProvisionalPurchase(current,purchase));
      const granted=getSave().pendingWalletPurchases!.find(p=>p.id===purchase.id)!;
      await updateWalletOutbox(scope,orders=>orders.map(p=>p.id===purchase.id && p.status==='pending'?granted:p));
      await saveGameSave(getSave());
      return {id:purchase.id,result:'queued' as StorePurchaseResult};
    });
    enqueueing.current=enqueue;
    try {
      const queued=await enqueue;
      if(!queued.id)return queued.result;
      const synchronize=(async()=>{await run();
        if(getSave().pendingWalletPurchases?.some(p=>p.id===queued.id))await run();
        const outcome=results.current.get(queued.id!);results.current.delete(queued.id!);
        return outcome??'queued';})();
      let timer:ReturnType<typeof setTimeout>|undefined;
      try{return await Promise.race([synchronize,new Promise<StorePurchaseResult>(resolve=>{timer=setTimeout(()=>resolve('queued'),1500);})]);}
      finally{clearTimeout(timer);}
    } catch(error){reportAppError('wallet-queue',error);return 'unavailable';}
  },[scope,userId,environment,activeSaveIdRef,getSave,setSave,run]);
  const refresh=useCallback(async()=>{await run();},[run]);
  return {spend,refresh,isReady:enabled && !!userId && readyScope===scope};
}
