import { readPuzzles } from './puzzles/catalog.mjs';
/** Locale coverage, interpolation, Russian plurals and shared puzzle semantics. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createInstance } from 'i18next';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const stored = new Map(), cache = new Map();
let deviceLanguage = 'ru';
const language = createInstance();
function load(id) {
  if (id === 'i18next') return language;
  if (id === 'react-i18next') return { initReactI18next: { type: '3rdParty', init() {} } };
  if (id === 'expo-localization') return { getLocales: () => [{ languageCode: deviceLanguage }] };
  if (id === '@react-native-async-storage/async-storage') return {
    getItem: async key => stored.get(key) ?? null,
    setItem: async (key, value) => stored.set(key, value),
  };
  const base = path.resolve(id.replace('@/', './'));
  const file = [base, `${base}.ts`, `${base}/index.ts`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  assert.ok(file, id);
  if (file.endsWith('.json')) return read(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, esModuleInterop: true, resolveJsonModule: true,
  } }).outputText;
  vm.runInNewContext(source, { require: load, module, exports: module.exports, console, process }, { filename: file });
  return module.exports;
}
const { APP_LOCALES, isAppLocale, LOCALE_STORAGE_KEY } = load('@/types/locale');
assert.deepEqual(Array.from(APP_LOCALES), ['en', 'lv', 'ru']);
assert.ok(isAppLocale('ru'));
assert.equal(isAppLocale('ru-RU'), false, 'Stored locale codes are canonical');
const { loadSavedLocale, saveLocale } = load('@/utils/locale-storage');
await saveLocale('ru');
assert.equal(stored.get(LOCALE_STORAGE_KEY), 'ru');
assert.equal(await loadSavedLocale(), 'ru');
stored.set(LOCALE_STORAGE_KEY, 'unsupported');
assert.equal(await loadSavedLocale(), null);
const { getDeviceLocale } = load('@/i18n');
assert.equal(getDeviceLocale(), 'ru');
deviceLanguage = 'lv'; assert.equal(getDeviceLocale(), 'lv');
deviceLanguage = 'fr'; assert.equal(getDeviceLocale(), 'en');
const config = read('app.json').expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-localization');
assert.deepEqual(config[1].supportedLocales, Array.from(APP_LOCALES));

const placeholders = text => (text.match(/\{\{[^}]+\}\}/g) ?? []).sort();
function checkMessages(en, ru, location) {
  if (typeof en === 'string') {
    assert.ok(typeof ru === 'string' && ru.trim(), `${location}: missing Russian text`);
    assert.deepEqual(placeholders(ru), placeholders(en), `${location}: interpolation changed`);
    assert.ok(!/__N\d+__|__BR__/.test(ru), `${location}: unresolved authoring token`);
  } else {
    for (const [key, value] of Object.entries(en)) checkMessages(value, ru?.[key], `${location}.${key}`);
  }
}
const en = read('locales/en.json'), ru = read('locales/ru.json');
checkMessages(en, ru, 'UI');
const helpEn = load('@/locales/visual-help/en').visualHelpEn;
const helpRu = load('@/locales/visual-help/ru').visualHelpRu;
checkMessages(helpEn, helpRu, 'picture help');
await language.changeLanguage('ru');
assert.equal(language.t('locale.ru'), 'Русский');
assert.equal(language.t('settings.title'), 'Настройки');
assert.equal(language.t('visualHelp.title'), 'Наглядная подсказка');
for (const [count, expected] of [[1,'1 день'],[2,'2 дня'],[5,'5 дней'],[11,'11 дней'],[21,'21 день'],[22,'22 дня'],[25,'25 дней']]) {
  assert.equal(language.t('economy.streakDay', { count }), expected);
}
for (const count of [1, 2, 5, 11, 21, 22, 25]) {
  for (const key of ['store.pendingPurchases', 'puzzleTypes.fractionMatchPairsLeft']) {
    const form = new Intl.PluralRules('ru').select(count);
    assert.equal(language.t(key, { count }), ru[key.split('.')[0]][`${key.split('.')[1]}_${form}`].replace('{{count}}', String(count)));
  }
}
await language.changeLanguage('en'); assert.equal(language.t('settings.title'), 'Settings');
await language.changeLanguage('ru'); assert.equal(language.t('settings.title'), 'Настройки');

function checkLearningText(value) {
  if (Array.isArray(value)) value.forEach(checkLearningText);
  else if (value && typeof value === 'object') {
    if (typeof value.en === 'string' && typeof value.lv === 'string') {
      checkMessages(value.en, value.ru, value.en);
      assert.match(value.ru, /[А-Яа-яЁё]/, value.en);
    } else Object.values(value).forEach(checkLearningText);
  }
}
const catalog = read('data/puzzle-curriculum.json');
checkLearningText(catalog);
const numbers = text => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map(n => n.replace(',', '.')).sort();
const displayKeys = new Set(['question','hint','explanation','choices','statement','expression','optionA','optionB','leftDisplay','wrongWork','label','prompt','proposed','options']);
function comparePuzzle(source, translated, location, display = false) {
  if (typeof source === 'string') {
    if (display) {
      assert.deepEqual(numbers(translated), numbers(source), `${location}: translated mathematical values changed`);
    } else assert.equal(translated, source, `${location}: shared metadata changed`);
  } else if (Array.isArray(source)) {
    assert.equal(translated.length, source.length, location);
    source.forEach((value, index) => comparePuzzle(value, translated[index], `${location}[${index}]`, display));
  } else if (source && typeof source === 'object') {
    assert.deepEqual(Object.keys(translated), Object.keys(source), location);
    for (const [key, value] of Object.entries(source)) comparePuzzle(value, translated[key], `${location}.${key}`, displayKeys.has(key));
  } else assert.equal(translated, source, location);
}
let puzzleCount = 0;
for (const tier of ['easy','medium','hard']) {
  const source = readPuzzles('en', tier), translated = readPuzzles('ru', tier);
  comparePuzzle(source, translated, tier);
  for (const [index, puzzle] of translated.entries()) {
    for (const key of ['question','hint']) {
      if (/[A-Za-z]/.test(source[index][key])) assert.match(puzzle[key], /[А-Яа-яЁё]/, `${puzzle.id}.${key}`);
    }
    if (puzzle.helpTemplate) assert.ok(helpRu.lessons[puzzle.helpTemplate], `${puzzle.id}: Russian walkthrough missing`);
  }
  puzzleCount += translated.length;
}
const { getLearningReview } = load('@/constants/learning-review');
for (const lesson of load('@/constants/curriculum').LEARNING_CATALOG.lessons) {
  for (const day of [0,1,2,13]) {
    const review = getLearningReview(lesson, day);
    assert.match(review.prompt.ru, /[А-Яа-яЁё]/);
    assert.deepEqual(numbers(review.prompt.ru), numbers(review.prompt.en), lesson.id);
    assert.deepEqual(numbers(review.explanation.ru), numbers(review.explanation.en), lesson.id);
  }
}
const { getPrivacyPolicyContent } = load('@/legal/privacy-policy-content');
const policy = getPrivacyPolicyContent('ru');
assert.equal(policy.sections.length, getPrivacyPolicyContent('en').sections.length);
assert.match(policy.screenTitle, /конфиденциальности/);
const { decimalLabel } = load('@/utils/decimal-models');
for (const tag of ['ru', 'ru-RU']) assert.equal(decimalLabel(104, 2, tag), '1,04');
assert.equal(decimalLabel(104, 2, 'en'), '1.04');
const { formatGameStartedDate } = load('@/utils/format-game-date');
assert.match(formatGameStartedDate(Date.UTC(2026, 10, 4), 'ru'), /нояб/);
console.log(`Verified Russian locale selection, persistence, device detection, UI and walkthrough coverage, plurals, ${puzzleCount} identical puzzle answer/reward definitions, lesson reviews.`);
