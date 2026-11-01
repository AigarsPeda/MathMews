/** Revise authored tasks in place. IDs, skill IDs, path order and reward kinds stay stable. */
import { arithmetic } from './research-revisions.mjs';

const text = (en, lv) => ({ en, lv });
const hash = value => [...value].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 0);

function replaceTask(puzzle, spec) {
  const { id, difficulty, ageRange, learning } = puzzle;
  for (const key of Object.keys(puzzle)) delete puzzle[key];
  Object.assign(puzzle, { id, difficulty, ageRange, ...spec, learning: { ...learning,
    representation: spec.taskVisual ? 'objects' : spec.type.startsWith('fraction') ? 'fraction-model' : 'symbols',
    reasoningSteps: 1 } });
}

function numberChoices(answer, key) {
  const rank = answer >= 2 ? hash(key) % 3 : answer;
  return [answer, ...Array.from({ length: 2 }, (_, i) => answer + (i < rank ? -i - 1 : i + 1))].map(String);
}

function revisePairTiles(list) {
  list.filter(p => p.type === 'pair_sum').forEach((puzzle, ordinal) => {
    const { numbers: old, target, correctIndices } = puzzle.payload;
    const numbers = correctIndices.map(i => old[i]);
    const [a, b] = numbers;
    const [offsetA, offsetB] = [[-1, -1], [1, 1], [-1, 2], [2, -1], [-2, 1], [1, -2]][ordinal % 6];
    // Near misses require addition. Do not add another automatic pair such as 1 + (target - 1).
    for (let distance = 1; distance < target && numbers.length < old.length; distance++) {
      for (const value of [a + offsetA * distance, b + offsetB * distance, a - offsetA * distance, b - offsetB * distance]) {
        if (value <= 0 || value >= target || numbers.includes(value) || numbers.includes(target - value)) continue;
        numbers.push(value);
        if (numbers.length === old.length) break;
      }
    }
    if (numbers.length !== old.length) throw new Error(`${puzzle.id}: not enough distinct near-miss tiles`);
    const positions = numbers.flatMap((_, a) => numbers.flatMap((_, b) => b > a ? [[a, b]] : []));
    const pair = positions[ordinal * 7 % positions.length];
    const ordered = Array(numbers.length);
    pair.forEach((position, i) => { ordered[position] = numbers[i]; });
    let decoy = 2;
    for (let i = 0; i < ordered.length; i++) if (!pair.includes(i)) ordered[i] = numbers[decoy++];
    puzzle.payload = { numbers: ordered, target, correctIndices: pair };
  });
}

const subtractionGoals = [
  text('Take away within ten', 'Atņem skaitļu desmita robežās'),
  text('Count back within ten', 'Skaiti atpakaļ desmita robežās'),
  text('Subtract to reach ten', 'Atņem līdz desmitam'),
  text('Subtract across ten', 'Atņem pāri desmitam'),
  text('Find what was taken away', 'Atrodi, cik tika atņemts'),
  text('Compare two amounts', 'Salīdzini divus daudzumus'),
  text('Check a difference', 'Pārbaudi starpību'),
  text('Repair a subtraction mistake', 'Izlabo atņemšanas kļūdu'),
  text('Subtract in a story', 'Atņem stāsta uzdevumā'),
  text('Revisit subtraction strategies', 'Atkārto atņemšanas paņēmienus'),
];

