/** Explicit lesson ranges replace unrelated random quantities in the foundation tracks. */
import { balanceTruthValues, revisePairTiles } from './progression-revisions.mjs';
import fs from 'node:fs';

const plans = JSON.parse(fs.readFileSync(new URL('../../data/puzzle-foundations.json', import.meta.url), 'utf8'));

const { easyTables: EASY_TABLES, mediumTables: MEDIUM_TABLES } = plans;

function replace(p, spec, locale, slot, constrained = false) {
  const { id, difficulty, ageRange, learning } = p;
  const localized = structuredClone(spec);
  for (const key of ['question', 'hint', 'explanation']) {
    if (typeof localized[key] === 'object') localized[key] = localized[key][locale];
  }
  if (difficulty === 'medium' && localized.type === 'multiple_choice' && ['addition', 'subtraction'].includes(localized.topic)) {
    // Keep each authored story while changing its quantities to the lesson's range.
    const values = localized.question.match(/\d+/g);
    let index = 0;
    localized.question = p.question.replace(/\d+/g, () => values[index++]);
    const [a, b] = values.map(Number), add = localized.topic === 'addition';
    localized.explanation = `${a} ${add ? '+' : '−'} ${b} = ${add ? a + b : a - b}.`;
  }
  if (localized.payload?.en) localized.payload = localized.payload[locale];
  const choices = localized.choices ?? localized.payload?.choices;
  if (choices && 'correctIndex' in localized) {
    const answer = choices[localized.correctIndex];
    let wrong = choices.filter((_, i) => i !== localized.correctIndex);
    if (!constrained && choices.every(c => /^\d+$/.test(c))) {
      const n = Number(answer), rank = slot % 3;
      wrong = rank === 0 ? [n + 1, n + 2] : rank === 1 ? [n - 1, n + 1] : [n - 1, n - 2];
      wrong = wrong.map(String);
    }
    const index = (slot + 1) % 3;
    wrong.splice(index, 0, answer);
    if (localized.choices) localized.choices = wrong;
    else localized.payload.choices = wrong;
    localized.correctIndex = index;
  }
  for (const key of Object.keys(p)) delete p[key];
  Object.assign(p, { id, difficulty, ageRange, ...localized, learning: { ...learning,
    representation: localized.taskVisual ? 'objects' : 'symbols',
    reasoningSteps: localized.type === 'operation_path' ? localized.payload.steps.length : 1 } });
}

function repair(api, topic, sequence) {
  const solution = [sequence[1], sequence[3]];
  const unused = Math.max(...sequence) + 1;
  return api.task('repair_pattern', topic,
    api.text('Repair both gaps. Use each tile at most once; leave the spare tiles.', 'Atjauno abas vietas. Katru kartīti izmanto ne vairāk kā vienreiz; atstāj liekās kartītes.'),
    { sequence: sequence.map((n, i) => i === 1 || i === 3 ? null : n), tiles: [solution[1], unused, solution[0], unused + 1], solution },
    api.text('Compare each number with the one before it.', 'Salīdzini katru skaitli ar iepriekšējo.'),
    api.text(`The order is ${sequence.join(', ')}.`, `Secība ir ${sequence.join(', ')}.`));
}

