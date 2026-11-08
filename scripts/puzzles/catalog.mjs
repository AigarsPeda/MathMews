import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the same resolver as the app in Node-based content checks.
const module = { exports: {} };
const source = fs.readFileSync(new URL('../../utils/localize-puzzle.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports });
export const localizePuzzle = module.exports.localizePuzzle;

const locales = ['en', 'lv', 'ru'];
const displayKeys = new Set(['question', 'hint', 'explanation', 'choices', 'label', 'statement', 'expression', 'optionA', 'optionB', 'leftDisplay', 'wrongWork', 'prompt', 'proposed', 'options']);

/** Collapse locale copies, rejecting any difference in puzzle structure or answers. */
export function groupPuzzleTranslations(versions, location = 'puzzle', display = false) {
  const values = locales.map(locale => versions[locale]);
  const [first] = values;
  if (typeof first === 'string' && display) {
    assert.ok(values.every(value => typeof value === 'string' && value.trim()), `${location}: missing translation`);
    return values.every(value => value === first) ? first : Object.fromEntries(locales.map(locale => [locale, versions[locale]]));
  }
  if (Array.isArray(first)) {
    assert.ok(values.every(value => Array.isArray(value) && value.length === first.length), `${location}: locale array mismatch`);
    return first.map((_, index) => groupPuzzleTranslations(
      Object.fromEntries(locales.map(locale => [locale, versions[locale][index]])), `${location}[${index}]`, display));
  }
  if (first && typeof first === 'object') {
    for (const value of values) assert.deepEqual(Object.keys(value ?? {}).sort(), Object.keys(first).sort(), `${location}: locale fields differ`);
    return Object.fromEntries(Object.keys(first).map(key => [key, groupPuzzleTranslations(
      Object.fromEntries(locales.map(locale => [locale, versions[locale][key]])), `${location}.${key}`, displayKeys.has(key))]));
  }
  for (const value of values) assert.equal(value, first, `${location}: shared puzzle data differs`);
  return first;
}

export function readPuzzles(locale, difficulty) {
  const definitions = JSON.parse(fs.readFileSync(new URL(`../../assets/puzzles/${difficulty}.json`, import.meta.url), 'utf8'));
  // Convert VM objects to the caller's realm for strict assertions in existing checks.
  return JSON.parse(JSON.stringify(definitions.map(puzzle => localizePuzzle(puzzle, locale))));
}
