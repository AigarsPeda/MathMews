type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The place-value unit of one "count × unit" term, keyed by its printed value. */
const UNIT_KEYS: Record<string, string> = {
  '10': 'placeValue.countTens',
  '1': 'placeValue.countOnes',
  '0.1': 'decimalModels.countTenths',
  '0.01': 'decimalModels.countHundredths',
};

function placeTerms(text: string) {
  const terms = [];
  for (const part of text.split('+')) {
    const match = part.trim().match(/^(\d+)\s*×\s*(\d+(?:[.,]\d+)?)$/);
    if (!match) return null;
    const unit = match[2].replace(',', '.');
    if (!UNIT_KEYS[unit]) return null;
    terms.push({ count: Number(match[1]), unit, key: UNIT_KEYS[unit] });
  }
  const nonzero = terms.filter(term => term.count > 0);
  return nonzero.length ? nonzero : terms.slice(-1);
}

/** Read the submitted groups as drawn, including ten or more loose ones. */
export function integerPlaceGroups(choice: string) {
  const terms = placeTerms(choice);
  if (!terms || terms.some(term => term.unit !== '1' && term.unit !== '10')) return null;
  const groups = { tens: 0, ones: 0, added: false };
  for (const { count, unit } of terms) groups[unit === '10' ? 'tens' : 'ones'] += count;
  return groups;
}

export function decimalPlaceGroups(choice: string) {
  const terms = placeTerms(choice);
  if (!terms || terms.some(term => term.unit === '10')) return null;
  const groups = { ones: 0, tenths: 0, hundredths: 0 };
  for (const { count, unit } of terms) {
    groups[unit === '1' ? 'ones' : unit === '0.1' ? 'tenths' : 'hundredths'] += count;
  }
  return groups;
}

/** Keep unbundled counts visible, even when two choices have the same numeric total. */
export function compactPlaceValue(text: string, locale: string) {
  return placeTerms(text)?.map(({ count, unit }) => unit === '1' ? String(count)
    : `${count}×${locale === 'en' ? unit : unit.replace('.', ',')}`).join(' + ') ?? text;
}

export function placeValueWords(text: string, t: Translate, locale?: string): string {
  const shown = placeTerms(text);
  if (!shown) return text;
  if (shown.length === 1 && shown[0].count === 0 && shown[0].unit === '0.01') return '0';
  const words = shown.map(({ key, count }) => {
    // Native Intl support varies. These mats have nonnegative whole counts only.
    const last = count % 10, lastTwo = count % 100;
    if (locale === 'ru') {
      const form = last === 1 && lastTwo !== 11 ? 'one'
        : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'few' : 'many';
      return t(`${key}_${form}`, { count });
    }
    if (locale === 'lv') {
      const form = last === 0 || (lastTwo >= 11 && lastTwo <= 19) ? 'zero' : last === 1 ? 'one' : 'other';
      return t(`${key}_${form}`, { count });
    }
    return t(key, { count });
  });
  if (words.length === 1) return words[0];
  return t('placeValue.join', { first: words.slice(0, -1).join(', '), last: words.at(-1) });
}
