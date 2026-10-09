import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@mathmews/diagnostics';
const LIMIT = 30;
export type AppDiagnostic = { at: string; scope: string; message: string; stack: string; fatal: boolean };
let entries: AppDiagnostic[] = [];
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => { try { listener(); } catch { /* Diagnostics must not cause another failure. */ } });
export const getAppDiagnostics = () => entries;
export function subscribeAppDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function clean(value: unknown, limit: number): string {
  // Reports stay local. Remove URL query strings and common credential fields.
  return String(value ?? '').replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1')
    .replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, '$1 [redacted]')
    .replace(/(authorization|access_token|refresh_token|password|apikey)([=: ]+)[^\s,;]+/gi, '$1$2[redacted]').slice(0, limit);
}
export const diagnosticsReady = AsyncStorage.getItem(STORAGE_KEY).then(raw => {
  let saved: unknown;
  try { saved = raw ? JSON.parse(raw) : []; } catch { saved = []; }
  if (Array.isArray(saved)) {
    const valid = saved.filter((entry): entry is AppDiagnostic => entry && typeof entry.at === 'string'
      && typeof entry.scope === 'string' && typeof entry.message === 'string' && typeof entry.stack === 'string' && typeof entry.fatal === 'boolean');
    entries = [...valid.slice(-LIMIT), ...entries].slice(-LIMIT);
    publish();
  }
}).catch(() => {});

/** Bounded diagnostics never contain the game save and never upload automatically. */
export function reportAppError(scope: string, error: unknown, fatal = false): void {
  const detail = error && typeof error === 'object' ? error as { message?: unknown; stack?: unknown } : undefined;
  const entry: AppDiagnostic = { at: new Date().toISOString(), scope: clean(scope, 100),
    message: clean(detail?.message ?? error, 1500), stack: clean(detail?.stack, 4000), fatal };
  const last = entries.at(-1);
  if (last?.scope === entry.scope && last.message === entry.message && Date.parse(entry.at) - Date.parse(last.at) < 5000) return;
  entries = [...entries, entry].slice(-LIMIT);
  publish();
  // Serial writes avoid losing a report when multiple scenes fail together.
  writes = writes.then(() => diagnosticsReady).then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries))).catch(() => {});
}
export function formatAppDiagnostics(): string {
  return entries.map(entry => `${entry.at} | ${entry.scope} | ${entry.fatal ? 'fatal' : 'caught'}\n${entry.message}\n${entry.stack}`).join('\n\n');
}
