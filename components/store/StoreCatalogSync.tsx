import { useEffect } from 'react';
import { AppState } from 'react-native';
import { refreshStoreCatalog } from '@/services/store-catalog';
import { invalidateStoreCatalog, nextStoreCatalogTransition, subscribeStoreCatalog } from '@/utils/store-catalog';

/** One app-wide reader; scheduled sales also change while the shop stays open. */
export function StoreCatalogSync() {
  useEffect(() => {
    let boundary: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(boundary);
      const delay = nextStoreCatalogTransition() - Date.now();
      if (Number.isFinite(delay)) boundary = setTimeout(() => {
        invalidateStoreCatalog();
        if (AppState.currentState === 'active') void refreshStoreCatalog();
      }, Math.max(1, Math.min(delay + 30, 2147483647)));
    };
    const unsubscribe = subscribeStoreCatalog(schedule);
    void refreshStoreCatalog();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refreshStoreCatalog(); }, 30000);
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') { invalidateStoreCatalog(); void refreshStoreCatalog(); }
    });
    schedule();
    return () => { clearInterval(timer); clearTimeout(boundary); unsubscribe(); foreground.remove(); };
  }, []);
  return null;
}
