import type { CheckedAttempt } from '@/utils/checked-attempt';
import { equationText } from '@/utils/bridge-models';
import { compactPlaceValue, placeValueWords } from '@/utils/place-value-words';
import { gridChoiceLetter } from '@/utils/puzzle-grid';
import { formatPuzzleMoney } from '@/utils/puzzle-money';
import { storyAnswerUnit } from '@/utils/story-answer-unit';
import type { TFunction } from 'i18next';

export function submittedLabel({ puzzle, answer }: Pick<CheckedAttempt, 'puzzle' | 'answer'>, t: TFunction, locale = 'en', compactPlace = false): string {
  const place = (text: string) => compactPlace ? compactPlaceValue(text, locale) : placeValueWords(text, t, locale);
  const model = 'everyday' in puzzle ? puzzle.everyday?.model : undefined;
  const format = (text: string) => {
    if (model?.kind === 'capacity' && /^\d+(?:[.,]\d+)?$/.test(text)) {
      const value = locale === 'en' ? text.replace(',', '.') : text.replace('.', ',');
      if (model.task === 'containers' || model.task === 'servings') return value;
      return t(model.task === 'litres' ? 'jugSolution.litres' : 'jugSolution.ml', { value });
    }
    if (model?.kind === 'clock' && /^0\d:\d{2}$/.test(text)) return text.slice(1);
    if (model?.kind === 'money' && model.task !== 'afford' && /^\d+(?:[.,]\d+)?$/.test(text)) {
      return formatPuzzleMoney(Math.round(Number(text.replace(',', '.')) * (model.unit === 'euros' ? 100 : 1)), model.unit, locale);
    }
    if (puzzle.type === 'place_value' || puzzle.type === 'decimal_place_value') return place(text);
    if (puzzle.type === 'geometry_measure' && /^\d+$/.test(text)) {
      const area = puzzle.payload.mode === 'area';
      return t(area ? (text === '1' ? 'geometryModels.squareUnit' : 'geometryModels.squareUnits') : (text === '1' ? 'geometryModels.oneUnit' : 'geometryModels.manyUnits'), { value: text });
    }
    return text;
  };
  const gridChoice = (options: readonly string[], choice: string) => `${gridChoiceLetter(options, Number(choice))} · ${t('everyday.gridSquare', { number: choice })}`;
  const judge = (value: boolean) => t(value ? 'puzzleTypes.trueLabel' : 'puzzleTypes.falseLabel').replace(/\s*[✓✔✗✘]\s*$/u, '');
  switch (answer.kind) {
    case 'distribution': {
      if (puzzle.type !== 'fair_share') return '';
      const counts = Array.from({ length: puzzle.payload.people }, (_, i) => answer.locations.filter(place => place === i + 1).length);
      const remaining = answer.locations.filter(place => place === 0).length;
      return t(puzzle.payload.object === 'cookie' ? 'friendlyQ.cookieTally' : 'actionMotion.sharing', { remaining, counts: counts.join(', ') });
    }
    case 'choice':
      if (puzzle.type === 'true_false') return judge(answer.index === 0);
      if (puzzle.type === 'compare') return [puzzle.payload.optionA, puzzle.payload.optionB][answer.index];
      if ('choices' in puzzle) {
        const choice = puzzle.choices[answer.index];
        return model?.kind === 'grid' ? gridChoice(puzzle.choices, choice) : format(choice);
      }
      return 'choices' in puzzle.payload ? puzzle.payload.choices[answer.index] : '';
    case 'response':
      if (puzzle.response?.kind === 'choose') {
        const options = puzzle.response.options, choice = options[Number(answer.value)];
        return model?.kind === 'grid' ? gridChoice(options, choice) : format(choice);
      }
      if (typeof answer.value === 'boolean') {
        const verdict = judge(answer.value);
        if (puzzle.type === 'true_false' || puzzle.response?.kind !== 'judge') return verdict;
        const proposal = model?.kind === 'grid' ? t('everyday.gridSquare', { number: puzzle.response.proposed }) : format(puzzle.response.proposed);
        return `${proposal} · ${verdict}`;
      }
      return [format(locale === 'en' ? answer.value : answer.value.replace('.', ',')), storyAnswerUnit(puzzle, locale)].filter(Boolean).join(' ');
    case 'fraction_point': return puzzle.type === 'fraction_number_line' ? answer.tick + '/' + puzzle.payload.divisions : '';
    case 'geometry':
      if (puzzle.type === 'geometry_measure' && puzzle.payload.mode === 'compare') return ['A', 'B', t('geometryModels.equal')][answer.value] ?? '';
      return format(String(answer.value));
    case 'value': return String(answer.value);
    case 'bridge': {
      const { equation, point, value } = answer.state;
      return equation ? equationText(equation) : point ? '(' + point.x + ', ' + point.y + ')' : puzzle.type === 'ratio_table' ? t('jugSolution.litres', { value }) : String(value);
    }
    case 'operators': return answer.operators.join('  ');
    case 'pair': return puzzle.type === 'pair_sum' ? answer.indices.map(i => puzzle.payload.numbers[i]).join(' + ') : '';
    case 'pairs': return puzzle.type === 'find_all_pairs' ? answer.pairs.map(pair => pair.map(i => puzzle.payload.numbers[i]).join(' + ')).join(', ') : '';
    case 'order': return answer.numbers.join(', ');
    case 'sequence': return answer.values.join(', ');
    case 'route': return answer.cells.map(i => i + 1).join(' → ');
    case 'fraction': return puzzle.type === 'fraction_build' ? t('progress.countOf', { solved: answer.shaded, total: puzzle.payload.denominator }) : '';
    case 'fraction_strip': return `${answer.state.shaded}/${answer.state.parts}`;
    case 'place_value': return place(`${answer.state.tens} × 10 + ${answer.state.ones} × 1`);
    case 'decimal_place': {
      const { ones, tenths, hundredths } = answer.state;
      return ones || tenths || hundredths ? place(`${ones} × 1 + ${tenths} × 0.1 + ${hundredths} × 0.01`) : '0';
    }
    case 'decimal_grid': return t('play.submittedShaded', { value: answer.shaded });
    case 'fraction_match':
      if ('selectedByPair' in answer && puzzle.type === 'fraction_match')
        return answer.selectedByPair.map((mask, i) => `${mask.length}/${puzzle.payload.pairs[i].denominator}`).join(' · ');
      return 'matchedCount' in answer ? t('friendlyQ.pairs', { n: answer.matchedCount }) : '';
    case 'budget': return puzzle.type === 'budget_plan' ? answer.indices.map(i => puzzle.payload.items[i].label).join(' + ') : '';
    case 'sort': {
      if (puzzle.type !== 'sort_buckets') return '';
      const data = puzzle.payload;
      const items = data.rule === 'range' ? data.numbers.map(String) : data.fractions.map(pair => pair.join('/'));
      const groups = data.rule === 'range' ? [`< ${data.boundary}`, `≥ ${data.boundary}`] : data.targets.map(pair => pair.join('/'));
      return groups.map((group, i) => `${group}: ${items.filter((_, j) => answer.buckets[j] === i).join(', ') || '∅'}`).join(' · ');
    }
  }
}
