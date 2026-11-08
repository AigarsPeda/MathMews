import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPuzzles } from './catalog.mjs';
const topics = ['time', 'data', 'spatial', 'money', 'capacity'];
const tiers = ['easy', 'medium', 'hard'];
const sum = xs => xs.reduce((a, b) => a + b, 0);
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const clock = n => { const m = (n % 1440 + 1440) % 1440; return `${Math.floor(m / 60)}`.padStart(2, '0') + ':' + `${m % 60}`.padStart(2, '0'); };

/** Independently solve diagram givens, without using the answer key or generator. */
export function solveEveryday(model, question) {
  switch (model.kind) {
    case 'clock':
      if (model.task === 'read') return clock(model.minutes);
      if (model.task === 'finish') return clock(model.minutes + model.duration);
      if (model.task === 'start') return clock(model.minutes - model.duration);
      return ((model.end - model.minutes + 1440) % 1440) / (question.includes('hours pass') ? 60 : 1);
    case 'bars': {
      const v = model.values;
      if (['read', 'missing'].includes(model.task)) return model.task === 'missing' ? model.total - sum(v.filter((_, i) => i !== model.index)) : v[model.index];
      if (model.task === 'most') return 'ABC'[v.indexOf(Math.max(...v))];
      if (model.task === 'least') return 'ABC'[v.indexOf(Math.min(...v))];
      if (model.task === 'total') return sum(v);
      if (model.task === 'difference') return Math.abs(v[0] - v[1]);
      if (model.task === 'range') return Math.max(...v) - Math.min(...v);
      return sum(v) / v.length;
    }
    case 'shapes': return model.task === 'symmetry' && model.rectangle ? 2 : sum(model.sides);
    case 'grid': {
      let row = Math.floor((model.start - 1) / model.size), col = (model.start - 1) % model.size;
      if (model.task === 'reflect') col = model.size - 1 - col;
      if (model.task === 'translate') { row += model.dy; col += model.dx; }
      if (model.task === 'rotate') {
        const centre = (model.size - 1) / 2, a = model.turns * Math.PI / 2;
        const x = col - centre, y = row - centre;
        col = Math.round(centre + x * Math.cos(a) - y * Math.sin(a));
        row = Math.round(centre + x * Math.sin(a) + y * Math.cos(a));
      }
      assert.ok(row >= 0 && row < model.size && col >= 0 && col < model.size, 'Transformation stays on the board');
      return row * model.size + col + 1;
    }
    case 'money': {
      const cost = sum(model.prices.map((price, i) => price * model.quantities[i])) * (1 - model.discount / 100);
      if (model.task === 'afford') return Math.floor(model.paid / model.prices[0]);
      const cents = model.task === 'change' ? model.paid - cost : model.task === 'unit' ? model.prices[0] / model.quantities[0] : cost;
      return Math.round(cents) / (model.unit === 'cents' ? 1 : 100);
    }
    case 'capacity': {
      if (model.task === 'read') return model.amounts[0];
      if (model.task === 'total') return sum(model.amounts);
      if (model.task === 'space') return model.capacities[0] - model.amounts[0];
      if (model.task === 'litres') return model.amounts[0] / 1000;
      const liquid = model.amounts[0], cup = model.portion;
      let count = 0, used = 0;
      while (used + cup <= liquid) { count++; used += cup; }
      return model.task === 'containers' && used < liquid ? count + 1 : count;
    }
    case 'solid': return model.width * model.height * model.depth;
    default: assert.fail(`Unsupported diagram ${model.kind}`);
  }
}
function checkModel(m) {
  assert.ok(m.label.length > 0);
  assert.doesNotMatch(JSON.stringify(m), /NaN|undefined|Infinity/);
  if (m.kind === 'clock') assert.ok(m.minutes >= 0 && m.minutes < 1440);
  if (m.kind === 'bars') {
    assert.ok(m.values.every(v => v > 0 && Number.isInteger(v / m.step)), 'Bars align with readable ticks');
    assert.ok(Math.max(...m.values) / m.step <= 14, 'Chart has a bounded number of ticks');
    if (m.task === 'missing') assert.equal(m.total, sum(m.values));
  }
  if (m.kind === 'capacity') assert.ok(m.amounts.every((v, i) => v >= 0 && v <= m.capacities[i]), 'Liquid fits its vessel');
}
function checkChoice(p, expected, locale) {
  const answer = typeof expected === 'number' ? String(expected).replace('.', locale === 'en' ? '.' : ',') : expected;
  assert.equal(p.choices[p.correctIndex], answer, `${p.id ?? p.prompt.en}: independent diagram solution`);
  assert.equal(new Set(p.choices).size, 3);
  assert.equal(p.choices.filter(c => c === answer).length, 1);
}
export function checkEverydayTopics() {
  const catalog = read('data/puzzle-curriculum.json'), extras = read('data/puzzle-path-extras.json');
  const all = tiers.flatMap(tier => readPuzzles('en', tier)), byId = new Map(all.map(p => [p.id, p]));
  const added = all.filter(p => topics.includes(p.topic));
  assert.equal(added.length, 1500);
  const registrations = fs.readFileSync('supabase/migrations/20261107230000_everyday_puzzle_catalog.sql', 'utf8');
  const timedRows = new Map([...registrations.matchAll(/\('([^']+-step-8)',array\[([^\]]+)\]\)/g)]
    .map(([, id, values]) => [id, [...values.matchAll(/'([^']+)'/g)].map(match => match[1])]));
  assert.equal(timedRows.size, 150, 'Register every new timed session');
  for (const topic of topics) for (const tier of tiers) {
    const lessons = catalog.lessons.filter(l => l.topicId === topic && l.difficulty === tier);
    assert.equal(lessons.length, 10);
    for (const l of lessons) {
      const puzzles = [...l.levels.flatMap(level => level.puzzleIds), ...extras[l.id]].map(id => byId.get(id));
      assert.equal(puzzles.length, 10);
      assert.equal(puzzles.filter(p => p.learning.role === 'review').length, 2);
      assert.equal(l.levels.filter(level => level.kind === 'challenge').length, 1);
      assert.ok(puzzles.every(p => p.topic === topic && p.difficulty === tier));
      assert.deepEqual(timedRows.get(`${l.id}-step-8`), puzzles.slice(7).map(p => p.id), 'Server run matches the final three path puzzles');
      const givens = new Set(puzzles.map(p => JSON.stringify(p.everyday.model)));
      assert.ok(givens.size >= 5, `${l.id}: varied givens across the session`);
    }
  }
  for (const locale of ['en', 'lv', 'ru']) for (const tier of tiers) for (const p of readPuzzles(locale, tier).filter(p => p.everyday)) {
    const english = byId.get(p.id);
    checkModel(p.everyday.model);
    checkModel(p.everyday.example.model);
    assert.notDeepEqual(p.everyday.model, p.everyday.example.model, `${p.id}: help uses different givens`);
    const target = solveEveryday(p.everyday.model, english.question);
    checkChoice(p, target, locale);
    const exampleTarget = solveEveryday(p.everyday.example.model, english.everyday.example.question);
    const expectedText = typeof exampleTarget === 'number' ? String(exampleTarget).replace('.', locale === 'en' ? '.' : ',') : exampleTarget;
    assert.ok(p.everyday.example.explanation.includes(expectedText), `${p.id}: worked example explains its own answer`);
  }
  for (const variants of Object.values(read('data/everyday-reviews.json'))) for (const q of variants) {
    const target = solveEveryday(q.model, q.prompt.en);
    for (const locale of ['en', 'lv', 'ru']) checkChoice({ ...q, choices: q.choices.map(c => c[locale]) }, target, locale);
  }
  // Boundary cases catch the classic unit and wrapping errors independently of generated examples.
  assert.equal(solveEveryday({kind:'clock',task:'finish',minutes:1430,duration:45}, ''), '00:35');
  assert.equal(solveEveryday({kind:'clock',task:'start',minutes:10,duration:30}, ''), '23:40');
  assert.equal(solveEveryday({kind:'capacity',task:'servings',amounts:[501],portion:250}, ''), 2);
  assert.equal(solveEveryday({kind:'capacity',task:'containers',amounts:[501],portion:250}, ''), 3);
  assert.equal(solveEveryday({kind:'money',task:'change',prices:[125,175],quantities:[1,1],paid:500,discount:0,unit:'euros'}, ''), 2);
  console.log('Verified 150 new levels, 1,500 diagram tasks in three languages, separate worked examples, 1,800 daily variants, time wrapping, currency units and container rounding.');
}
if (process.argv[1]?.endsWith('check-everyday-topics.mjs')) checkEverydayTopics();
