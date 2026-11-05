import plans from '@/data/puzzle-bridge-lessons.json';
import type { LearningLesson } from '@/types/curriculum';
import type { ReviewQuestion } from '@/constants/learning-review';
import { numericReview, reviewChoiceOrder, reviewHash } from '@/utils/review-question';

/** Fresh transfer checks use the same range and operations as the taught board. */
export function getBridgeReview(lesson: LearningLesson, day: number): ReviewQuestion | null {
  const plan = plans.find(p => p.id === lesson.id);
  if (!plan) return null;
  const key = `${lesson.id}/${day}`, v = reviewHash(`${key}/values`), tier = lesson.difficulty;
  const mode = (day + reviewHash(lesson.id)) % 3;
  const ask = (prompt: ReviewQuestion['prompt'], answer: number, detail: string, wrong: number[] = [], min = 0, max = Infinity) =>
    numericReview(prompt, answer, detail, key, wrong, min, max);
  if (plan.type === 'ratio_table') {
    const a = tier === 'easy' ? 1 : tier === 'medium' ? 2 + v % 3 : 3 + v % 3;
    const rate = 2 + Math.floor(v / 3) % (tier === 'easy' ? 4 : 5), b = a * rate;
    const n = tier === 'easy' ? 2 + v % 3 : tier === 'medium' ? a * (2 + v % 3) : 1 + v % 8;
    return ask({
      en: `${a} groups hold ${b} items. How many items are in ${n} equal groups?`,
      lv: `${a} grupās ir ${b} priekšmeti. Cik priekšmetu ir ${n} tādās pašās grupās?`,
      ru: `В ${a} группах ${b} предметов. Сколько предметов в ${n} таких же группах?`,
    }, n * rate, `${b} ÷ ${a} × ${n} = ${n * rate}.`, [b + n - a, n * b]);
  }
  if (plan.type === 'signed_line') {
    const min = tier === 'easy' ? 0 : -6, max = tier === 'easy' ? 10 : 6;
    const a = tier === 'easy' ? 1 + v % 7 : -3 + v % 7;
    const delta = (tier === 'easy' ? 1 : v % 2 ? 1 : -1) * (1 + Math.floor(v / 7) % 3), result = a + delta;
    return ask({
      en: `Start at ${a}. Move ${Math.abs(delta)} steps ${delta < 0 ? 'left' : 'right'}. Where do you finish?`,
      lv: `Sāc pie ${a}. Veic ${Math.abs(delta)} soļus pa ${delta < 0 ? 'kreisi' : 'labi'}. Kur nonāc?`,
      ru: `Начни с ${a}. Сделай ${Math.abs(delta)} шага ${delta < 0 ? 'влево' : 'вправо'}. Где окажешься?`,
    }, result, `${a} ${delta < 0 ? '−' : '+'} ${Math.abs(delta)} = ${result}.`, [a - delta, a], min, max);
  }
  if (plan.type === 'equation_board') {
    const x = 1 + v % 8, a = tier === 'easy' || tier === 'medium' && mode === 0 ? 1 : 2 + Math.floor(v / 8) % 3;
    const b = tier === 'medium' && a > 1 ? 0 : (tier === 'hard' && mode === 1 ? -1 : 1) * (1 + Math.floor(v / 24) % 5);
    const c = a * x + b, equation = `${a === 1 ? '' : a}x${b ? ` ${b < 0 ? '−' : '+'} ${Math.abs(b)}` : ''} = ${c}`;
    return ask({ en: `Find x: ${equation}.`, lv: `Atrodi x: ${equation}.`, ru: `Найди x: ${equation}.` }, x,
      `${c} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${a * x}; ${a * x} ÷ ${a} = ${x}.`, [c - b, c + b]);
  }
  const min = tier === 'hard' ? -4 : 0, max = tier === 'easy' ? 4 : tier === 'medium' ? 6 : 4;
  const size = max - min + 1, x = min + v % size, y = min + Math.floor(v / size) % size;
  if (tier !== 'easy' && mode === 2) {
    const vertical = v % 2 === 0, end = min + (v + 1 + Math.floor(v / 11) % (size - 1)) % size;
    const from = vertical ? y : x, distance = Math.abs(end - from), ex = vertical ? x : end, ey = vertical ? end : y;
    return ask({
      en: `How many grid units separate (${x}, ${y}) and (${ex}, ${ey})?`,
      lv: `Cik režģa vienību ir starp (${x}, ${y}) un (${ex}, ${ey})?`,
      ru: `Сколько единиц сетки между (${x}, ${y}) и (${ex}, ${ey})?`,
    }, distance, `|${end} − (${from})| = ${distance}.`, [Math.abs(end + from), distance + 1], 0, max - min);
  }
  let tx = x, ty = y;
  let prompt: ReviewQuestion['prompt'] = {
    en: `Which ordered pair has x = ${x} and y = ${y}?`, lv: `Kuram koordinātu pārim x = ${x} un y = ${y}?`, ru: `В какой паре координат x = ${x} и y = ${y}?`,
  };
  if (tier !== 'easy' && mode === 1) {
    const dx = x < max ? 1 : -1, dy = y > min ? -1 : 1;
    tx += dx; ty += dy;
    prompt = {
      en: `Start at (${x}, ${y}). Change x by ${dx > 0 ? '+' : ''}${dx} and y by ${dy > 0 ? '+' : ''}${dy}. Where do you finish?`,
      lv: `Sāc punktā (${x}, ${y}). Maini x par ${dx > 0 ? '+' : ''}${dx} un y par ${dy > 0 ? '+' : ''}${dy}. Kur nonāc?`,
      ru: `Начни в точке (${x}, ${y}). Измени x на ${dx > 0 ? '+' : ''}${dx}, а y на ${dy > 0 ? '+' : ''}${dy}. Где окажешься?`,
    };
  }
  const answer = `(${tx}, ${ty})`, nextX = tx < max ? tx + 1 : tx - 1, nextY = ty < max ? ty + 1 : ty - 1;
  const wrong = [...new Set([`(${ty}, ${tx})`, `(${nextX}, ${ty})`, `(${tx}, ${nextY})`])].filter(s => s !== answer).slice(0, 2);
  const choices = reviewChoiceOrder([answer, ...wrong], key), detail = `x = ${tx}; y = ${ty}.`;
  return { prompt, choices, correctIndex: choices.indexOf(answer), explanation: { en: detail, lv: detail, ru: detail } };
}
