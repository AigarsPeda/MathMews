import { supabase } from '@/lib/supabase';
import { acceptStoreCatalog } from '@/utils/store-catalog';

let pending: Promise<boolean> | undefined;
export function refreshStoreCatalog(): Promise<boolean> {
  if (pending) return pending;
  pending = (async () => {
    if (!supabase) return false;
    try {
      const { data, error } = await supabase.rpc('get_store_catalog');
      if (error) return false;
      acceptStoreCatalog(data);
      return true;
    } catch { return false; }
  })().finally(() => { pending = undefined; });
  return pending;
}
