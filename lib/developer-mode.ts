import { useSyncExternalStore } from 'react';
import { DEVELOPER_TESTS } from '@/constants/developer-tests';

// Deliberately session-only: a fresh launch always returns to the normal game.
let selected: string | null = null;
const listeners = new Set<() => void>();
export function setDeveloperMode(id: string | null) {
  const next = __DEV__ && DEVELOPER_TESTS.some(test => test.id === id) ? id : null;
  if (selected === next) return;
  selected = next;
  listeners.forEach(listener => listener());
}
export const getDeveloperMode = () => __DEV__ ? selected : null;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useDeveloperMode() {
  return useSyncExternalStore(subscribe, getDeveloperMode, () => null);
}