function subtraction(stage, slot, locale, key) {
  const lv = locale === 'lv';
  const small = [[5, 1], [6, 2], [7, 3], [8, 2], [9, 3], [7, 2], [10, 4], [9, 2], [8, 3], [10, 3]];
  let [a, b] = small[slot];
  if (stage === 2) { a = 11 + slot; b = a - 10; }
  if (stage === 3) { a = 11 + slot % 8; b = a - 10 + 1 + slot % 3; }
  if (stage >= 4) { a = 12 + slot + (stage >= 8 ? 5 : 0); b = 2 + slot * 3 % 7; }
  const result = a - b;
  const hint = stage === 2
    ? text(`Split ${a} into 10 and ${b}. Take away ${b}.`, `Sadali ${a} skaitļos 10 un ${b}. Atņem ${b}.`)
    : stage === 3
      ? text(`Take away ${a - 10} to reach 10, then take away the remaining ${b - (a - 10)}.`, `Atņem ${a - 10}, lai iegūtu 10, tad atņem atlikušos ${b - (a - 10)}.`)
      : text(`Start with ${a}. Remove ${b} and count what remains.`, `Sāc ar ${a}. Atņem ${b} un saskaiti atlikušo.`);
  const base = { topic: 'subtraction', hint: hint[locale], explanation: `${a} − ${b} = ${result}.` };
  if (stage === 4 || stage === 9 && slot % 3 === 1) return { ...base, type: 'balance',
    question: lv ? 'Cik tika atņemts?' : 'How many were taken away?',
    hint: lv ? `No ${result} skaiti līdz ${a}.` : `Count from ${result} up to ${a}.`, correctIndex: 0,
    payload: { leftDisplay: `${a} − ?`, rightValue: result, choices: numberChoices(b, key) } };
  if (stage === 6) return { ...base, type: 'true_false', isTrue: true,
    question: lv ? 'Vai atņemšanas vienādība ir pareiza?' : 'Is this subtraction equation correct?',
    payload: { statement: `${a} − ${b} = ${result}` } };
  if (stage === 7) return { ...base, type: 'fix_mistake', correctIndex: 0,
    question: lv ? 'Kura atbilde izlabo atņemšanas kļūdu?' : 'Which answer repairs the subtraction?',
    payload: { wrongWork: [`${a} − ${b} = ${result + (slot % 2 ? 1 : -1)}`],
      choices: numberChoices(result, key).map(n => `${a} − ${b} = ${n}`) } };
  if (stage === 1 || [2, 3, 9].includes(stage) && slot % 2 === 1) return { ...base, type: 'number_line',
    question: lv ? `Sāc pie ${a} un pārvietojies ${b} soļus atpakaļ.` : `Start at ${a} and move back ${b}.`,
    payload: { start: a, jump: -b, min: 0, max: stage === 1 ? 10 : Math.max(20, a + 1), correctValue: result } };
  return { ...base, type: 'multiple_choice', correctIndex: 0, choices: numberChoices(result, key),
    question: stage === 5
      ? (lv ? `Vienā kastē ir ${a} zvaigznes, otrā ${b}. Par cik zvaigznēm pirmajā kastē ir vairāk?` : `One box has ${a} stars and another has ${b}. How many more are in the first box?`)
      : (lv ? `Ir ${a} papīra zvaigznes. ${b} pielīmē kartītei. Cik paliek?` : `There are ${a} paper stars. Use ${b} on a card. How many remain?`),
    ...(stage === 5 ? { hint: lv ? `Atņem mazāko daudzumu ${b} no lielākā ${a}.` : `Subtract the smaller amount ${b} from the larger amount ${a}.` }
      : a <= 20 ? { taskVisual: { kind: 'take_away', left: a, right: b, object: 'star' } } : {}) };
}

function reviseAdditionChallenge(puzzle, stage, locale) {
  const lv = locale === 'lv';
  if (stage < 5) {
    const spec = arithmetic(stage, 6, false, locale);
    // The first application stays with joining visible groups, not inverse pair search.
    if (stage === 0) Object.assign(spec, { question: lv ? 'Apvieno 5 lentes un vēl 2 lentes. Cik kopā?' : 'Join 5 ribbons and 2 more ribbons. How many altogether?',
      choices: ['7', '6', '8'], hint: lv ? 'Saskaiti lentes abās grupās.' : 'Count the ribbons in both groups.',
      explanation: '5 + 2 = 7.', taskVisual: { kind: 'join', left: 5, right: 2, object: 'ribbon' } });
    replaceTask(puzzle, spec);
  } else {
    const target = stage + 6;
    replaceTask(puzzle, { type: 'find_all_pairs', topic: 'addition',
      question: lv ? `Atrodi visus pārus, kuru summa ir ${target}.` : `Find every pair adding to ${target}.`,
      hint: lv ? 'Izvēlies vienu skaitli un atrodi trūkstošo daļu. Meklē arī otru pāri.' : 'Choose one number and find its missing part. Look for the other pair too.',
      explanation: `3 + ${target - 3} = ${target}; 4 + ${target - 4} = ${target}.`,
      payload: { numbers: [3, target - 4, 4, target - 3], target } });
  }
}

