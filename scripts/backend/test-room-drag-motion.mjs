import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function evaluate(input, mocks = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: id => mocks[id], Math });
  return module.exports;
}
const load = (file, mocks) => evaluate(fs.readFileSync(file, 'utf8'), mocks);
const worldSource = fs.readFileSync('utils/native-room-world.ts', 'utf8');
const span = Number(worldSource.match(/export const ROOM_SPAN = ([\d.]+)/)[1]);
const { roomDragDelta, roomDragPreview, roomDragAnchor, snapshotRoomDragObject } = load('utils/room-drag-motion.ts', { '@/utils/native-room-world': { ROOM_SPAN: span } });
const { sameRoomDragFeedback } = load('utils/room-drag-feedback.ts');
const object = { instanceId: 'table', modelId: 'table', position: [1, 2, 3], min: [0, 1, 2], max: [2, 3, 4], scale: 1, heading: .4 };
const base = { session: 4, version: 1, x: 10, y: 20, width: 390, anchor: { x: 20, y: 30 }, object };
const motion = { session: 4, sequence: 2, x: 30, y: 60, active: true, moved: true, measure: true, at: 123 };
// Use the application's projection, so a camera change catches inverse-math drift.
const worldFile = ts.createSourceFile('world.ts', worldSource, ts.ScriptTarget.Latest, true);
const projectionSource = worldFile.statements.filter(node =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'projectWorld'
  || ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration =>
    ['ROOM_SPAN', 'elevation', 'vertical', 'diagonal'].includes(declaration.name.getText(worldFile))))
  .map(node => node.getText(worldFile)).join('\n');
const { projectWorld } = evaluate(projectionSource);
const project = (point, width) => { const p = projectWorld(point, width); return [p.x, p.y]; };
test('recapturing a native preview detaches every nested reference before crossing runtimes', () => {
  const input = { ...object, bed: { surface: [1, 2, 3], covered: [2, 3, 4] },
    collisionBoxes: [{ min: [0, 1, 2], max: [3, 4, 5] }], editingChildren: [{ ...object, instanceId: 'child' }] };
  const copy = snapshotRoomDragObject(input);
  assert.equal(JSON.stringify(copy), JSON.stringify(input));
  function detached(a, b) {
    assert.notEqual(a, b);
    for (const key of Object.keys(a)) if (a[key] && typeof a[key] === 'object') detached(a[key], b[key]);
  }
  detached(input, copy);
});
test('native drag deltas preserve projected finger movement on floor and both walls', () => {
  for (const width of [250, 390, 800]) for (const wall of [undefined, 0, 2]) for (const [x, y] of [[-30, 40], [50, -20]]) {
    const delta = roomDragDelta(x, y, width, wall), origin = project([0, 0, 0], width), next = project(delta, width);
    assert.ok(Math.abs(next[0] - origin[0] - x) < 1e-8);
    assert.ok(Math.abs(next[1] - origin[1] - y) < 1e-8);
    assert.equal(delta[wall ?? 1], 0, 'The mounting plane stays fixed');
  }
});
test('native previews preserve groups, reject stale sessions and continue when returning across the threshold', () => {
  const child = { ...object, instanceId: 'lamp', position: [2, 3, 4] };
  const input = { ...base, object: { ...object, editingChildren: [child] } }, before = JSON.stringify(input);
  const result = roomDragPreview(input, motion);
  assert.equal(JSON.stringify(input), before, 'Drawing must not mutate saved/base geometry');
  assert.equal(result.editingChildren[0].position[0] - result.position[0], 1);
  assert.equal(result.heading, object.heading);
  assert.deepEqual(JSON.parse(JSON.stringify(result.dragSample)), { session: 4, sequence: 2, inputAt: 123, phase: 'move' });
  assert.equal(roomDragPreview(input, { ...motion, session: 3 }), undefined);
  assert.equal(roomDragPreview(input, { ...motion, active: false }), undefined);
  assert.equal(roomDragPreview(input, { ...motion, moved: false }), undefined);
  assert.ok(roomDragPreview(input, { ...motion, x: 1, y: 1 }));
  assert.equal(roomDragAnchor(base, motion, { x: 0, y: 0 }).x, 40);
});
test('React drag feedback ignores translation but detects changed validity, support, shape and blocking parts', () => {
  const feedback = { candidate: object, boundaries: [], blockers: [] };
  const translated = { ...feedback, candidate: { ...object, position: [4, 5, 6] } };
  assert.equal(sameRoomDragFeedback(feedback, translated), true);
  for (const change of [{ access: 'blocked' }, { snapped: true }, { unsupportedSurfaceId: 'shelf' }, { boundaries: ['frontEdge'] },
    { candidate: { ...object, scale: 2 } }, { candidate: { ...object, supportId: 'shelf' } }, { blockers: [{ instanceId: 'chair', boxes: [[[1, 2, 3]]] }] }]) {
    assert.equal(sameRoomDragFeedback(feedback, { ...translated, ...change }), false);
  }
  const blocked = { ...feedback, blockers: [{ instanceId: 'chair', boxes: [[[1, 2, 3]]] }] };
  assert.equal(sameRoomDragFeedback(blocked, { ...blocked, blockers: [{ instanceId: 'chair', boxes: [[[1, 2, 4]]] }] }), false);
});
