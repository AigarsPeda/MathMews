import type { ReviewQuestion } from '@/constants/learning-review';

export function reviewHash(key: string): number {
  let value = 2166136261;
  for (const char of key) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

/** Stable for the lesson/day, including when the language changes or the app reopens. */
export function reviewChoiceOrder(options: string[], key: string): string[] {
  const result = [...options];
  for (let i = result.length - 1; i > 0; i--) {
    const j = reviewHash(`${key}/choice/${i}`) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Vary both answer position and numeric rank. Prefer mistakes tied to the question. */
export function numericReview(prompt: ReviewQuestion['prompt'], answer: number, detail: string | ReviewQuestion['explanation'], key: string,
  distractors: number[] = [], min = 0, max = Infinity): ReviewQuestion {
  const rank = reviewHash(`${key}/rank`) % 3;
  const nearby = rank === 0 ? [answer + 1, answer + 2] : rank === 1 ? [answer - 1, answer + 1] : [answer - 1, answer - 2];
  const candidates = reviewHash(`${key}/mistakes`) % 2 ? [...distractors, ...nearby] : [...nearby, ...distractors];
  const wrong = [...new Set([...candidates, answer - 1, answer + 1, answer - 2, answer + 2])]
    .filter(n => Number.isSafeInteger(n) && n !== answer && n >= min && n <= max).slice(0, 2);
  const choices = reviewChoiceOrder([String(answer), ...wrong.map(String)], key);
  return { prompt, choices, correctIndex: choices.indexOf(String(answer)),
    explanation: typeof detail === 'string' ? { en: detail, lv: detail, ru: detail } : detail };
}
