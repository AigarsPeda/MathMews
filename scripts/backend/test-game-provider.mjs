import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React, { act } from 'react';
import Reconciler from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants.js';

// Exercise real React context propagation without a device or DOM. The app
// already installs this reconciler through Skia; probes render no host views.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const hostContext = {};
const renderer = Reconciler({
  isPrimaryRenderer: true, supportsMutation: true,
  getRootHostContext: () => hostContext, getChildHostContext: () => hostContext,
  prepareForCommit: () => null, resetAfterCommit() {}, clearContainer() {},
  getCurrentUpdatePriority: () => DefaultEventPriority, setCurrentUpdatePriority() {},
  resolveUpdatePriority: () => DefaultEventPriority, maySuspendCommit: () => false,
  scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
  supportsMicrotasks: true, scheduleMicrotask: queueMicrotask,
});

async function harness() {
  const cache = new Map(), stored = new Map(), timers = new Map();
  let writes = 0, cloud, server, value, actions, stateRenders = 0, actionRenders = 0;
  let auth = { isAuthReady: true, userId: 'a' };
  const walletAPI = { spend: async () => 'purchased', refresh: async () => {}, isReady: true };
  const storage = {
    getItem: async key => stored.get(key) ?? null,
    setItem: async (key, value) => { stored.set(key, value); },
    removeItem: async key => { stored.delete(key); },
    multiSet: async pairs => { writes++; pairs.forEach(([key, value]) => stored.set(key, value)); },
    multiRemove: async keys => keys.forEach(key => stored.delete(key)),
  };
  const mocks = {
    react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      Dimensions: { get: () => ({ width: 390, height: 844 }) }, PixelRatio: { roundToNearestPixel: n => n } },
    '@react-native-async-storage/async-storage': storage,
    '@/contexts/AuthProvider': { useAuth: () => auth },
    '@/hooks/use-cloud-save-sync': { useCloudSaveSync: options => { cloud = options; } },
    '@/hooks/use-server-wallet': { useServerWallet: options => { server = options; return walletAPI; } },
    '@/services/cloud-save/cloud-save': { pullRemoteSave: async () => null, pushRemoteSave: async () => true, listRemoteSaveSnapshots: async () => [] },
    '@/services/cloud-save/delete-user-data': {},
    '@/services/cloud-save/deletion-receipt': { loadDeletionReceipt: async () => null },
    '@/lib/auth-session-backup': {}, '@/lib/supabase': { supabase: null },
    '@/hooks/use-world-clock-now': { useWorldClockNow: () => Date.now() },
    '@/lib/app-diagnostics': { reportAppError() {} },
  };
  function load(id, base = process.cwd()) {
    if (id in mocks) return mocks[id];
    let file = id.startsWith('@/') ? path.resolve(id.slice(2)) : path.resolve(base, id);
    if (/\.(png|webp|mp4|glb)$/.test(file)) return file;
    if (!fs.existsSync(file)) file = ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
    assert.ok(file, `Resolve ${id}`);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    if (file.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(file, 'utf8')); return module.exports; }
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, { module, exports: module.exports, require: child => load(child, path.dirname(file)),
      Date, Math, Map, Set, Promise, console, __DEV__: false, process: { env: { EXPO_PUBLIC_APP_ENVIRONMENT: 'sandbox' } },
      setTimeout: (fn, delay) => { timers.set(delay, fn); return delay; }, clearTimeout: id => timers.delete(id),
      setInterval: (fn, delay) => { timers.set(delay, fn); return delay; }, clearInterval: id => timers.delete(id),
    });
    return module.exports;
  }
  const initial = { ...load('@/utils/game-storage').createDefaultGameSave(), accountOwnerId: 'a', hasCompletedOnboarding: true,
    wallet: { coins: 100 }, walletAuthority: { user_id: 'a', environment: 'sandbox', balance: 100, revision: 1 } };
  stored.set(load('@/types/save').GAME_SAVE_STORAGE_KEY, JSON.stringify(initial));
  const api = load('@/contexts/GameProvider');
  function StateProbe() { value = api.useGame(); stateRenders++; return null; }
  function ActionProbe() { actions = (api.useGameActions ?? api.useGame)(); actionRenders++; return null; }
  const children = React.createElement(React.Fragment, null, React.createElement(StateProbe), React.createElement(ActionProbe));
  const errors = [], onError = error => errors.push(error);
  const root = renderer.createContainer({}, 1, null, false, null, '', onError, onError, onError, null);
  const render = async () => { await act(async () => { renderer.updateContainer(React.createElement(api.GameProvider, null, children), root, null, null); }); if (errors.length) throw errors[0]; };
  await render();
  return {
    get value() { return value; }, get actions() { return actions; }, get save() { return cloud.getSave(); },
    get counts() { return { stateRenders, actionRenders, writes }; },
    async update(fn) { await act(async () => { fn(); }); if (errors.length) throw errors[0]; },
    setSave(next) { cloud.setSave(next); }, setAuthority(next) { server.authorityRef.current = next; },
    async switchAccount(userId) { auth = { ...auth, userId }; await render(); },
    async close() { await act(async () => { renderer.updateContainer(null, root, null, null); }); },
  };
}

