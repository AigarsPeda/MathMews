import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveSupabaseConfig } from '@/lib/supabase';

// Account deletion covers both environments. This receipt must survive local
// game resets and lets the phone confirm completion after Auth is removed.
const KEY='@mathmews/account-deletion';
export type DeletionReceipt={id: string; userId: string; confirmationKey: string};
export async function loadDeletionReceipt(): Promise<DeletionReceipt | null> {
 const raw=await AsyncStorage.getItem(KEY);
 if(!raw)return null;
 const value=JSON.parse(raw);
 return typeof value.id==='string' && typeof value.userId==='string' && typeof value.confirmationKey==='string' ? value : null;
}
export async function saveDeletionReceipt(value: DeletionReceipt) { await AsyncStorage.setItem(KEY,JSON.stringify(value)); }
export async function clearDeletionReceipt() { await AsyncStorage.removeItem(KEY); }
export async function checkDeletionReceipt(receipt: DeletionReceipt): Promise<'pending'|'completed'> {
 const {url,anonKey}=resolveSupabaseConfig();
 // Deliberately independent of the removed account's expired/invalid session.
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 try {
  const response=await fetch(`${url}/rest/v1/rpc/check_account_deletion`,{
   method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},
   body:JSON.stringify({p_user_id:receipt.userId,p_confirmation_key:receipt.confirmationKey}),signal:controller.signal,
  });
  if(!response.ok)throw new Error('Deletion status unavailable');
  const state=await response.json();
  if(state!=='pending' && state!=='completed')throw new Error('Deletion receipt unavailable');
  return state;
 } finally { clearTimeout(timeout); }
}
