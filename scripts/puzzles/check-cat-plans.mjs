import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPuzzles } from './catalog.mjs';
import { solveEveryday } from './check-everyday-topics.mjs';

export function checkCatPlans() {
  const catalog = JSON.parse(fs.readFileSync('data/puzzle-curriculum.json'));
  const extras = JSON.parse(fs.readFileSync('data/puzzle-path-extras.json'));
  const migration = fs.readFileSync('supabase/migrations/20261108010000_cat_plans.sql', 'utf8');
  const rewards = new Map([...migration.matchAll(/\('([^']+)',(\d+),(\d+)\)/g)].map(([, id, first, replay]) => [id, [+first, +replay]]));
  assert.equal(rewards.size, 90, 'Register all new tasks without changing existing coin grants');
  const timed = new Map([...migration.matchAll(/\('([^']+-step-8)',array\[([^\]]+)\]\)/g)]
    .map(([, id, values]) => [id, [...values.matchAll(/'([^']+)'/g)].map(match => match[1])]));
  assert.equal(timed.size, 9);
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const lessons = catalog.lessons.filter(l => l.topicId === 'cat-plans' && l.difficulty === difficulty);
    assert.deepEqual(lessons.map(l => l.id), ['picnic', 'reading-corner', 'cat-party'].map(id => `${difficulty}-cat-plans-${id}`));
    const expectedReward = { easy: [4, 2], medium: [7, 3], hard: [9, 4] }[difficulty];
    for (const locale of ['en', 'lv', 'ru']) {
      const puzzles = new Map(readPuzzles(locale, difficulty).map(p => [p.id, p]));
      for (const lesson of lessons) {
        assert.ok(lesson.completion[locale] && lesson.description[locale]);
        assert.ok(lesson.levels.every(level => level.kind !== 'boss' && !level.story));
        const ids = [...lesson.levels.flatMap(l => l.puzzleIds), ...extras[lesson.id]];
        assert.equal(new Set(ids).size, 10);
        assert.deepEqual(timed.get(lesson.levels[7].id), ids.slice(7), 'The final three tasks share one durable timer');
        for (const id of ids) {
          const p = puzzles.get(id);
          assert.ok(p.question.startsWith(lesson.title[locale]), 'Each task keeps the practical goal in view');
          assert.deepEqual(rewards.get(id), expectedReward);
          const answer = solveEveryday(p.everyday.model, p.question);
          assert.equal(p.choices[p.correctIndex], String(answer).replace('.', locale === 'en' ? '.' : ','), `${id}/${locale}: solve the givens independently`);
          assert.equal(new Set(p.choices).size, 3);
          assert.notDeepEqual(p.everyday.model, p.everyday.example.model, 'Worked help must use its own quantities');
          const model = p.everyday.model;
          if (model.kind === 'money') {
            const names = JSON.parse(fs.readFileSync(`locales/${locale}.json`)).everyday.shopItems;
            for (const shown of [model, p.everyday.example.model]) {
              assert.equal(shown.items.length, shown.prices.length, 'Every price belongs to a pictured, named item');
              shown.items.forEach((item, i) => assert.ok(shown.label.includes(`${names[item]}: €${shown.prices[i] / 100}`), 'Screen readers get the same item-price pairing'));
            }
            if (model.task === 'total') assert.doesNotMatch(model.label, /Budget|Budžets|Бюджет/, 'An addition task has no irrelevant budget');
          }
          if (model.kind === 'clock') assert.ok(p.question.includes(String(model.duration)), 'Preparation duration must be visible, not only in hidden diagram data');
          if (model.kind === 'money' && ['afford', 'change'].includes(model.task)) assert.ok(p.question.includes(`€${model.paid / 100}`), 'Shopping budget must be visible');
          if (model.kind === 'capacity') assert.equal(model.unit, 'ml', 'Container givens are displayed in millilitres');
          if (model.kind === 'bars') {
            assert.equal(model.subject, 'cats', 'Guest charts count cats rather than toys');
            for (const value of model.values) assert.ok(model.label.includes(String(value)), 'Screen readers receive every bar value');
          }
        }
      }
    }
  }
  const runtimeFiles = ['app/puzzles.tsx', 'app/settings/index.tsx', 'app/play.tsx', 'components/economy/GameHeaderStats.tsx', 'components/puzzle/ResultOverlay.tsx'];
  for (const file of runtimeFiles) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /AchievementsLink|AchievementMovie|LearningMilestonePerformance|BossStoryScene|\/achievements/,
    `${file}: no retired reward or boss entry point`);
  assert.match(fs.readFileSync('app/achievements.tsx', 'utf8'), /<Redirect href="\/puzzles"/);
  console.log('Verified three cat plans per difficulty, 90 independently solved tasks, three-language goals, distinct worked examples, normal coins, timer registrations and retired reward entry points.');
}
if (process.argv[1]?.endsWith('check-cat-plans.mjs')) checkCatPlans();