function numbers(api, stage, slot, type) {
  const limit = stage === 0 ? 10 : 20;
  const low = 1 + (stage * 3 + slot * 2) % (limit - 6);
  if (type === 'sort_buckets') {
    const boundary = stage === 0 ? 5 : 9 + stage;
    return api.task(type, 'comparison', api.text(`Sort every number: below ${boundary} or at least ${boundary}.`, `Sašķiro visus skaitļus: zem ${boundary} vai vismaz ${boundary}.`),
      { rule: 'range', numbers: [boundary + 1, boundary - 3, boundary, boundary - 1, boundary + 2, boundary - 4], boundary },
      api.text('Compare the amounts.', 'Salīdzini daudzumus.'), api.text('Every part fits the conditions.', 'Katra daļa atbilst nosacījumiem.'));
  }
  const index = { order_numbers: 0, compare: 1, multiple_choice: 2, number_line: 3 }[type];
  const spec = api.numberSet([low + 5, low, low + 3, low + 1])[index];
  if (type === 'number_line') {
    const start = stage === 0 ? 1 + slot % 4 : 5 + (stage + slot) % 8;
    const jump = stage === 0 ? 1 + slot % 2 : 2 + slot % 4;
    spec.payload = { start, jump, min: 0, max: limit, correctValue: start + jump };
    spec.explanation = api.text(`${start} + ${jump} = ${start + jump}.`, `${start} + ${jump} = ${start + jump}.`);
  }
  return spec;
}

function multiply(api, difficulty, stage, slot, type) {
  const easy = difficulty === 'easy', tables = (easy ? EASY_TABLES : MEDIUM_TABLES)[stage];
  const size = tables[slot % tables.length];
  // Ten distinct row counts in Medium; small visible groups in the first Easy lessons.
  let groups = easy ? stage < 2 ? 1 + slot : 2 + slot % 5 : 2 + slot;
  if (!easy) {
    const used = new Set();
    for (let i = 0; i <= slot; i++) {
      groups = 2 + i;
      const factor = tables[i % tables.length], key = () => [groups, factor].sort((a, b) => a - b).join(',');
      while (used.has(key())) groups++;
      used.add(key());
    }
  }
  if (type === 'repair_pattern') return repair(api, 'multiplication', Array.from({ length: 5 }, (_, i) => (i + 1 + stage % 5 + (stage === 9 ? 1 : 0)) * size));
  const index = easy && stage < 2 ? 0 : { multiple_choice: 0, function_machine: 1, true_false: 2, balance: 3 }[type];
  const spec = api.multiplySet(groups, size)[index];
  if (groups * size > 100) delete spec.taskVisual;
  if (easy && stage < 4 && spec.type === 'multiple_choice') spec.taskVisual = { kind: 'array', rows: groups, columns: size, object: 'mouse' };
  // Avoid the 2×2 case having addition and multiplication as identical numeric choices.
  if (spec.choices) spec.choices = [String(groups * size), String(groups * size - 1), String(groups * size + 1)];
  return spec;
}

function divide(api, stage, slot, type) {
  const sharing = type === 'fair_share' || type === 'repair_pattern';
  // The sharing board has room for five plates and a small pool of counters.
  const tables = sharing ? stage === 0 ? [2, 5] : [3, 4, 5] : MEDIUM_TABLES[stage];
  const people = tables[(stage + slot) % tables.length];
  const each = 2 + (stage + slot) % (sharing ? 5 : 9);
  const remainder = stage === 0 ? 0 : sharing ? 1 + (stage + slot) % (people - 1) : 0;
  const index = { fair_share: 0, multiple_choice: 1, function_machine: 2, fix_mistake: 3, repair_pattern: 0 }[type];
  return api.divideSet(people * each + remainder, people)[index];
}

function arithmetic(api, topic, stage, slot, type) {
  if (topic === 'addition') {
    const a = (stage < 4 ? 20 : 40) + slot * 3 + stage;
    const b = (stage < 4 ? 12 : 25) + (slot * 2 + stage) % 16;
    if (type === 'find_all_pairs') {
      const target = stage < 4 ? 45 + stage : 85 + stage;
      return api.task(type, 'addition', api.text(`Find every pair adding to ${target}. A tile may be used in different pairs.`, `Atrodi visus pārus, kuru summa ir ${target}. Kartīti drīkst izmantot dažādos pāros.`),
        { target, numbers: [12, target - 17, 23, target - 12, 17, target - 23] },
        api.text('Choose one number and find its missing partner.', 'Izvēlies skaitli un atrodi tā trūkstošo pārinieku.'),
        api.text('Every part fits the conditions.', 'Katra daļa atbilst nosacījumiem.'), { helpTemplate: 'all_pairs' });
    }
    return api.addSet(a, b)[{ multiple_choice: 0, balance: 1, pair_sum: 2, fix_mistake: 3 }[type]];
  }
  const a = 45 + stage * 3 + slot * 2, b = 12 + (stage + slot * 3) % 27;
  if (type === 'repair_pattern') return repair(api, 'subtraction', Array.from({ length: 5 }, (_, i) => a - i * (2 + stage % 4)));
  return api.subtractSet(a, b)[{ multiple_choice: 0, number_line: 1, true_false: 2, fix_mistake: 3 }[type]];
}

