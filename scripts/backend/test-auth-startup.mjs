import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const settle = () => new Promise(resolve => setImmediate(resolve));
function harness({ configured = true, receipt = null, session = null } = {}) {
  const effects = [], slots = [], timers = new Map();
  let cursor = 0, mounted = false, online = false, reconnect, listener, blocked = false, busy = false;
  let attempts = 0, sessionGate = null, removed = false;
  const appState = { currentState: 'active' };
  const user = { id: 'new-guest' };
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => { if (!mounted) effects.push(fn); },
  };
  const mocks = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { AppState: appState },
    '@/hooks/use-network-reconnect': { subscribeToNetworkReconnect: fn => { reconnect = fn; return () => { removed = true; }; } },
    '@/constants/platform-auth': { getPlatformRestoreProvider: () => null, getPlatformRestoreProviderLabel: () => null },
    '@/lib/auth-session-backup': { loadBackedUpSession: async () => null, saveBackedUpSession: async () => {}, clearBackedUpSession: async () => {} },
    '@/lib/supabase': { isSupabaseConfigured: () => configured, supabase: { auth: {
      onAuthStateChange: fn => { listener = fn; return { data: { subscription: { unsubscribe() {} } } }; },
      getSession: async () => { if (sessionGate) await sessionGate; return { data: { session } }; },
      getUser: async () => ({ data: { user: session?.user ?? null } }),
      signInAnonymously: async () => {
        attempts++;
        if (!online) return { data: {}, error: new Error('offline') };
        session = { user }; listener('SIGNED_IN', session); return { data: { user, session } };
      },
    } } },
    '@/services/cloud-save/deletion-receipt': { loadDeletionReceipt: async () => receipt },
    '@/services/auth/platform-account': { hasPlatformAccountLinked: () => false, getLinkedPlatformProvider: () => null },
    '@/services/auth/protect-progress': {},
    '@/services/auth/account-operation': { acquireAccountOperation: () => {
      if (busy || blocked) return null;
      busy = true; return () => { busy = false; };
    } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('contexts/AuthProvider.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require: id => { assert.ok(id in mocks, id); return mocks[id]; },
    __DEV__: false, console,
    setInterval: (fn, delay) => { timers.set(delay, fn); return delay; }, clearInterval: id => timers.delete(id),
  });
  const render = () => { cursor = 0; const tree = module.exports.AuthProvider({ children: null }); mounted = true; return tree.props.value; };
  render();
  const cleanups = effects.map(fn => fn());
  return {
    get value() { return render(); }, get attempts() { return attempts; }, get removed() { return removed; },
    online() { online = true; }, reconnect() { reconnect?.(); },
    tick() { for (const fn of timers.values()) fn(); },
    background(value) { appState.currentState = value ? 'background' : 'active'; },
    block(value) { blocked = value; }, setSession(value) { session = value; },
    pauseSession() { let release; sessionGate = new Promise(resolve => { release = resolve; }); return release; },
    cleanup() { cleanups.forEach(fn => fn?.()); },
  };
}

test('first-launch sign-in recovers on reconnect without restarting or creating duplicate guests', async () => {
  const h = harness(); await settle();
  assert.equal(h.attempts, 1); assert.equal(h.value.userId, null);
  h.online(); h.reconnect(); h.reconnect(); h.tick(); await settle();
  assert.equal(h.attempts, 2); assert.equal(h.value.userId, 'new-guest'); assert.equal(h.value.isAuthReady, true);
  h.reconnect(); h.tick(); await settle(); assert.equal(h.attempts, 2);
  h.cleanup(); assert.equal(h.removed, true);
});

test('the foreground timer retries sign-in when no network event arrives', async () => {
  const h = harness(); await settle(); h.online(); h.background(true); h.tick(); await settle();
  assert.equal(h.attempts, 1);
  h.background(false); h.tick(); await settle();
  assert.equal(h.attempts, 2); assert.equal(h.value.userId, 'new-guest'); h.cleanup();
});

test('retries preserve an existing session and never create a guest for a deleting account', async () => {
  for (const options of [{ session: { user: { id: 'existing' } } }, { receipt: { requestId: 'deleting' } }, { configured: false }]) {
    const h = harness(options); h.online(); await settle(); h.reconnect(); h.tick(); await settle();
    assert.equal(h.attempts, 0); assert.equal(h.value.isAuthReady, true); h.cleanup();
  }
});

test('an auth or purchase operation blocks retries, and unmount cancels a pending retry', async () => {
  const h = harness(); await settle(); h.online(); h.block(true); h.reconnect(); h.tick(); await settle();
  assert.equal(h.attempts, 1);
  h.block(false); const release = h.pauseSession(); h.reconnect(); await settle(); h.cleanup(); release(); await settle();
  assert.equal(h.attempts, 1, 'Do not start sign-in after the provider unmounts');
  h.tick(); h.reconnect(); await settle(); assert.equal(h.attempts, 1);
});