const gcd = (a, b) => b ? gcd(b, a % b) : a;

function reviseEquivalent(puzzle, stage, ordinal, locale) {
  const lv = locale === 'lv', easy = puzzle.difficulty === 'easy';
  let { numerator: n, denominator: d } = puzzle.payload;
  // Preserve the first repartitioning lesson, then alternate scaling and simplifying.
  const simplify = !easy && stage >= 3 && (stage + ordinal) % 2 === 0;
  const factor = easy && stage <= 5 || !easy && stage < 2 ? 2
    : easy && stage === 6 ? 3
      : puzzle.difficulty === 'medium' && stage < 4 ? 2 + (stage + ordinal) % 2
        : 2 + (stage + Math.floor(ordinal / 3)) % 3;
  let answerN, answerD;
  if (simplify) {
    const common = gcd(n, d); n /= common; d /= common;
    answerN = n; answerD = d; n *= factor; d *= factor;
  } else { answerN = n * factor; answerD = d * factor; }
  const answer = `${answerN}/${answerD}`;
  const wrong = simplify ? [`${answerN}/${d}`, `${n}/${answerD}`] : [`${n}/${answerD}`, `${answerN}/${d}`];
  const choices = [answer, ...wrong];
  const shift = hash(puzzle.id) % 3;
  const rotated = [...choices.slice(shift), ...choices.slice(0, shift)];
  replaceTask(puzzle, { type: 'fraction_equivalent', topic: 'fractions', correctIndex: rotated.indexOf(answer),
    question: simplify ? (lv ? 'Saīsini daļu. Kura daļa ir tikpat liela?' : 'Simplify the fraction. Which fraction has the same value?')
      : (lv ? 'Kura daļa ir tikpat liela?' : 'Which fraction has the same value?'),
    hint: simplify
      ? (lv ? `Dali gan skaitītāju, gan saucēju ar ${factor}.` : `Divide both the numerator and denominator by ${factor}.`)
      : (lv ? `Sadali katru daļu ${factor} vienādās daļās. Reizini gan skaitītāju, gan saucēju ar ${factor}.` : `Split each part into ${factor} equal pieces. Multiply both the numerator and denominator by ${factor}.`),
    explanation: `${n}/${d} = ${answerN}/${answerD}.`, payload: { numerator: n, denominator: d, choices: rotated } });
}

function reviseFractionCompare(puzzle, stage, ordinal, locale) {
  const lv = locale === 'lv';
  if (puzzle.difficulty === 'easy' && stage < 7 || puzzle.difficulty === 'medium' && stage < 2) return;
  let a, b, hint;
  if (puzzle.difficulty === 'easy' || stage < 4) {
    const numerator = 1 + (stage + ordinal) % 3, denominator = numerator + 2 + stage % 3;
    a = [numerator, denominator]; b = [numerator, denominator + 1];
    hint = text('The wholes are equal. With the same number of pieces, fewer pieces in the whole means larger pieces.', 'Veselie ir vienādi. Ja ņemts vienāds daļu skaits, tad mazāks saucējs nozīmē lielākas daļas.');
  } else if (stage < 6) {
    const denominator = 5 + (stage + ordinal) % 4, numerator = Math.floor(denominator / 2) + 1;
    a = [numerator, denominator]; b = [1, 2];
    hint = text('Compare each amount with half of the same whole.', 'Salīdzini katru daudzumu ar pusi no tā paša veselā.');
  } else {
    // Related and unrelated denominators; the larger numerator is not a shortcut.
    const pairs = [[[2, 3], [3, 5]], [[3, 4], [5, 8]], [[3, 8], [2, 5]], [[4, 9], [3, 7]]];
    [a, b] = pairs[(stage + ordinal) % pairs.length];
    const common = a[1] * b[1] / gcd(a[1], b[1]);
    hint = text(`Use equal-sized wholes. Rewrite both fractions with denominator ${common}, then compare their numerators.`,
      `Izmanto vienāda lieluma veselos. Izsaki abas daļas ar saucēju ${common} un salīdzini skaitītājus.`);
  }
  const greater = a[0] * b[1] > b[0] * a[1];
  replaceTask(puzzle, { type: 'compare', topic: 'fractions', helpTemplate: 'fraction_equivalent', correctIndex: greater ? 0 : 1,
    question: lv ? 'Veselie ir vienāda lieluma. Kura daļa ir lielāka?' : 'The wholes are the same size. Which fraction is larger?',
    hint: hint[locale], explanation: `${(greater ? a : b).join('/')} > ${(greater ? b : a).join('/')}.`,
    payload: { optionA: a.join('/'), optionB: b.join('/') } });
}

