import assert from 'node:assert/strict';
import fs from 'node:fs';

function applyRule(input, rule) {
  const match = /^([+−×÷])(\d+)(?:([+−])(\d+))?$/.exec(rule);
  assert.ok(match, `Unsupported machine rule: ${rule}`);
  const [, operator, operand, adjustment, amount] = match;
  const value = Number(operand);
  let output;
  switch (operator) {
    case '+': output = input + value; break;
    case '−': output = input - value; break;
    case '×': output = input * value; break;
    case '÷': output = input / value; break;
  }
  if (adjustment === '+') output += Number(amount);
  if (adjustment === '−') output -= Number(amount);
  return output;
}

let checked = 0;
for (const locale of ['en', 'lv']) {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const file = `assets/puzzles/${locale === 'en' ? '' : 'lv/'}${difficulty}.json`;
    const puzzles = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const puzzle of puzzles.filter(puzzle => puzzle.type === 'function_machine')) {
      const { input, output, choices } = puzzle.payload;
      const correctIndices = choices.flatMap((rule, index) =>
        applyRule(input, rule) === output ? [index] : []);
      assert.deepEqual(correctIndices, [puzzle.correctIndex],
        `${file}: ${puzzle.id} must have exactly one valid rule matching its answer key`);
      checked++;
    }
  }
}
assert.ok(checked > 0, 'Function-machine puzzles must be present');
console.log(`Verified ${checked} function-machine puzzles have exactly one valid answer.`);
