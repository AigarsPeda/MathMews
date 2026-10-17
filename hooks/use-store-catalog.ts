import { useSyncExternalStore } from 'react';
import { getStoreCatalogRevision, subscribeStoreCatalog } from '@/utils/store-catalog';

export function useStoreCatalog() {
  return useSyncExternalStore(subscribeStoreCatalog, getStoreCatalogRevision, getStoreCatalogRevision);
}
