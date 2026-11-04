import fs from 'node:fs';

const translations = JSON.parse(fs.readFileSync(new URL('../../locales/puzzle-text/ru.json', import.meta.url), 'utf8'));
const numberPattern = /\d+(?:\.\d+)?/g;

/** Numbered slots let one reviewed translation cover every numeric example. */
export function russianText(text) {
  if (!/[A-Za-z]/.test(text)) return text.replace(/(\d)\.(?=\d)/g, '$1,');
  const numbers = [];
  const key = text.replace(numberPattern, value => `__N${numbers.push(value) - 1}__`);
  const translated = translations[key];
  if (!translated) throw new Error(`Missing Russian puzzle translation: ${key}`);
  return translated.replace(/__N(\d+)__/g, (_, index) => numbers[Number(index)].replace('.', ','));
}

/** Localize display text only. IDs, quantities, answers and scene data stay shared. */
export function addRussianLearningText(value) {
  if (Array.isArray(value)) {
    value.forEach(addRussianLearningText);
  } else if (value && typeof value === 'object') {
    if (typeof value.en === 'string' && typeof value.lv === 'string') value.ru = russianText(value.en);
    else Object.values(value).forEach(addRussianLearningText);
  }
}

const payloadTextKeys = new Set(['choices', 'label', 'statement', 'expression', 'optionA', 'optionB', 'leftDisplay', 'wrongWork']);
function localizePayload(value, displayText = false) {
  if (typeof value === 'string') return displayText ? russianText(value) : value;
  if (Array.isArray(value)) return value.map(item => localizePayload(item, displayText));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, localizePayload(item, payloadTextKeys.has(key))]));
  return value;
}

export function russianPuzzle(puzzle) {
  const result = structuredClone(puzzle);
  for (const key of ['question', 'hint', 'explanation']) result[key] = russianText(result[key]);
  if (result.choices) result.choices = result.choices.map(russianText);
  if (result.payload) result.payload = localizePayload(result.payload);
  return result;
}
