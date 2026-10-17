import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getWalletEnvironment } from '@/services/wallet/environment';
import { applyWalletOrder, type WalletOrder } from '@/services/wallet/orders';
import type { GameSave } from '@/types/save';
import { saveGameSave } from '@/utils/game-storage';
import { createSaveId } from '@/utils/save-id';
import type { StorePurchaseResult } from '@/types/store';
import type { CoinTransaction } from '@/types/coin-transaction';

export type ServerWallet = { user_id:string; environment:string; balance:number; revision:number };
type PendingOrder = { id:string; saveId:string; kind:string; itemId:string };
type Options = {
  userId:string|null; enabled:boolean; activeSaveIdRef:MutableRefObject<string|null>;
  getSave:()=>GameSave; setSave:(update:GameSave|((save:GameSave)=>GameSave))=>void;
  authorityRef:MutableRefObject<ServerWallet|null>; syncRef:MutableRefObject<(()=>Promise<void>)|null>;
};

export function useServerWallet({ userId,enabled,activeSaveIdRef,getSave,setSave,authorityRef,syncRef }:Options) {
  const environment = getWalletEnvironment();
  const scope = `${userId}:${environment}`;
  const scopeRef = useRef(scope);
  useLayoutEffect(()=>{scopeRef.current=scope;},[scope]);
  const busy = useRef(false);
  const initializedScope = useRef<string|null>(null);
  const deliveredSave = useRef<string|null>(null);
  const deliveredOrderIds = useRef<GameSave["appliedWalletOrderIds"]>(undefined);
  const reconciliationRequest = useRef<{scope:string;at:number}|null>(null);
  const [readyScope,setReadyScope] = useState<string|null>(null);
  const key = `@mathmews/wallet-order:${scope}`;

  const run = useCallback(async (requested?:PendingOrder):Promise<StorePurchaseResult> => {
    if (!enabled || !userId || !supabase || busy.current) return 'unavailable';
    busy.current = true;
    const current = () => scopeRef.current === scope;
    const rpc = async (name:string,args:Record<string,unknown>) => {
      if (!current()) throw new Error('Account changed');
      const {data,error} = await supabase!.rpc(name,args);
      if (error) throw error;
      if (!current()) throw new Error('Account changed');
      return data;
    };
    const accept = (wallet:ServerWallet) => {
      const previous = authorityRef.current;
      if (wallet.user_id !== userId || wallet.environment !== environment) throw new Error('Wrong wallet');
      if (previous?.user_id===userId && previous.environment===environment && previous.revision>wallet.revision) return;
      authorityRef.current = wallet;
      const cached = getSave().walletAuthority;
      if (cached?.user_id!==userId || cached.environment!==environment || cached.revision!==wallet.revision || getSave().wallet.coins!==Number(wallet.balance)) {
        setSave(save=>({...save,wallet:{coins:Number(wallet.balance)},walletAuthority:wallet}));
      }
    };
    let outcome:StorePurchaseResult = 'unavailable';
    try {
      const oldRevision = authorityRef.current?.user_id===userId && authorityRef.current.environment===environment ? authorityRef.current.revision : -1;
      const wallet:ServerWallet = await rpc(initializedScope.current===scope ? 'get_my_coin_wallet' : 'initialize_my_game_wallet',{p_environment:environment});
      initializedScope.current=scope;
      accept(wallet);
      if (reconciliationRequest.current?.scope!==scope || Date.now()-reconciliationRequest.current.at>300000) {
        // Startup/foreground recovery only queues server work. A missing worker
        // deployment never blocks the already authoritative wallet or the game.
        reconciliationRequest.current={scope,at:Date.now()};
        await Promise.resolve(supabase.rpc('request_my_purchase_reconciliation',{p_environment:environment})).catch(()=>undefined);
        if (!current()) return 'unavailable';
      }
      const hadRewards=(getSave().pendingCoinRewards ?? []).some(r=>r.userId===userId && r.environment===environment);
      // Queue entries live in the same save as puzzle progress, so a retry or
      // restored cloud snapshot reuses the original server idempotency key.
      for (const reward of getSave().pendingCoinRewards ?? []) {
        if (reward.userId!==userId || reward.environment!==environment) continue;
        accept(await rpc('claim_puzzle_coins',{p_environment:environment,p_puzzle_id:reward.puzzleId,p_attempt_id:reward.attemptId}));
        setSave(save=>({...save,pendingCoinRewards:(save.pendingCoinRewards??[]).filter(r=>r.attemptId!==reward.attemptId)}));
      }
      const stored = await AsyncStorage.getItem(key);
      if (!current()) return 'unavailable';
      const pending:PendingOrder|undefined = stored ? JSON.parse(stored) : requested;
      const saveScope = `${scope}:${activeSaveIdRef.current}`;
      if (!pending && !hadRewards && oldRevision===wallet.revision && deliveredSave.current===saveScope && deliveredOrderIds.current===getSave().appliedWalletOrderIds) {
        setReadyScope(scope);
        return outcome;
      }
      if (pending) {
        // Persist before sending. An ambiguous network failure is retried with
        // the same request ID, including after app termination.
        if (!stored) await AsyncStorage.setItem(key,JSON.stringify(pending));
        try {
          await rpc('spend_game_coins',{p_environment:environment,p_save_id:pending.saveId,p_kind:pending.kind,p_item_id:pending.itemId,p_request_id:pending.id});
          outcome = requested?.id===pending.id ? 'purchased' : 'unavailable';
          await AsyncStorage.removeItem(key);
        } catch (error) {
          const code = (error as {code?:string}).code;
          // Only a definite database rejection clears a pending command.
          if (code==='22003' || code==='23505' || code==='42501' || code==='P0001') {
            await AsyncStorage.removeItem(key);
            outcome = code==='22003' ? 'insufficient_funds' : code==='23505' ? 'already_owned' : 'unavailable';
          } else throw error;
        }
      }
      const saveId = activeSaveIdRef.current;
      if (saveId) {
        const delivery:{wallet:ServerWallet;orders:WalletOrder[]} = await rpc('get_my_game_delivery',{p_environment:environment,p_save_id:saveId});
        accept(delivery.wallet);
        const orders=delivery.orders;
        if (activeSaveIdRef.current===saveId) {
          setSave(save=>orders.reduce(applyWalletOrder,save));
          await saveGameSave(getSave());
        }
      }
      const {data:entries,error} = await supabase.from('coin_wallet_entries').select('*').eq('user_id',userId)
        .eq('environment',environment).order('created_at',{ascending:false}).limit(150);
      if (error) throw error;
      if (!current()) return 'unavailable';
      const history:CoinTransaction[] = (entries??[]).reverse().map(e=>({id:e.id,kind:e.kind==='store_spend'
        ? e.request_payload.kind==='life' ? 'life_purchase' : `store_${e.request_payload.kind}` : e.kind,
        amount:Number(e.delta),balanceAfter:Number(e.balance_after),at:Date.parse(e.created_at),
        itemId:e.request_payload.item_id,productId:e.request_payload.product_id,transactionId:e.request_payload.transaction_id,label:e.reason}));
      setSave(save=>({...save,coinTransactions:history}));
      await saveGameSave(getSave());
      deliveredSave.current=saveScope;
      deliveredOrderIds.current=getSave().appliedWalletOrderIds;
      setReadyScope(scope);
      if (outcome==='purchased') void syncRef.current?.();
      return outcome;
    } catch (error) {
      if (current()) setReadyScope(null);
      if (__DEV__) console.warn("[MathMews wallet] Sync unavailable", (error as {message?:string}).message ?? "Connection unavailable");
      // A cached balance remains visible; only the server can authorize spend.
      return 'unavailable';
    } finally { busy.current=false; }
  },[enabled,userId,scope,key,environment,authorityRef,setSave,getSave,activeSaveIdRef,syncRef]);

  useEffect(()=>{
    if (!enabled) return;
    void Promise.resolve().then(()=>run());
    const timer=setInterval(()=>{ if(AppState.currentState==='active') void run(); },10000);
    const subscription=AppState.addEventListener('change',state=>{if(state==='active') void run();});
    return ()=>{clearInterval(timer);subscription.remove();};
  },[enabled,run]);

  const spend = useCallback(async(kind:string,itemId:string):Promise<StorePurchaseResult>=>{
    const saveId=activeSaveIdRef.current;
    if (!saveId) return 'unavailable';
    try {
      await syncRef.current?.(); // Ensure a newly created game exists before debit.
      return await run({id:createSaveId(),saveId,kind,itemId});
    } catch { return 'unavailable'; }
  },[activeSaveIdRef,run,syncRef]);
  const refresh = useCallback(async()=>{await run();},[run]);
  return {spend,refresh,isReady:enabled && !!userId && readyScope===scope};
}
