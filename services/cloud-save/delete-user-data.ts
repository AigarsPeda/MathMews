import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { pauseAccountCloudWrites } from './cloud-save';
import { loadDeletionReceipt, saveDeletionReceipt, checkDeletionReceipt, clearDeletionReceipt } from './deletion-receipt';

export type DeleteAccountResult = { state: 'completed' } | { state: 'pending'; id: string } | { state: 'failed' };

export async function deleteRemoteUserData(userId: string | null): Promise<DeleteAccountResult> {
  const receipt=await loadDeletionReceipt();
  if(receipt) {
    let state: 'pending' | 'completed';
    try {
      state=await checkDeletionReceipt(receipt);
    } catch { return {state:'pending',id:receipt.id}; }
    if(state==='completed') {
      if(!userId || userId===receipt.userId)return {state:'completed'};
      // A restored, different account needs its own deletion request. Never
      // mistake another account's completed receipt for this one's deletion.
      await clearDeletionReceipt();
    } else if(userId!==receipt.userId)return {state:'pending',id:receipt.id};
  }
  if (!isSupabaseConfigured() || !supabase) {
    return { state: 'completed' };
  }
  if(!userId)return {state:'failed'};
  pauseAccountCloudWrites(userId, true);
  // Check a previous request before asking Apple to authenticate again. This
  // also recovers a lost success response while the existing JWT is valid.
  const { data: previous } = await supabase.rpc('get_my_account_deletion');
  if (previous?.state === 'completed') return { state: 'completed' };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) { pauseAccountCloudWrites(userId, false); return { state: 'failed' }; }
  let appleAuthorizationCode: string | undefined;
  const apple = user.identities?.some(identity => identity.provider === 'apple');
  if (apple && previous?.apple_required !== false) {
    if (Platform.OS !== 'ios') { pauseAccountCloudWrites(userId, false); return { state: 'failed' }; }
    try {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      if (!credential.authorizationCode) { pauseAccountCloudWrites(userId, false); return { state: 'failed' }; }
      appleAuthorizationCode = credential.authorizationCode;
    } catch { pauseAccountCloudWrites(userId, false); return { state: 'failed' }; }
  }
  // Persist the server-generated status receipt before allowing auth deletion.
  const {data: prepared,error: prepareError}=await supabase.rpc('begin_my_account_deletion');
  if(prepareError || !prepared?.confirmation_key){pauseAccountCloudWrites(userId,false);return {state:'failed'};}
  await saveDeletionReceipt({id:prepared.id,userId,confirmationKey:prepared.confirmation_key});
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { appleAuthorizationCode } });
  if (!error && data?.state === 'completed') return { state: 'completed' };
  if (!error && data?.state === 'pending' && typeof data.id === 'string') return { state: 'pending', id: data.id };
  // A timeout after acceptance must keep cloud uploads paused on this device.
  const { data: status } = await supabase.rpc('get_my_account_deletion');
  if (status?.state === 'completed') return { state: 'completed' };
  if (status?.state === 'pending') return { state: 'pending', id: status.id };
  pauseAccountCloudWrites(userId, false);
  return { state: 'failed' };
}
