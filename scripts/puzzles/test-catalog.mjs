import assert from 'node:assert/strict';
import test from 'node:test';
import { groupPuzzleTranslations, localizePuzzle } from './catalog.mjs';

const locales = ['en', 'lv', 'ru'];
const words = { en: ['Choose a toy', 'Ball', '1.5'], lv: ['Izvēlies rotaļlietu', 'Bumba', '1,5'], ru: ['Выбери игрушку', 'Мяч', '1,5'] };
function examples() {
  return Object.fromEntries(locales.map(locale => [locale, {
    id: 'shared-example', difficulty: 'easy', type: 'multiple_choice', topic: 'addition', ageRange: [5, 7],
    question: words[locale][0], hint: words[locale][0], explanation: words[locale][0],
    choices: [words[locale][2], '2'], correctIndex: 0,
    payload: { items: [{ label: words[locale][1], price: 2 }], object: 'ball', guided: false },
  }]));
}
const plain = value => JSON.parse(JSON.stringify(value));

test('one definition preserves every locale, nested labels, decimal text and shared mathematics', () => {
  const versions = examples(), before = structuredClone(versions);
  const grouped = groupPuzzleTranslations(versions);
  assert.equal(grouped.correctIndex, 0);
  assert.equal(grouped.payload.items[0].price, 2);
  assert.equal(grouped.payload.object, 'ball');
  assert.equal(grouped.choices[1], '2');
  assert.deepEqual(grouped.question, Object.fromEntries(locales.map(locale => [locale, words[locale][0]])));
  for (const locale of locales) assert.deepEqual(plain(localizePuzzle(grouped, locale)), versions[locale]);
  assert.deepEqual(versions, before);
  const selected = localizePuzzle(grouped, 'lv');
  selected.choices.reverse();
  selected.payload.items[0].price = 99;
  assert.deepEqual(plain(localizePuzzle(grouped, 'lv')), versions.lv, 'Localized views cannot mutate shared definitions');
});

test('locale drift in IDs, answers, quantities, metadata or structure fails the build', () => {
  for (const change of [
    p => { p.id = 'different'; },
    p => { p.correctIndex = 1; },
    p => { p.payload.items[0].price = 3; },
    p => { p.payload.object = 'ribbon'; },
    p => { p.payload.guided = true; },
    p => { p.choices.push('3'); },
    p => { delete p.hint; },
    p => { p.question = ''; },
  ]) {
    const versions = examples();
    change(versions.ru);
    assert.throws(() => groupPuzzleTranslations(versions));
  }
  const versions = examples();
  delete versions.ru;
  assert.throws(() => groupPuzzleTranslations(versions));
});

test('missing text fails explicitly instead of falling back to another language', () => {
  const grouped = groupPuzzleTranslations(examples());
  delete grouped.question.ru;
  assert.throws(() => localizePuzzle(grouped, 'ru'), /Missing ru puzzle text/);
});
