import type { Puzzle } from '@/types/puzzle';

export type ResponseValue = string | boolean | null;

export function responseComplete(puzzle: Puzzle, value: ResponseValue): boolean {
  const response = puzzle.response;
  if (!response || value === null) return false;
  if (response.kind === 'judge') return typeof value === 'boolean';
  if (typeof value !== 'string') return false;
  if (response.kind === 'choose') return /^\d+$/.test(value) && Number(value) < response.options.length;
  if (response.format === 'clock') return /^\d{1,2}:[0-5]\d$/.test(value) && Number(value.split(':')[0]) < 24;
  if (response.format === 'fraction') return /^\d+\/[1-9]\d*$/.test(value);
  return /^-?\d+(?:[.,]\d+)?$/.test(value) && Number.isFinite(Number(value.replace(',', '.')));
}

export function checkPuzzleResponse(puzzle: Puzzle, value: ResponseValue): boolean {
  const response = puzzle.response;
  if (!response || !responseComplete(puzzle, value)) return false;
  if (response.kind === 'judge') return value === response.isCorrect;
  if (response.kind === 'choose') return Number(value) === response.correctIndex;
  const written = String(value).replace(',', '.');
  if (response.format === 'clock') {
    const minutes = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    return minutes(written) === minutes(response.answer);
  }
  if (response.format === 'fraction') {
    const [n, d] = written.split('/').map(Number), [a, b] = response.answer.split('/').map(Number);
    return (!response.denominator || d === response.denominator) && n * b === a * d;
  }
  return Number(written) === Number(response.answer);
}

/** Build only syntactically useful drafts; punctuation and sign keys remain editable. */
export function editResponse(value: ResponseValue, key: string, format: 'number' | 'clock' | 'fraction'): string {
  const current = typeof value === 'string' ? value : '';
  if (key === 'erase') return current.slice(0, -1);
  if (key === 'clear') return '';
  if (key === 'sign') return current.startsWith('-') ? current.slice(1) : `-${current}`;
  const next = current + key;
  if (next.length > (format === 'clock' ? 5 : 12)) return current;
  const pattern = format === 'clock' ? /^\d{0,2}(?::\d{0,2})?$/ : format === 'fraction' ? /^\d*(?:\/\d*)?$/ : /^-?\d*(?:[.,]\d*)?$/;
  return pattern.test(next) ? next : current;
}
