/** Exercise the real notice and its decoration handoff without native handles. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const stage = ts.createSourceFile('PetStage.tsx', fs.readFileSync('components/pet/PetStage.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const home = ts.createSourceFile('index.tsx', fs.readFileSync('app/index.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name, context, source = stage) {
  let declaration;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(declaration, name);
  const node = declaration.initializer;
  return vm.runInNewContext(compile(`(${(ts.isCallExpression(node) ? node.arguments[0] : node).getText(source)})`), context);
}
const flatten = node => !node?.props ? [] : [node, ...[node.props.children].flat(Infinity).flatMap(flatten)];
const text = tree => flatten(tree).filter(node => node.type === 'Text').map(node => [node.props.children].flat().join(''));
for (const locale of ['en', 'lv']) {
  const strings = JSON.parse(fs.readFileSync(`locales/${locale}.json`, 'utf8'));
  const t = (key, values = {}) => {
    const template = key.split('.').reduce((value, field) => value?.[field], strings);
    assert.equal(typeof template, 'string', key);
    return template.replace(/{{(\w+)}}/g, (_, field) => values[field]);
  };
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(compile(fs.readFileSync('components/pet/RoomActivityNotice.tsx', 'utf8')), {
    module, exports: module.exports, require: id => ({
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-i18next': { useTranslation: () => ({ t }) },
      'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: value => value } },
      '@/components/ui/AppIcon': { AppIcon: 'AppIcon' },
      '@/constants/game': { GameColors: { card: '#fff', text: '#2D3436', textMuted: '#636E72', secondaryDark: '#087F79' } },
      '@/utils/scale': { moderateScale: value => value },
    })[id],
  });
  for (const target of [undefined, 'Padded kitchen chair', 'A very long furniture name '.repeat(6)]) {
    let moved = 0, dismissed = 0;
    const tree = module.exports.RoomActivityNotice({ name: 'Milo', target, onMove: () => moved++, onDismiss: () => dismissed++ });
    const nodes = flatten(tree), alert = nodes.find(node => node.props.accessibilityRole === 'alert');
    assert.ok(alert.props.children.includes('Milo'));
    if (target) assert.ok(alert.props.children.includes(target));
    assert.equal(alert.props.numberOfLines, undefined, 'Item names wrap rather than hiding the explanation');
    assert.ok(text(tree).includes(strings.home.catPathBlockedHint), 'The notice explains how to recover');
    const buttons = nodes.filter(node => node.props.accessibilityRole === 'button');
    assert.equal(buttons.length, 2);
    buttons.forEach(button => { assert.ok(button.props.style({ pressed: false })[0].minHeight >= 44); button.props.onPress(); });
    assert.equal(moved, 1); assert.equal(dismissed, 1);
  }
}

// A failed idle step may still be on screen when Move furniture is pressed.
// Run the stage's actual callbacks and wait for the scheduler's safe exit.
for (const running of [false, true]) for (const target of [undefined, { kind: 'decoration', decorationId: 'kitchenChairUpholstered', instanceId: 'selected-chair' }]) {
  const context = {
    blockedItem: target, roomActivity: running ? {} : null,
    cleared: 0, stopped: 0, waiting: false, selected: undefined, decorating: false,
    clearBlockedActivity() { context.cleared++; },
    setSelectedMoveItem(item) { context.selected = item; },
    setShowEditor() {}, setPlacementFeedback() {}, setRotationPreview() {}, setSpotlightPreview() {},
    setWaitingToDecorate(value) { context.waiting = value; },
    setDecorating(value) { context.decorating = value; },
    stopActivity() { context.stopped++; },
  };
  callback('moveBlockedFurniture', context)();
  assert.equal(context.cleared, 1);
  assert.equal(context.selected, target ?? null, 'Decorating selects the exact unreachable item, when it still exists');
  assert.equal(context.stopped, running ? 1 : 0);
  assert.equal(context.decorating, !running, 'A running cat reaches a safe stopped pose before furniture editing');
  if (running) callback('handleReadyToDecorate', context)();
  assert.equal(context.decorating, true);
  assert.equal(context.waiting, false);
}
console.log('Verified English/Latvian failure notices, long names, accessible actions, dismissal and safe decoration handoff with the selected item.');

{
  const context = { roomFailure: null, pending: { roomId: 'bedroom' }, viewed: 'bedroom', moved: 0, dismissed: 0,
    setRoomFailure(notice) { context.roomFailure = notice; },
    setRequestedRoomCommand(value) { context.pending = value; },
    visitHomeRoom(roomId) { context.viewed = roomId; },
  };
  const notice = { roomId: 'kitchen', onMove() { context.moved++; }, onDismiss() { context.dismissed++; } };
  callback('handleRoomActivityFailure', context, home)(notice);
  assert.equal(context.roomFailure, notice, 'An offscreen blocked departure is reported to Home');
  assert.equal(context.pending, null, 'The failed cross-room request cannot retry on a later render');
  assert.equal(context.viewed, 'bedroom', 'Reporting a failure does not unexpectedly change rooms');
  callback('moveUnreachableFurniture', context, home)();
  assert.equal(context.viewed, 'kitchen', 'Recovery opens the actual blocked room, rather than the requested destination');
  assert.equal(context.moved, 1); assert.equal(context.roomFailure, null);
  callback('handleRoomActivityFailure', context, home)(notice);
  callback('dismissRoomFailure', context, home)();
  assert.equal(context.dismissed, 1); assert.equal(context.roomFailure, null);
}
console.log('Verified blocked offscreen departures remain visible, cancel stale commands and open the correct room for furniture recovery.');

{
  const delivered = [];
  const context = { homeRoomId: 'kitchen', layerOrder: [{ instanceId: 'chair' }, { instanceId: 'another-chair' }], itemLabel: () => 'Padded kitchen chair',
    onRoomActivityFailure: notice => delivered.push(notice), moveBlockedFurniture(item) { context.selected = item; }, clearBlockedActivity() {},
  };
  callback('notifyBlockedActivity', context)({ instanceId: 'chair' });
  assert.equal(delivered[0].roomId, 'kitchen');
  assert.equal(delivered[0].target, 'Padded kitchen chair');
  delivered[0].onMove();
  assert.equal(context.selected, context.layerOrder[0], 'Recovery selects the exact failed copy, not another chair with the same name');
}
console.log('Verified the actual stage forwards failure room/item identity and selects the exact copy for recovery.');
