/** Behavioral checks for authored content, persistent rewards, care, and room scenes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = process.cwd(), cache = new Map(), stored = new Map();
const storage = {
  getItem: async key => stored.get(key) ?? null,
  multiSet: async entries => { for (const [key, value] of entries) stored.set(key, value); },
  multiRemove: async keys => { keys.forEach(key => stored.delete(key)); },
};
function load(id) {
  if (id === 'react') return {};
  if (id === 'react-native') return { Dimensions: { get: () => ({ width: 390, height: 844 }) }, PixelRatio: { roundToNearestPixel: n => n } };
  if (id === '@react-native-async-storage/async-storage') return storage;
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  if (/\.(png|webp|mp4)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8')); return module.exports; }
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: load, Date, Math, Set, Map });
  return module.exports;
}
const { getPuzzlesByDifficulty } = load('@/constants/puzzles');
const { checkPuzzleAnswer } = load('@/utils/puzzle-type');
const { shufflePuzzleChoices } = load("@/utils/puzzle-practice");
const { getVisualExplanation } = load('@/constants/visual-explanations');
let count = 0;
for (const tier of ['easy', 'medium', 'hard']) {
  const en = getPuzzlesByDifficulty('en', tier), lv = getPuzzlesByDifficulty('lv', tier);
  assert.deepEqual(en.map(p => p.id), lv.map(p => p.id), 'Locale IDs and progression must agree');
  for (let i = 0; i < en.length; i++) for (const field of ['question', 'hint', 'explanation']) {
    if (/[A-Za-z]{3}/.test(en[i][field])) assert.notEqual(en[i][field], lv[i][field], `${lv[i].id}: ${field} must be localized`);
  }
  for (const locale of ['en', 'lv']) for (const p of getPuzzlesByDifficulty(locale, tier)) {
    count++;
    assert.equal(p.difficulty, tier); assert.ok(p.question && p.hint && p.explanation);
    let answer;
    switch (p.type) {
      case 'target_build': answer = { kind: 'operators', operators: p.payload.solution }; break;
      case 'operation_path': answer = { kind: 'operators', operators: p.payload.steps.map(step => step.operator) }; break;
      case 'fraction_build': answer = { kind: 'fraction', shaded: p.payload.numerator }; assert.ok(p.payload.numerator <= p.payload.denominator); break;
      case 'number_line': answer = { kind: 'value', value: p.payload.correctValue }; assert.equal(p.payload.start + p.payload.jump, p.payload.correctValue); break;
      case 'pair_sum': answer = { kind: 'pair', indices: p.payload.correctIndices }; break;
      case 'order_numbers': answer = { kind: 'order', numbers: p.payload.correctOrder }; assert.deepEqual([...p.payload.numbers].sort((a,b)=>a-b), [...p.payload.correctOrder].sort((a,b)=>a-b)); break;
      case 'fraction_match': answer = { kind: 'fraction_match', matchedCount: p.payload.pairs.length }; break;
      case 'true_false': answer = { kind: 'choice', index: p.isTrue ? 0 : 1 }; break;
      default: answer = { kind: 'choice', index: p.correctIndex }; if(p.type !== 'compare') { const choices = p.choices ?? p.payload.choices; assert.ok(answer.index >= 0 && answer.index < choices.length); }
    }
    assert.equal(checkPuzzleAnswer(p, answer), true, `${locale}/${p.id}: authored answer must be accepted`);
    for (let seed = 0; seed < 6; seed++) {
      const variant = shufflePuzzleChoices(p, `${p.id}-${seed}`);
      if ('correctIndex' in variant) assert.equal(checkPuzzleAnswer(variant, { kind: 'choice', index: variant.correctIndex }), true);
    }
    const help = getVisualExplanation(p);
    assert.equal(help.puzzleId, p.id); assert.equal(help.keyframes.at(-1).captionKey, p.explanation);
    const checkNumbers = value => { if (typeof value === 'number') assert.ok(Number.isFinite(value), `${p.id}: visual values must be finite`); else if (value && typeof value === 'object') Object.values(value).forEach(checkNumbers); };
    checkNumbers(help);
  }
}
const { createDefaultGameSave, parseGameSaveFromValue, saveGameSave, loadGameSave, clearGameSave } = load('@/utils/game-storage');
const { applyPuzzleAnswer, applyFeed, getSolvedCounts } = load('@/utils/game-operations');
const { recordTopicAttempt, normalizeTopicStats, buildTopicStatsRows, findToughestTopicRows } = load('@/utils/topic-stats');
let improving = { addition: { correct: 0, wrong: 100 } };
for (let i = 0; i < 12; i++) improving = recordTopicAttempt(improving, 'addition', true);
const recentRow = buildTopicStatsRows(improving)[0];
assert.equal(recentRow.recentAttempts, 10); assert.equal(recentRow.recentAccuracy, 1, 'Recent mastery reflects improvement despite old mistakes');
assert.equal(normalizeTopicStats(improving).addition.recent.length, 10);
assert.equal(findToughestTopicRows([recentRow]).length, 0, "Old mistakes do not permanently flag an improved topic");
const { applyPetTimeDecay } = load('@/utils/pet-care');
const { withCoinDelta } = load('@/utils/coin-ledger');
const { captureRoomLayout, switchRoomLayout } = load('@/utils/room-layout');
const start = createDefaultGameSave(), now = Date.now(), puzzle = getPuzzlesByDifficulty('en', 'easy')[0];
const first = applyPuzzleAnswer(start, puzzle, true, 'first', now);
assert.equal(first.coins, 4); assert.equal(first.save.wallet.coins, start.wallet.coins + 4);
assert.equal(first.save.progress.puzzlesSolved.easy, 1); assert.ok(first.save.progress.completedPuzzleIds.includes(puzzle.id));
assert.equal(first.save.coinTransactions.at(-1).amount, 4);
assert.equal(applyPuzzleAnswer(first.save, puzzle, true, 'first', now).save, first.save, 'A double tap cannot award twice');
const persisted = parseGameSaveFromValue(JSON.stringify(first.save)).save;
assert.equal(applyPuzzleAnswer(persisted, puzzle, true, 'reopened', now).coins, 2, 'Closing before Continue retains first-clear completion');
const wrong = applyPuzzleAnswer({ ...start, pet: { ...start.pet, lastCareAt: now }, progress: { ...start.progress, lives: { current: 0, nextRegenAt: null } } }, puzzle, false, 'wrong', now).save;
assert.equal(wrong.wallet.coins, start.wallet.coins); assert.equal(wrong.pet.stats.happiness, start.pet.stats.happiness);
assert.equal(wrong.pet.stats.hunger, start.pet.stats.hunger); assert.equal(wrong.progress.lives.current, 0);
assert.equal(applyPuzzleAnswer(wrong, puzzle, true, 'retry', now).coins, 4, 'Zero lives cannot block learning');
const day2 = applyPuzzleAnswer(first.save, puzzle, true, 'day2', now + 86400000).save;
assert.equal(day2.progress.streak, 2); assert.equal(applyPuzzleAnswer(day2, puzzle, true, 'same-day', now + 86400100).save.progress.streak, 2);
const basePet = { ...start.pet, stats: { ...start.pet.stats, hunger: 100, happiness: 100 }, lastCareAt: 0 };
let minutePet = basePet;
for (let i = 1; i <= 60; i++) minutePet = applyPetTimeDecay(minutePet, i * 60000);
const hourPet = applyPetTimeDecay(basePet, 3600000);
assert.ok(Math.abs(minutePet.stats.hunger - hourPet.stats.hunger) < 1e-9); assert.ok(Math.abs(minutePet.stats.happiness - hourPet.stats.happiness) < 1e-9);
assert.equal(applyPetTimeDecay(basePet, 7 * 86400000).stats.hunger, 70, 'Absence decay is capped at six hours');
assert.equal(withCoinDelta(start, -start.wallet.coins - 1, { kind: 'pet_feed' }), null);
let credited = withCoinDelta(start, 100, { kind: 'iap_purchase', transactionId: 'receipt-1' });
for (let i = 0; i < 160; i++) credited = withCoinDelta(credited, 2, { kind: 'puzzle_reward' });
assert.equal(withCoinDelta(credited, 100, { kind: 'iap_purchase', transactionId: 'receipt-1' }), credited, 'Receipt deduplication survives history pruning');
const fed = applyFeed({ ...start, pet: { ...start.pet, lastCareAt: now } }, now);
assert.equal(fed.wallet.coins, start.wallet.coins - 4); assert.equal(fed.pet.stats.hunger, 97); assert.equal(fed.coinTransactions.at(-1).kind, 'pet_feed');
assert.equal(applyFeed({ ...start, wallet: { coins: 0 } }, now), null);
const old = { ...start, progress: { ...start.progress, completedPuzzleIds: undefined, puzzlesSolved: { easy: 6, medium: 0, hard: 0 } } };
assert.equal(parseGameSaveFromValue(old).save.progress.completedPuzzleIds.length, 6, 'Existing sequential progress migrates');
const changed = { ...switchRoomLayout(start.pet, 'room2'), roomPetOffset: { x: .7, y: .2 }, bedId: undefined };
const back = switchRoomLayout(changed, 'room1'); assert.deepEqual(captureRoomLayout(back), captureRoomLayout(start.pet));
assert.deepEqual(captureRoomLayout(switchRoomLayout(back, 'room2')), captureRoomLayout(changed));
const layoutSave = { ...start, pet: { ...back, savedRoomLayouts: { room1: captureRoomLayout(back) } } };
assert.equal(parseGameSaveFromValue(layoutSave).save.pet.savedRoomLayouts.room1.bedId, 'brown');
const { normalizePlacedToys, updatePlacedToyScaleByInstance } = load('@/utils/room-placement');
const { getPlacedToyScale, getPlacedToyDisplaySize } = load('@/constants/cat-toys');
const { scaleDecorationBy, canScaleDecorationUp, canScaleDecorationDown } = load('@/constants/decoration-variants');
const post = { toyId: 'scratchPostRed', instanceId: 'post', offset: { x: .2, y: .3 } };
const otherPost = { ...post, instanceId: 'other-post' };
const scaledPosts = updatePlacedToyScaleByInstance([post, otherPost], 'post', scaleDecorationBy(1, 'up'));
assert.equal(scaledPosts[0].scale, 1.1);
assert.equal(scaledPosts[1], otherPost, 'Resizing one scratching post preserves other instances');
assert.equal(post.scale, undefined, 'Resizing preserves undo history');
assert.ok(getPlacedToyDisplaySize(scaledPosts[0]) > getPlacedToyDisplaySize(post));
assert.equal(updatePlacedToyScaleByInstance(scaledPosts, 'post', scaleDecorationBy(1.1, 'down'))[0].scale, undefined);
for (const [input, expected] of [[99, 2.2], [-99, .7], [NaN, 1], [Infinity, 1], [undefined, 1]]) {
  const normalized = normalizePlacedToys([{ ...post, scale: input }])[0];
  assert.equal(getPlacedToyScale(normalized), expected);
}
assert.equal(canScaleDecorationUp(2.2), false); assert.equal(canScaleDecorationDown(.7), false);
const toyLayout = captureRoomLayout({ ...start.pet, placedToys: scaledPosts });
const toySave = parseGameSaveFromValue(JSON.stringify({ ...start, pet: { ...start.pet, placedToys: scaledPosts,
  roomLayouts: { room2: toyLayout }, savedRoomLayouts: { room1: toyLayout } } })).save;
assert.equal(toySave.pet.placedToys[0].scale, 1.1, 'Toy size survives closing and reopening the app');
assert.equal(toySave.pet.roomLayouts.room2.placedToys[0].scale, 1.1, 'Per-room layouts retain toy size');
assert.equal(toySave.pet.savedRoomLayouts.room1.placedToys[0].scale, 1.1, 'Saved room layouts retain toy size');
console.log('Verified scratching-post resizing, instance isolation, bounds, legacy defaults, and saved sizes.');
assert.deepEqual(JSON.parse(JSON.stringify(getSolvedCounts([puzzle.id]))), { easy: 1, medium: 0, hard: 0 });
await Promise.all([saveGameSave(start), saveGameSave(first.save), clearGameSave()]);
assert.equal(await loadGameSave(), null, 'Clearing cannot race an older queued save');
console.log(`Verified ${count} localized puzzles, matching help, atomic/idempotent rewards, replay after interruption, zero-life practice, streaks, decay, feed, legacy saves, and per-room layouts.`);