test('no-op game actions retain the save and do not render or persist', async () => {
  const h = await harness();
  try {
    const save = h.save, value = h.value, counts = h.counts;
    await h.update(() => {
      h.actions.setPet(pet => pet);
      h.actions.setProgress(progress => progress);
      h.actions.expireChallenge('not-running');
      h.actions.dismissWalletNotice('missing');
      h.setSave(current => ({ ...current, pet: { ...current.pet }, progress: { ...current.progress }, wallet: { ...current.wallet } }));
    });
    assert.equal(h.save, save); assert.equal(h.value, value); assert.deepEqual(h.counts, counts);
  } finally { await h.close(); }
});

test('pet and progress edits preserve other branches and do not rerender action consumers', async () => {
  const h = await harness();
  try {
    const before = h.save, value = h.value, actions = h.actions, counts = h.counts;
    await h.update(() => h.actions.setPet(pet => ({ ...pet, name: 'New name' })));
    assert.equal(h.save.pet.name, 'New name'); assert.notEqual(h.save.pet, before.pet);
    assert.equal(h.save.progress, before.progress); assert.equal(h.save.wallet, before.wallet);
    assert.equal(h.save.worldClock, before.worldClock); assert.equal(h.save.pet.stats, before.pet.stats);
    assert.equal(h.value.wallet, value.wallet); assert.equal(h.value.coinTransactions, value.coinTransactions);
    assert.equal(h.value.walletNotices, value.walletNotices); assert.equal(h.value.creditedPurchaseIds, value.creditedPurchaseIds);
    assert.equal(h.actions, actions); assert.equal(h.counts.actionRenders, counts.actionRenders);
    assert.equal(h.counts.stateRenders, counts.stateRenders + 1); assert.equal(h.counts.writes, counts.writes + 1);
    const pet = h.save.pet;
    await h.update(() => h.actions.recordLearningHelp('test-help'));
    assert.equal(h.save.pet, pet); assert.equal(h.actions, actions);
    const after = h.counts;
    await h.update(() => h.actions.recordLearningHelp('test-help'));
    assert.deepEqual(h.counts, after, 'Repeated help already recorded is a no-op');
  } finally { await h.close(); }
});

test('no-op updates still apply new wallet authority and preserve authority references when equivalent', async () => {
  const h = await harness();
  try {
    const before = h.save;
    await h.update(() => {
      h.setAuthority({ user_id: 'a', environment: 'sandbox', balance: 175, revision: 2 });
      h.setSave(current => current);
    });
    assert.equal(h.save.wallet.coins, 175); assert.equal(h.value.wallet.coins, 175);
    assert.equal(h.save.pet, before.pet); assert.equal(h.save.progress, before.progress);
    const save = h.save, counts = h.counts;
    await h.update(() => { h.setAuthority({ ...save.walletAuthority }); h.setSave(current => current); });
    assert.equal(h.save, save); assert.deepEqual(h.counts, counts);
  } finally { await h.close(); }
});

test('nested stat and life copies retain references, but real changes persist', async () => {
  const h = await harness();
  try {
    const before = h.save, counts = h.counts;
    await h.update(() => {
      h.actions.setPet(pet => ({ ...pet, stats: { ...pet.stats } }));
      h.actions.setProgress(progress => ({ ...progress, lives: { ...progress.lives } }));
    });
    assert.equal(h.save, before); assert.deepEqual(h.counts, counts);
    await h.update(() => h.actions.setProgress(progress => ({ ...progress, lives: { ...progress.lives, current: 1 } })));
    assert.equal(h.save.progress.lives.current, 1); assert.notEqual(h.save.progress, before.progress);
    assert.equal(h.save.pet, before.pet); assert.equal(h.save.wallet, before.wallet);
  } finally { await h.close(); }
});

test('account changes still mask the prior wallet and refresh account-bound actions', async () => {
  const h = await harness();
  try {
    const actions = h.actions;
    await h.switchAccount('b');
    assert.equal(h.value.wallet.coins, 0); assert.equal(h.value.isReady, false); assert.notEqual(h.actions, actions);
    await h.update(() => h.setSave(current => current));
    assert.equal(h.save.wallet.coins, 0); assert.equal(h.save.walletAuthority, undefined);
    assert.equal(h.save.accountOwnerId, 'a', 'Keep the owner so account preparation can archive it');
  } finally { await h.close(); }
});

test('internal save metadata persists without notifying unchanged game consumers', async () => {
  const h = await harness();
  try {
    const value = h.value, actions = h.actions, counts = h.counts;
    await h.update(() => h.setSave(current => ({ ...current, appliedWalletOrderIds: ['confirmed-receipt'] })));
    assert.equal(h.value, value); assert.equal(h.actions, actions);
    assert.equal(h.counts.stateRenders, counts.stateRenders); assert.equal(h.counts.actionRenders, counts.actionRenders);
    assert.equal(h.counts.writes, counts.writes + 1);
  } finally { await h.close(); }
});

test('queued rewards update the projected wallet without changing pet or progress references', async () => {
  const h = await harness();
  try {
    const before = h.save;
    await h.update(() => h.setSave(current => ({ ...current, pendingCoinRewards: [
      { userId: 'a', environment: 'sandbox', puzzleId: 'test-puzzle', attemptId: 'test-attempt', amount: 12 },
    ] })));
    assert.equal(h.value.wallet.coins, 112); assert.equal(h.save.wallet.coins, 112);
    assert.equal(h.save.pet, before.pet); assert.equal(h.save.progress, before.progress);
    await h.update(() => h.setSave(current => ({ ...current, pendingCoinRewards: [] })));
    assert.equal(h.value.wallet.coins, 100);
  } finally { await h.close(); }
});