function operations(api, stage, slot, type) {
  const { text, task } = api;
  if (stage >= 6 && type !== 'route_grid') {
    const divisor = [2, 3, 4, 5][(stage + slot) % 4], quotient = 4 + slot % 7;
    return api.operationSet(divisor * quotient, divisor, 3 + stage + slot % 5, true)[{ operation_path: 0, target_build: 1, function_machine: 2, compare: 3 }[type]];
  }
  // First follow two additions/subtractions; introduce multiplication before division.
  const a = 7 + stage + slot, b = 2 + (stage + slot) % 4, c = 1 + (stage + slot) % 3;
  const first = stage < 3 ? '+' : stage < 5 ? '×' : '÷';
  const start = first === '÷' ? a * b : a;
  const intermediate = first === '+' ? start + b : first === '×' ? start * b : a;
  const last = stage < 3 ? '-' : '+';
  const result = last === '-' ? intermediate - c : intermediate + c;
  const displayLast = last === '-' ? '−' : '+';
  const explanation = text(`${start} ${first} ${b} = ${intermediate}; ${intermediate} ${displayLast} ${c} = ${result}.`, `${start} ${first} ${b} = ${intermediate}; ${intermediate} ${displayLast} ${c} = ${result}.`);
  if (type === 'route_grid') {
    // A short route practises the lesson's operations before a maze adds navigation.
    if (stage < 3) type = 'operation_path';
    else {
      const target = result + 2;
      return task(type, 'operations', text(`Reach the bottom-right exit with ${target} in exactly 3 moves. Start with ${start}.`, `Sasniedz apakšējo labo izeju ar ${target} tieši 3 soļos. Sāc ar ${start}.`),
        { columns: 3, start, target, moves: 3, cells: [null, { operator: first, operand: b }, { operator: last, operand: c }, { operator: '-', operand: 1 }, { operator: '+', operand: 7 }, { operator: '+', operand: 2 }] },
        text('Try a step, then check where it takes you.', 'Izmēģini soli un pārbaudi, kur tas aizved.'), text('Every part fits the conditions.', 'Katra daļa atbilst nosacījumiem.'));
    }
  }
  if (type === 'operation_path') return task(type, 'operations', text('Choose two operations to finish this delivery route.', 'Izvēlies divas darbības, lai pabeigtu piegādes ceļu.'),
    { start, target: result, steps: [{ operand: b, operator: first }, { operand: c, operator: last }] },
    text('Try a step, then check where it takes you.', 'Izmēģini soli un pārbaudi, kur tas aizved.'), explanation);
  if (type === 'target_build') return task(type, 'operations', text('Which operations make the target? Keep the numbers in order.', 'Kuras darbības ļauj iegūt mērķa skaitli? Saglabā skaitļu secību.'),
    { numbers: [start, b, c], target: result, solution: [first, last] },
    text('Try a step, then check where it takes you.', 'Izmēģini soli un pārbaudi, kur tas aizved.'), explanation);
  if (type === 'function_machine') return task(type, 'operations', text('Select the rule that turns input into output.', 'Izvēlies likumu, kas ievadi pārvērš izvadē.'),
    { input: start, output: result, choices: [`${first}${b}${displayLast}${c}`, `${first}${b}`, `+${b + c + 1}`] },
    text('Test the whole rule, in the order shown.', 'Pārbaudi visu likumu norādītajā secībā.'), explanation, { correctIndex: 0 });
  return task('compare', 'comparison', text('Which expression has the greater value?', 'Kurai izteiksmei ir lielāka vērtība?'),
    { optionA: `${start} ${first} ${b} ${displayLast} ${c}`, optionB: `${result - 1} + 2` },
    text('Compare the amounts.', 'Salīdzini daudzumus.'), text(`${result} < ${result + 1}.`, `${result} < ${result + 1}.`), { correctIndex: 1 });
}

