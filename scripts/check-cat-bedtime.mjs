/* eslint-disable react-hooks/rules-of-hooks -- This unit dispatcher runs hooks without a native renderer. */
/** Nightly requests use the game clock and never repeat over manual commands. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map(), slots = [];
let index = 0, effects = [], now = 1_800_000_000_000;
const react = {
  useRef: value => slots[index++] ??= { current: value },
  useEffect: (fn, deps) => {
    const i = index++, old = slots[i];
    if (!old || deps.some((value, j) => value !== old[j])) effects.push(fn);
    slots[i] = deps;
  },
};
function load(id) {
  if (id === 'react') return react;
  if (id === '@/hooks/use-world-clock-now') return { useWorldClockNow: () => now };
  const file = path.resolve(id.startsWith('@/') ? id.slice(2) : id);
  const resolved = fs.existsSync(file) ? file : ['.ts', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: load, Date, Set, Map });
  return module.exports;
}
const { bedroomSleepTarget, useCatBedtime } = load('@/hooks/use-cat-bedtime');
const { sendCatToRoom } = load('@/utils/home-rooms');
const bedroom = { bedId: 'houseA', placedDecorations: [] };
const pet = { type: 'cat', homeRoomId: 'livingRoom', catHomeRoomId: 'kitchen', homeRooms: { bedroom } };
assert.equal(bedroomSleepTarget(pet), 'bed');
assert.equal(bedroomSleepTarget({ ...pet, homeRooms: { bedroom: { bedId: 'brown' } } }), undefined);
assert.equal(bedroomSleepTarget({ ...pet, homeRooms: undefined, bedId: 'houseA' }), undefined, 'A living-room bed is not a bedroom bed');
for (const id of ['bedroomDoubleBed', 'bedroomBedRose', 'bedroomBedLilac']) {
  assert.equal(bedroomSleepTarget({ ...pet, homeRooms: { bedroom: { placedDecorations: [{ decorationId: id, instanceId: id }] } } }), id);
  assert.equal(bedroomSleepTarget({ ...pet, homeRoomId: 'bedroom', placedDecorations: [{ decorationId: id, instanceId: 'current-bedroom' }] }), 'current-bedroom', 'Current bedroom edits take priority over a stale saved layout');
}
const arrivals = [], mornings = [];
let options = { pet, clock: { worldMs: 20 * 3600000, realMs: now, speed: 1 }, enabled: true, busy: false, hasCommand: false,
  onBedtime: id => arrivals.push(id), onMorning: () => mornings.push(now) };
const render = () => { index = 0; effects = []; useCatBedtime(options); effects.forEach(fn => fn()); };
function time(hour, day = 0) { options = { ...options, clock: { ...options.clock, worldMs: (day*24+hour)*3600000, realMs: now } }; render(); }
render(); assert.equal(arrivals.length, 0);
time(21); assert.deepEqual(arrivals, ['bed']);
now += 10_000; render(); assert.equal(arrivals.length, 1, 'Polling does not force an interrupted cat back into bed');
time(0,1); assert.equal(arrivals.length, 1, 'Midnight belongs to the same night');
time(5.99,1); assert.equal(arrivals.length, 1);
const beforeMorning = mornings.length; time(6,1); assert.equal(mornings.length, beforeMorning+1);
options = { ...options, busy: true }; time(21,1); assert.equal(arrivals.length, 1, 'Care and decorating defer bedtime');
options = { ...options, busy: false, hasCommand: true }; render(); assert.equal(arrivals.length, 1, 'Pending manual commands take priority');
options = { ...options, hasCommand: false }; render(); assert.equal(arrivals.length, 2);
options = { ...options, enabled: false }; time(6,2); time(22,2); assert.equal(arrivals.length, 2, 'Covered home screens do not issue new journeys');
options = { ...options, enabled: true }; render(); assert.equal(arrivals.length, 3, 'Returning at night restores the routine');
options = { ...options, pet: { ...pet, homeRooms: {} } }; time(21,3); assert.equal(arrivals.length, 3, 'Missing beds do not cause invented sleep or purchases');
options = { ...options, pet }; render(); assert.equal(arrivals.length, 4, 'A bed added during the night becomes usable');
const moved = sendCatToRoom(pet, 'bedroom', false);
assert.equal(moved.homeRoomId, 'livingRoom'); assert.equal(moved.catHomeRoomId, 'bedroom');
assert.equal(moved.homeRooms, pet.homeRooms, 'Automatic travel keeps the current view and saved furnishings');
console.log('Verified bedtime at 21:00, waking at 06:00, midnight continuity, one request per night, manual priority, care/edit deferral, missing/added beds, foreground resume and independent room browsing.');
