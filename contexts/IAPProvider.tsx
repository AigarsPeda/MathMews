import { useAuth } from '@/contexts/AuthProvider';
import { useGame } from '@/contexts/GameProvider';
import type { CoinPackProductId } from '@/constants/iap-products';
import { fetchCoinPackCatalog,isRevenueCatSupported,purchaseCoinPack,restorePurchases as restoreRevenueCatPurchases,
  withRevenueCatUser,type CoinPackCatalogEntry,type CoinPackPurchaseResult } from '@/services/iap/revenuecat';
import { supabase } from '@/lib/supabase';
import { getWalletEnvironment } from '@/services/wallet/environment';
import { acquireAccountOperation } from '@/services/auth/account-operation';
import { createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode } from 'react';

type IAPContextValue = {
  isReady:boolean; isSupported:boolean; requiresAccountLink:boolean; coinPackCatalog:CoinPackCatalogEntry[];
  purchaseCoinPack:(id:CoinPackProductId)=>Promise<CoinPackPurchaseResult>;
  restorePurchases:()=>Promise<{coins:number;recoveryQueued:boolean}>; refreshOfferings:()=>Promise<void>;
  pendingCoinCelebration:number; clearCoinCelebration:()=>void;
};
const IAPContext=createContext<IAPContextValue|null>(null);

export function IAPProvider({children}:{children:ReactNode}) {
  const {isAuthReady,userId,isPlatformAccountLinked}=useAuth();
  const {refreshWallet,isWalletReady}=useGame();
  const [readyUser,setReadyUser]=useState<string|null>(null);
  const [configurationFailed,setConfigurationFailed]=useState(false);
  const [coinPackCatalog,setCoinPackCatalog]=useState<CoinPackCatalogEntry[]>([]);
  const [coinCelebration,setCoinCelebration]=useState<{userId:string;coins:number}|null>(null);
  const pendingCoinCelebration=coinCelebration?.userId===userId ? coinCelebration.coins : 0;
  const clearCoinCelebration=useCallback(()=>setCoinCelebration(null),[]);
  const busy=useRef(false);
  const userRef=useRef(userId);
  useLayoutEffect(()=>{userRef.current=userId;},[userId]);
  const nativeSupported=isRevenueCatSupported();
  const isSupported=nativeSupported && !configurationFailed;
  const requiresAccountLink=getWalletEnvironment()==='production' && !isPlatformAccountLinked;
  const isReady=isSupported && isAuthReady && !!userId && readyUser===userId && isWalletReady && !requiresAccountLink;
  const refreshOfferings=useCallback(async()=>{
    if (!nativeSupported || !isAuthReady || !userId) return;
    try {
      const catalog=await withRevenueCatUser(userId,fetchCoinPackCatalog);
      if (userRef.current===userId) {setCoinPackCatalog(catalog);setReadyUser(userId);setConfigurationFailed(false);}
    } catch { if(userRef.current===userId) setConfigurationFailed(true); }
  },[nativeSupported,isAuthReady,userId]);
  useEffect(()=>{void Promise.resolve().then(refreshOfferings);},[refreshOfferings]);

  const handlePurchase=useCallback(async(id:CoinPackProductId):Promise<CoinPackPurchaseResult>=>{
    if (!isReady || !userId || !supabase || busy.current) return {status:'error',message:''};
    const release = acquireAccountOperation('purchase');
    if (!release) return {status:'error',message:''};
    busy.current=true;
    let paymentSucceeded=false;
    try {
      const result=await withRevenueCatUser(userId,async()=>{
        // Recheck immediately before checkout. A cached ready flag on another
        // phone must not authorize a purchase after account deletion starts.
        const {data,error}=await supabase!.rpc('get_my_coin_wallet',{p_environment:getWalletEnvironment()});
        if(error || data?.user_id!==userId || userRef.current!==userId) throw new Error('Wallet unavailable');
        return await purchaseCoinPack(id);
      });
      if (result.status!=='purchased') return result;
      paymentSucceeded=true;
      await Promise.resolve(supabase.rpc('request_my_purchase_reconciliation',{p_environment:getWalletEnvironment()})).catch(()=>undefined);
      // The SDK receipt is never a client coin grant. Wait for the authenticated
      // webhook to credit the original transaction, then fetch the server wallet.
      for(let attempt=0;attempt<12;attempt++) {
        if(userRef.current!==userId) return {status:'delivery_pending'};
        const {data,error}=await supabase.rpc('has_my_coin_purchase',{
          p_environment:getWalletEnvironment(),p_transaction_id:result.transactionId,
        });
        if(!error && data===true) {
          await refreshWallet();
          if(userRef.current!==userId) return {status:'delivery_pending'};
          setCoinCelebration(current=>({userId,coins:(current?.userId===userId ? current.coins : 0)+result.coins}));
          return result;
        }
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
      return {status:'delivery_pending'};
    } catch { return paymentSucceeded ? {status:'delivery_pending'} : {status:'error',message:''}; }
    finally {busy.current=false;release();}
  },[isReady,userId,refreshWallet]);
  const restorePurchases=useCallback(async()=>{
    if(!isSupported || !isAuthReady || !userId || !supabase || busy.current) throw new Error('Wallet unavailable');
    const release = acquireAccountOperation('purchase');
    if (!release) throw new Error('Account operation in progress');
    busy.current=true;
    try {
      const before=await supabase.rpc('get_my_coin_wallet',{p_environment:getWalletEnvironment()});
      if(before.error) throw before.error;
      await withRevenueCatUser(userId,restoreRevenueCatPurchases);
      if(userRef.current!==userId) throw new Error('Account changed');
      const queued=await Promise.resolve(supabase.rpc('request_my_purchase_reconciliation',{p_environment:getWalletEnvironment()})).catch(()=>({error:true}));
      const after=await supabase.rpc('get_my_coin_wallet',{p_environment:getWalletEnvironment()});
      if(after.error) throw after.error;
      if(userRef.current!==userId) throw new Error('Account changed');
      await refreshWallet();
      return {coins:Math.max(0,Number(after.data.balance)-Number(before.data.balance)),recoveryQueued:!queued.error};
    } finally {busy.current=false;release();}
  },[isSupported,isAuthReady,userId,refreshWallet]);
  const value=useMemo(()=>({isReady,isSupported,requiresAccountLink,coinPackCatalog,purchaseCoinPack:handlePurchase,restorePurchases,refreshOfferings,pendingCoinCelebration,clearCoinCelebration}),
    [isReady,isSupported,requiresAccountLink,coinPackCatalog,handlePurchase,restorePurchases,refreshOfferings,pendingCoinCelebration,clearCoinCelebration]);
  return <IAPContext.Provider value={value}>{children}</IAPContext.Provider>;
}
export function useIAP():IAPContextValue {
  const context=useContext(IAPContext);
  if(!context) throw new Error('useIAP must be used within IAPProvider');
  return context;
}