function reviseFractionSorting(puzzle, stage, locale) {
  if (puzzle.difficulty === 'easy' && stage < 5) return;
  const early = puzzle.difficulty === 'easy' ? stage === 5 : stage < 2;
  const factors = early ? [1, 2] : puzzle.difficulty === 'easy' && stage < 8 || stage < 4
    ? puzzle.difficulty === 'hard' && stage === 2 ? [1, 2, 4] : [1, 2, 3] : [2, 3, 4];
  const d = puzzle.difficulty === 'easy' ? stage - 2 : 3 + stage;
  const targets = [[1, d], [d - 1, d]];
  // Keep the challenge on equivalence, with no new denominator operation.
  puzzle.payload = { rule: 'fractions', targets, fractions: factors.flatMap(k => targets.map(([n, den]) => [n * k, den * k])) };
  puzzle.question = locale === 'lv' ? `Sašķiro daļas pēc vērtības: 1/${d} vai ${d - 1}/${d}.` : `Sort the fractions by value: 1/${d} or ${d - 1}/${d}.`;
  puzzle.hint = locale === 'lv' ? 'Reizini vai dali skaitītāju un saucēju ar vienu un to pašu skaitli.' : 'Multiply or divide the numerator and denominator by the same number.';
  puzzle.explanation = `${1}/${d} = ${2}/${2 * d}; ${d - 1}/${d} = ${2 * (d - 1)}/${2 * d}.`;
}

function reviseEstimates(list, locale) {
  // Vary ones digits as well as answer rank: exact sums round up, down, or stay put.
  const examples = [[64, 65], [83, 91], [81, 27], [46, 32], [53, 47], [68, 56], [181, 182], [49, 46], [71, 72], [85, 86], [91, 92]];
  list.filter(p => p.type === 'estimate').forEach((puzzle, i) => {
    const [a, b] = examples[i % examples.length], sum = a + b, rounded = Math.round(sum / 10) * 10;
    const separately = Math.round(a / 10) * 10 + Math.round(b / 10) * 10;
    const rank = i % 3;
    const wrong = rank === 0 ? [rounded + 10, rounded + 20] : rank === 1 ? [rounded - 10, rounded + 10] : [rounded - 10, rounded - 20];
    if (separately !== rounded && !wrong.includes(separately)) wrong[0] = separately;
    const answers = [rounded, ...wrong], shift = Math.floor(i / 3) % 3;
    const ordered = [...answers.slice(shift), ...answers.slice(0, shift)];
    const lv = locale === 'lv';
    replaceTask(puzzle, { type: 'estimate', topic: 'estimation', correctIndex: ordered.indexOf(rounded),
      question: lv ? 'Saskaiti precīzi un tad noapaļo summu līdz tuvākajam desmitam.' : 'Add exactly, then round the total to the nearest ten.',
      hint: lv ? 'Nenoapaļo katru saskaitāmo atsevišķi. Summas vieni 0–4 noapaļo uz leju, 5–9 uz augšu.' : 'Do not round the two numbers separately. Round a total ending in 0–4 down and 5–9 up.',
      explanation: lv ? `${a} + ${b} = ${sum}. Noapaļojot līdz tuvākajam desmitam, iegūst ${rounded}.` : `${a} + ${b} = ${sum}. To the nearest ten, this is ${rounded}.`,
      payload: { expression: `${a} + ${b}`, choices: ordered.map(n => `${lv ? 'Aptuveni' : 'About'} ${n}`) } });
  });
}

