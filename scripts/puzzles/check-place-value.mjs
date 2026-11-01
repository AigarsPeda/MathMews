import assert from 'node:assert/strict';
import fs from 'node:fs';

export function checkPlaceValuePilot({ load }) {
  const { initialPlaceValue, changePlaceValue, checkPlaceValue, placeValueTarget } = load('@/utils/place-value');
  const { getPuzzleDraftAnswer, getPuzzleAttemptHint } = load('@/utils/puzzle-attempt');
  const { checkPuzzleAnswer } = load('@/utils/puzzle-type');
  const { getTopicPaths } = load('@/constants/puzzle-path');
  const read = locale => JSON.parse(fs.readFileSync(`assets/puzzles/${locale === 'lv' ? 'lv/' : ''}medium.json`));
  const en = read('en'), lv = read('lv');
  const pilot = en.filter(p => p.type === 'place_value');
  assert.equal(pilot.length, 14);
  for (const topic of ['addition', 'subtraction']) {
    const results = pilot.filter(p => p.topic === topic && ['add', 'subtract'].includes(p.payload.mode)).map(placeValueTarget);
    assert.equal(new Set(results).size, results.length, 'Fresh calculations do not repeat a predictable result');
    const path = getTopicPaths('medium', topic)[0];
    const firstFour = path.levels.slice(0, 4).map(l => en.find(p => p.id === l.puzzleIds[0]));
    assert.deepEqual(Array.from(firstFour, p => p.payload.mode), topic === 'addition'
      ? ['build', 'bundle', 'add', 'add'] : ['build', 'split', 'subtract', 'subtract']);
    assert.ok(firstFour[2].payload.guided && !firstFour[3].payload.guided, 'Guidance fades before transfer practice');
    assert.ok(path.levels.slice(4, 7).every(l => en.find(p => p.id === l.puzzleIds[0]).type !== 'place_value'), 'Later symbolic tasks test transfer from the blocks');
  }
  for (const puzzle of pilot) {
    assert.deepEqual(puzzle.payload, lv.find(p => p.id === puzzle.id).payload, 'Bilingual givens and guidance match');
    let state = initialPlaceValue(puzzle);
    const value = s => s.tens * 10 + s.ones;
    const perform = action => {
      const before = state, snapshot = JSON.stringify(before);
      state = changePlaceValue(puzzle, state, action);
      assert.equal(JSON.stringify(before), snapshot, 'Editing a board never mutates an earlier draft');
      assert.ok(state.tens >= 0 && state.ones >= 0 && state.ones <= 19);
      if (action === 'bundle' || action === 'split') assert.equal(value(state), value(before), 'An exchange must conserve quantity');
    };
    assert.equal(getPuzzleDraftAnswer(puzzle, {}), null);
    assert.equal(checkPlaceValue(puzzle, state), false, 'The untouched board cannot complete the puzzle');
    const { mode, start, operand = 0 } = puzzle.payload;
    if (mode === 'build') {
      assert.strictEqual(changePlaceValue(puzzle, state, 'removeOne'), state);
      assert.strictEqual(changePlaceValue(puzzle, state, 'removeTen'), state);
      for (let i = 0; i < Math.floor(start / 10); i++) perform('addTen');
      for (let i = 0; i < start % 10; i++) perform('addOne');
    } else if (mode === 'bundle') perform('bundle');
    else if (mode === 'split') perform('split');
    else if (mode === 'add') {
      perform('addOperand');
      assert.strictEqual(changePlaceValue(puzzle, state, 'addOperand'), state, 'The second operand can be added only once');
      assert.equal(checkPlaceValue(puzzle, state), false, 'A sum with unbundled ones still needs an exchange');
      assert.equal(getPuzzleAttemptHint(puzzle, { kind: 'place_value', state }).key, 'placeValueBundle');
      perform('bundle');
    } else {
      for (let i = 0; i < Math.floor(operand / 10); i++) perform('removeTen');
      if (state.ones < operand % 10) perform('split');
      for (let i = 0; i < operand % 10; i++) perform('removeOne');
    }
    assert.equal(value(state), placeValueTarget(puzzle));
    assert.ok(checkPlaceValue(puzzle, state), puzzle.id);
    const answer = getPuzzleDraftAnswer(puzzle, { placeValue: state });
    assert.ok(checkPuzzleAnswer(puzzle, answer), 'Shared Check accepts the manipulated result');
    assert.equal(checkPuzzleAnswer(puzzle, { kind: 'choice', index: 0 }), false);
    for (const invalid of [{...state, ones: state.ones + 1}, {...state, tens: -1}, {...state, ones: 0.5}, {...state, tens: NaN}]) {
      assert.equal(checkPlaceValue(puzzle, invalid), false);
    }
    assert.equal(getPuzzleDraftAnswer(puzzle, { placeValue: null }), null, 'Reset clears submission readiness');
    if (mode !== 'build') assert.strictEqual(changePlaceValue(puzzle, state, 'addOne'), state, 'Operations cannot gain arbitrary extra blocks');
    // Exercise every reachable state, including mistakes and alternative exchange orders.
    const seen = new Set(), queue = [initialPlaceValue(puzzle)];
    if (mode !== 'build') while (queue.length) {
      const current = queue.shift(), key = JSON.stringify(current);
      if (seen.has(key)) continue;
      seen.add(key);
      for (const action of ['bundle', 'split', 'addOperand', 'removeOne', 'removeTen', 'addOne', 'addTen']) {
        const next = changePlaceValue(puzzle, current, action);
        assert.ok(next.tens >= 0 && next.ones >= 0 && next.ones <= 19);
        if (action === 'bundle' || action === 'split') assert.equal(value(next), value(current));
        if (checkPlaceValue(puzzle, next)) assert.equal(value(next), placeValueTarget(puzzle));
        if (!seen.has(JSON.stringify(next))) queue.push(next);
      }
    }
  }
  console.log('Verified bilingual place-value progression, real block operations, exchanges, shared checking, reset and all reachable operation states.');
}
