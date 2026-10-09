import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { reportAppError } from '@/lib/app-diagnostics';

// The old flag also persisted automatic crash recovery. Only explicit choices
// belong in this preference; older fallback flags must not disable 3D at launch.
const KEY = '@mathmews/graphics-mode';
type Mode = 'loading' | '3d' | 'simple';
let mode: Mode = 'loading';
let revision = 0;
let writes = Promise.resolve();
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
const startedAt = revision;
export const graphicsModeReady = AsyncStorage.getItem(KEY).then(value => {
  if (revision === startedAt) mode = value === 'simple' ? 'simple' : '3d';
}).catch(error => {
  reportAppError('graphics-preference', error);
  if (revision === startedAt) mode = '3d';
}).finally(publish);
export const getGraphicsMode = () => mode;
export function enableSimpleGraphicsForSession(): void {
  revision++;
  mode = 'simple';
  publish();
}
export function setSimpleGraphics(enabled: boolean): void {
  revision++;
  mode = enabled ? 'simple' : '3d';
  publish();
  writes = writes.then(() => AsyncStorage.setItem(KEY, enabled ? 'simple' : '3d')).catch(error => reportAppError('graphics-preference', error));
}
export function useGraphicsMode(): Mode {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getGraphicsMode, getGraphicsMode);
}