function balanceTruthValues(list, locale) {
  const topics = [...new Set(list.filter(p => p.type === 'true_false' && !p.payload.hideStatement).map(p => p.topic))];
  for (const topic of topics) {
    const tasks = list.filter(p => p.type === 'true_false' && !p.payload.hideStatement && p.topic === topic);
    // A stable hash ordering avoids an alternating true/false sequence along the path.
    tasks.sort((a, b) => hash(`${a.id}/truth`) - hash(`${b.id}/truth`));
    tasks.forEach((puzzle, i) => {
      // The single drawer claim has its answer in the story; leave it intact.
      if (tasks.length < 2) return;
      const left = puzzle.payload.statement.split('=')[0].trim();
      const match = left.match(/^(\d+)(%)?\s*([−×])\s*(\d+)$/);
      if (!match) throw new Error(`Unsupported numeric claim: ${puzzle.id}`);
      const [, first, percent, operator, second] = match;
      const a = Number(first), b = Number(second);
      const result = operator === '−' ? a - b : a * b / (percent ? 100 : 1);
      const isTrue = i < Math.ceil(tasks.length / 2);
      const wrong = operator === '−' ? (i % 2 ? result + 1 : a + b)
        : percent ? (i % 2 ? result + 1 : b - result === result ? result - 1 : b - result)
          : (i % 2 ? result + a : a + b === result ? result + 1 : a + b);
      puzzle.isTrue = isTrue;
      puzzle.payload.statement = `${left} = ${isTrue ? result : wrong}`;
      puzzle.explanation = `${locale === 'lv' ? isTrue ? 'Pareizi' : 'Nepareizi' : isTrue ? 'True' : 'False'}. ${left} = ${result}.`;
    });
  }
}

export function applyProgressionRevisions({ puzzles, lessons, pathExtras }) {
  for (const locale of ['en', 'lv']) {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const list = puzzles[locale][difficulty], byId = new Map(list.map(p => [p.id, p]));
      for (const lesson of lessons.filter(l => l.difficulty === difficulty)) {
        const track = lessons.filter(l => l.difficulty === difficulty && l.topicId === lesson.topicId);
        const stage = track.indexOf(lesson);
        const ordered = ['practice', 'boss', 'challenge'].flatMap(kind => lesson.levels.filter(l => l.kind === kind).flatMap(l => l.puzzleIds));
        const ids = [...ordered, ...pathExtras[lesson.id]];
        if (difficulty === 'easy' && lesson.topicId === 'addition') {
          reviseAdditionChallenge(byId.get(ordered[7]), stage, locale);
        }
        if (difficulty === 'easy' && lesson.topicId === 'subtraction') {
          lesson.title = subtractionGoals[stage];
          lesson.description = text(`Practise: ${lesson.title.en.toLowerCase()}.`, `${lesson.title.lv}.`);
          ids.forEach((id, slot) => replaceTask(byId.get(id), subtraction(stage, slot, locale, id)));
        }
        if (lesson.topicId === 'fractions') ids.forEach((id, ordinal) => {
          const p = byId.get(id);
          if (p.type === 'fraction_equivalent') reviseEquivalent(p, stage, ordinal, locale);
          if (p.type === 'compare') reviseFractionCompare(p, stage, ordinal, locale);
          if (p.type === 'sort_buckets') reviseFractionSorting(p, stage, locale);
        });
      }
      reviseEstimates(list, locale);
      revisePairTiles(list);
      balanceTruthValues(list, locale);
      // New comparison content retains balanced sides and runtime choice shuffling.
      list.filter(p => p.type === 'compare').forEach((p, i) => {
        if (p.correctIndex !== i % 2) {
          [p.payload.optionA, p.payload.optionB] = [p.payload.optionB, p.payload.optionA];
          p.correctIndex = i % 2;
        }
      });
    }
  }
}
