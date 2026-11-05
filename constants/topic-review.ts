import type { LearningLesson } from '@/types/curriculum';
import type { ReviewQuestion } from '@/constants/learning-review';
import { numericReview, reviewHash } from '@/utils/review-question';
import foundationPlans from '@/data/puzzle-foundations.json';

export function getTopicReview(lesson: LearningLesson, day: number, stage: number): ReviewQuestion | null {
  const key = `${lesson.id}/${day}`, v = reviewHash(`${key}/values`), mode = (day + reviewHash(lesson.id)) % 3;
  const ask = (prompt: ReviewQuestion['prompt'], answer: number, detail: string, wrong: number[] = [], min = 0, max = Infinity) =>
    numericReview(prompt, answer, detail, key, wrong, min, max);
  if (lesson.topicId === 'patterns') {
    const hard = lesson.difficulty === 'hard', factor = 2 + v % 2;
    const step = stage < 2 ? 1 + v % 2 : stage < 5 ? 1 + v % 3 : [2, 5][v % 2];
    const start = 1 + Math.floor(v / 7) % (hard ? 5 : 4);
    const decreasing = mode === 1, multiplicative = hard && mode !== 2;
    const sequence = Array.from({ length: 5 }, (_, i) => multiplicative ? start * factor ** i : start + step * i);
    if (decreasing) sequence.reverse();
    const index = mode === 2 ? 2 : 4, answer = sequence[index], shown = sequence.map((n, i) => i === index ? '?' : n).join(', ');
    const rule = multiplicative ? `${decreasing ? '÷' : '×'} ${factor}` : `${decreasing ? '−' : '+'} ${step}`;
    return ask({
      en: `Use the same rule at each step. What replaces ? in ${shown}?`,
      lv: `Katrā solī izmanto to pašu likumu. Kas jāliek ? vietā: ${shown}?`,
      ru: `Применяй одно правило на каждом шаге. Какое число вместо ? в ряду ${shown}?`,
    }, answer, `${rule}: ${sequence.join(', ')}.`, [answer + (multiplicative ? factor : step), answer - (multiplicative ? factor : step)]);
  }
  if (lesson.topicId === 'measurement') {
    const each = 3 + v % 17, groups = 2 + Math.floor(v / 17) % 4, target = groups + 1 + v % 4;
    if (mode === 0) return ask({
      en: `${groups} equal bags hold ${groups * each} grams altogether. How many grams do ${target} bags hold?`,
      lv: `${groups} vienādos maisiņos kopā ir ${groups * each} grami. Cik gramu ir ${target} tādos maisiņos?`,
      ru: `В ${groups} одинаковых пакетах всего ${groups * each} граммов. Сколько граммов в ${target} таких пакетах?`,
    }, each * target, `${groups * each} ÷ ${groups} × ${target} = ${each * target}.`, [groups * each + target - groups, each]);
    if (mode === 1) {
      const a = 22 + v % 77, b = 21 + Math.floor(v / 77) % 78, sum = a + b, answer = Math.round(sum / 10) * 10;
      // Every choice is a multiple of ten, with the correct value varying in rank.
      const rank = Math.floor(v / 5) % 3, options = rank === 0 ? [answer + 10, answer + 20] : rank === 1 ? [answer - 10, answer + 10] : [answer - 20, answer - 10];
      const question = ask({
        en: `Add ${a} + ${b} exactly, then round the total to the nearest ten.`,
        lv: `Precīzi saskaiti ${a} + ${b}, tad noapaļo summu līdz tuvākajam desmitam.`,
        ru: `Точно сложи ${a} + ${b}, затем округли сумму до ближайшего десятка.`,
      }, answer, `${a} + ${b} = ${sum} ≈ ${answer}.`);
      const ordered = [answer, ...options];
      const shift = reviewHash(`${key}/estimate-position`) % 3;
      question.choices = [...ordered.slice(shift), ...ordered.slice(0, shift)].map(String);
      question.correctIndex = question.choices.indexOf(String(answer));
      return question;
    }
    return ask({
      en: `${groups * each} items are arranged in rows of ${each}. How many rows are there?`,
      lv: `${groups * each} priekšmeti sakārtoti rindās pa ${each}. Cik rindu ir?`,
      ru: `${groups * each} предметов расположены рядами по ${each}. Сколько рядов?`,
    }, groups, `${groups * each} ÷ ${each} = ${groups}.`, [each, groups + 1]);
  }
  if (lesson.topicId === 'percentages') {
    const percent = [10, 20, 25, 50][v % 4], total = 20 * (3 + Math.floor(v / 4) % 13), part = total * percent / 100;
    if (mode === 0) return ask({
      en: `What is ${percent}% of ${total}?`, lv: `Cik ir ${percent}% no ${total}?`, ru: `Сколько составляет ${percent}% от ${total}?`,
    }, part, `${total} × ${percent} ÷ 100 = ${part}.`, [total - part, percent]);
    return ask({
      en: `A toy costs ${total} coins before a ${percent}% discount. What is the sale price?`,
      lv: `Rotaļlieta pirms ${percent}% atlaides maksā ${total} monētas. Kāda ir cena ar atlaidi?`,
      ru: `До скидки ${percent}% игрушка стоила ${total} монет. Какова цена со скидкой?`,
    }, total - part, `${total} × ${percent} ÷ 100 = ${part}; ${total} − ${part} = ${total - part}.`, [part, total + part, total - percent]);
  }
  if (lesson.topicId === 'logic') {
    const n = 2 * (5 + v % 25), divisor = [3, 4, 5][v % 3];
    if (mode === 0) return ask({
      en: `Which even number is greater than ${n - 2} and less than ${n + 2}?`,
      lv: `Kurš pāra skaitlis ir lielāks par ${n - 2} un mazāks par ${n + 2}?`,
      ru: `Какое чётное число больше ${n - 2} и меньше ${n + 2}?`,
    }, n, `${n - 2} < ${n} < ${n + 2}; ${n} ÷ 2 = ${n / 2}.`, [n - 1, n + 1]);
    if (mode === 1) {
      const answer = divisor * (3 + v % 6);
      return ask({
        en: `The code is greater than ${answer - divisor} and less than ${answer + divisor}. It is divisible by ${divisor}. What is the code?`,
        lv: `Kods ir lielāks par ${answer - divisor} un mazāks par ${answer + divisor}. Tas dalās ar ${divisor}. Kāds ir kods?`,
        ru: `Код больше ${answer - divisor} и меньше ${answer + divisor}. Он делится на ${divisor}. Чему равен код?`,
      }, answer, `${answer} ÷ ${divisor} = ${answer / divisor}.`, [answer - 1, answer + 1]);
    }
    return ask({
      en: `A box holds fewer than ${n} balls. Which amount is impossible?`,
      lv: `Kastē ir mazāk nekā ${n} bumbiņas. Kurš daudzums nav iespējams?`,
      ru: `В коробке меньше ${n} мячей. Какое количество невозможно?`,
    }, n, `${n} ≮ ${n}.`, [n - 1, n - 2], 0, n);
  }
  if (lesson.topicId === 'numbers') {
    const max = stage === 0 ? 10 : 20, n = 2 + v % (max - 3);
    if (mode === 0) return ask({ en: `Which number comes just before ${n}?`, lv: `Kurš skaitlis ir tieši pirms ${n}?`, ru: `Какое число стоит непосредственно перед ${n}?` }, n - 1, `${n} − 1 = ${n - 1}.`, [n, n + 1], 0, max);
    if (mode === 1) return ask({ en: `Which number lies between ${n - 1} and ${n + 1}?`, lv: `Kurš skaitlis atrodas starp ${n - 1} un ${n + 1}?`, ru: `Какое число находится между ${n - 1} и ${n + 1}?` }, n, `${n - 1} < ${n} < ${n + 1}.`, [n - 1, n + 1], 0, max);
    return ask({ en: `Which number comes just after ${n}?`, lv: `Kurš skaitlis ir uzreiz pēc ${n}?`, ru: `Какое число идёт сразу после ${n}?` }, n + 1, `${n} + 1 = ${n + 1}.`, [n, n - 1], 0, max);
  }
  if (lesson.topicId === 'division' && stage > 0 && mode !== 0) {
    const people = 2 + v % 4, each = 2 + Math.floor(v / 4) % 5, left = 1 + Math.floor(v / 20) % (people - 1), total = people * each + left;
    const prompt = mode === 1 ? {
      en: `Share ${total} whole cookies equally among ${people} children. How many cookies remain?`,
      lv: `Sadali ${total} veselus cepumus vienādi ${people} bērniem. Cik cepumu paliek pāri?`,
      ru: `Раздели ${total} целых печений поровну между ${people} детьми. Сколько печений останется?`,
    } : {
      en: `Share ${total} whole cookies equally among ${people} children. How many whole cookies does each child get?`,
      lv: `Sadali ${total} veselus cepumus vienādi ${people} bērniem. Cik veselu cepumu saņem katrs?`,
      ru: `Раздели ${total} целых печений поровну между ${people} детьми. Сколько целых печений получит каждый?`,
    };
    return ask(prompt, mode === 1 ? left : each, `${total} = ${people} × ${each} + ${left}; ${left} < ${people}.`, [mode === 1 ? each : left, each + 1]);
  }
  if (lesson.topicId === 'multiplication' && stage >= 2 && mode === 1) {
    const tables = (lesson.difficulty === 'easy' ? foundationPlans.easyTables : foundationPlans.mediumTables)[stage];
    const a = tables[v % tables.length], b = 2 + Math.floor(v / 7) % (lesson.difficulty === 'easy' ? 5 : 9);
    // Review grouping using a fresh context without introducing division before it is taught.
    return ask({ en: `There are ${a} rows with ${b} seeds in each row. How many seeds altogether?`, lv: `Ir ${a} rindas, katrā ${b} sēklas. Cik sēklu kopā?`, ru: `Есть ${a} рядов по ${b} семян. Сколько всего семян?` }, a * b, `${a} × ${b} = ${a * b}.`, [a + b, a * (b - 1)]);
  }
  if (lesson.topicId === 'operations' && lesson.difficulty === 'hard') {
    const a = 3 + v % 10, b = 2 + Math.floor(v / 10) % 7, c = 2 + Math.floor(v / 70) % 9;
    const expression = mode === 0 ? `${a} + ${b} × ${c}` : mode === 1 ? `${a * b} ÷ ${b} + ${c}` : `(${a} + ${b}) × ${c}`;
    const answer = mode === 0 ? a + b * c : mode === 1 ? a + c : (a + b) * c;
    return ask({ en: `What is the value of ${expression}?`, lv: `Kāda ir izteiksmes ${expression} vērtība?`, ru: `Чему равно выражение ${expression}?` }, answer, `${expression} = ${answer}.`, [mode === 2 ? a + b * c : (a + b) * c]);
  }
  return null;
}
