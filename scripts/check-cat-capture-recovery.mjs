/** Execute the capture fixture's connection effect with a deterministic clock. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.createSourceFile('fixture.tsx', fs.readFileSync('scripts/native/cat-capture/fixture.tsx', 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
    && node.arguments[0]?.getText(source).includes('setHotLoadingEnabled')) effect = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(effect);
const code = ts.transpileModule(`const cleanup = (${effect.getText(source)})();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

for (const previousRefresh of [false, true]) for (const failure of ['rejected', 'hung']) {
  let now = 0, timerId = 0, respond, cleanup;
  const timers = new Map(), refresh = [], routes = [];
  const context = {
    Date: { now: () => now }, PREVIOUS_FAST_REFRESH: previousRefresh,
    TurboModuleRegistry: { getEnforcing: () => ({ setHotLoadingEnabled: value => refresh.push(value) }) },
    router: { replace: route => routes.push(route) },
    setInterval: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearInterval: id => timers.delete(id),
    fetch: () => new Promise((resolve, reject) => { respond = failure === 'hung' ? resolve : reject; }),
    interactive: false, emit() {}, run: 'test', coat: 'orange', period: 'day', zoom: 1, mode: 'room',
    WIDTH: 390, HEIGHT: 500, TOP: 130, PixelRatio: { get: () => 3 }, world: {},
    endpoint: 'http://127.0.0.1:1234', events: { current: [] },
  };
  const sandbox = vm.createContext(context);
  vm.runInContext(code, sandbox);
  cleanup = vm.runInContext('cleanup', sandbox);
  assert.deepEqual(refresh, [false]);
  const watchdog = [...timers.values()].find(timer => timer.ms === 1000).fn;
  now = 9999; watchdog(); assert.deepEqual(routes, []);
  if (failure === 'rejected') { respond(new Error('Driver stopped')); await Promise.resolve(); }
  now = 10001; watchdog(); watchdog();
  assert.deepEqual(routes, ['/'], 'Lost or hung drivers leave Capture QA exactly once');
  cleanup();
  assert.equal(timers.size, 0, 'Unmount removes polling and recovery timers');
  assert.deepEqual(refresh, [false, previousRefresh], 'Unmount restores the prior Fast Refresh setting');
  if (failure === 'hung') {
    respond({ ok: true, json: async () => ({ command: { id: 1, kind: 'stop' } }) });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(routes, ['/'], 'Late responses cannot revive the capture screen');
  }
}
console.log('Capture QA exits after a lost or hung driver and restores Fast Refresh and timers.');