export function applyFoundationProgression(api) {
  const { puzzles, lessons, pathExtras } = api;
  for (const locale of ['en', 'lv']) for (const difficulty of ['easy', 'medium']) {
    const list = puzzles[locale][difficulty], byId = new Map(list.map(p => [p.id, p]));
    for (const lesson of lessons.filter(l => l.difficulty === difficulty)) {
      const track = lessons.filter(l => l.difficulty === difficulty && l.topicId === lesson.topicId), stage = track.indexOf(lesson);
      const ids = [...['practice', 'boss', 'challenge'].flatMap(kind => lesson.levels.filter(l => l.kind === kind).flatMap(l => l.puzzleIds)), ...pathExtras[lesson.id]];
      ids.forEach((id, slot) => {
        const p = byId.get(id), topic = lesson.topicId;
        // Finale quantities are part of the authored story. Keep those applications.
        if (stage === 9 && slot >= 4 && slot <= 6) return;
        let spec, constrained = false;
        if (difficulty === 'easy' && topic === 'numbers') { spec = numbers(api, stage, slot, p.type); constrained = p.type === 'multiple_choice'; }
        if (topic === 'multiplication') spec = multiply(api, difficulty, stage, slot, p.type);
        if (difficulty === 'medium' && topic === 'division') spec = divide(api, stage, slot, p.type);
        if (difficulty === 'medium' && ['addition', 'subtraction'].includes(topic) && p.type !== 'place_value') spec = arithmetic(api, topic, stage, slot, p.type);
        if (difficulty === 'medium' && topic === 'operations') spec = operations(api, stage, slot, p.type);
        if (difficulty === 'easy' && topic === 'patterns') {
          const [up, other] = stage < 2 ? [1, 2] : stage < 5 ? [2, 3] : stage < 8 ? [2, 5] : [5, 10];
          if (p.type === 'repair_pattern') spec = repair(api, 'patterns', Array.from({ length: 5 }, (_, i) => 1 + stage + i * up));
          else {
            const index = p.type === 'pattern_next' ? slot === 3 ? 3 : 0 : p.type === 'function_machine' ? 1 : 2;
            spec = api.patternSet([[1 + slot, '+', up], [3 + slot, '+', other], [up * 5 + slot, '−', up], [other * 5 + slot, '−', other]])[index];
          }
        }
        if (spec) replace(p, spec, locale, stage + slot, constrained);
      });
    }
    revisePairTiles(list);
    balanceTruthValues(list, locale);
    list.filter(p => p.type === 'compare').forEach((p, i) => {
      if (p.correctIndex !== i % 2) { [p.payload.optionA, p.payload.optionB] = [p.payload.optionB, p.payload.optionA]; p.correctIndex = i % 2; }
    });
    // Include the story finale, whose numeric distractors also passed through rank balancing.
    for (const p of list.filter(p => p.type === 'multiple_choice' && p.helpTemplate === 'number_range' && p.topic === 'comparison')) {
      const [lower, upper] = p.question.match(/\d+/g).map(Number), answer = p.choices[p.correctIndex];
      const choices = [String(lower), String(upper)]; choices.splice(p.correctIndex, 0, answer); p.choices = choices;
    }
  }
}
