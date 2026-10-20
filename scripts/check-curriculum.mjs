/** Curriculum contracts, route authorization, real answer checks and saved progress. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { challengeAnswers } from './puzzles/solve-challenges.mjs';
execFileSync(process.execPath, ['scripts/puzzles/build-content.mjs', '--check'], { stdio: 'pipe' });
const cache = new Map(), root = process.cwd(), stored = new Map();
const storage = { getItem: async key => stored.get(key) ?? null, setItem: async (key,value) => stored.set(key,value),
  multiSet: async entries => entries.forEach(([key,value]) => stored.set(key,value)), multiRemove: async keys => keys.forEach(key=>stored.delete(key)) };
function load(id) {
  if (id === '@/hooks/use-world-clock-now') return { useWorldClockNow: () => Date.now() };
  if (id === 'react') return {};
  if (id === 'react-native') return { Dimensions: { get: () => ({width:390,height:844}) }, PixelRatio: { roundToNearestPixel: n => n } };
  if (id === '@react-native-async-storage/async-storage') return storage;
  const file = id.startsWith('@/') ? path.join(root,id.slice(2)) : id;
  if (/\.(png|webp|mp4)$/.test(file)) return file;
  const resolved = fs.existsSync(file) ? file : ['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
  assert.ok(resolved,id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = {exports:{}}; cache.set(resolved,module);
  if (resolved.endsWith('.json')) { module.exports=JSON.parse(fs.readFileSync(resolved,'utf8')); return module.exports; }
  const source = ts.transpileModule(fs.readFileSync(resolved,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require:load,Date,Math,Set,Map});
  return module.exports;
}
const { getPuzzlesByDifficulty, computePetWisdom, PUZZLE_CONTENT_VERSION } = load('@/constants/puzzles');
const { checkPuzzleAnswer, getValidPairs } = load('@/utils/puzzle-type');
const { getVisualExplanation } = load('@/constants/visual-explanations');
const curriculum = load('@/constants/curriculum');
const { getPuzzleCompanionMessage } = load('@/utils/puzzle-companion');
const companionContext = { correct:true,kind:'practice',finalStage:false,practiceFinished:false,replay:false,retries:0,completedCount:1,puzzleId:'example' };
const companion = changes => getPuzzleCompanionMessage({...companionContext,...changes});
assert.equal(companion({correct:false}).key,'retry');
assert.equal(companion({correct:false,retries:2}).key,'retryPatient');
assert.equal(companion({retries:1}).key,'persistence','Trying again gets effort-specific encouragement');
assert.equal(companion({completedCount:5}).key,'milestone');
assert.equal(companion({completedCount:5}).count,5);
assert.equal(companion({completedCount:5,replay:true}).key,'replay','Replays cannot invent new-solve milestones');
assert.equal(companion({practiceFinished:true}).key,'practiceComplete','Practice completion does not claim the boss was cleared');
assert.equal(companion({kind:'boss',finalStage:false}).key,'bossStage');
assert.equal(companion({kind:'boss',finalStage:true}).key,'bossComplete');
assert.equal(companion({kind:'challenge'}).key,'challengeComplete');
assert.equal(new Set([1,2,3,4].map(completedCount=>companion({completedCount}).key)).size,4,'Routine messages vary without random changes on rerender');
const companionKeys=['retry','retryPatient','persistence','milestone','replay','practiceComplete','bossStage','bossComplete','challengeComplete',...Array.from({length:4},(_,i)=>`progress${i}`)];
for(const locale of ['en','lv']) {
 const messages=JSON.parse(fs.readFileSync(`locales/${locale}.json`,'utf8')).puzzleCompanion;
 assert.ok(companionKeys.every(key=>typeof messages[key]==='string' && messages[key].length>0),'Both locales include every companion message');
}
const { getQuantityTaskTokens, getQuantityTaskHeight } = load('@/utils/quantity-task-scene');
const { findPuzzleDropZone, movePatternTile, moveOrderTile } = load('@/utils/puzzle-drag');
const dropZones=[{id:'left',x:10,y:100,width:100,height:140},{id:'right',x:130,y:100,width:100,height:140}];
assert.equal(findPuzzleDropZone(dropZones,60,170),'left');
assert.equal(findPuzzleDropZone(dropZones,180,170),'right');
assert.equal(findPuzzleDropZone(dropZones,120,170),null,'A drop in the gap between baskets returns the tile');
assert.equal(findPuzzleDropZone(dropZones,60,99),null,'A drop outside the board cannot place a tile');
assert.equal(findPuzzleDropZone(dropZones,NaN,170),null);
assert.equal(findPuzzleDropZone([{id:'not-laid-out',x:0,y:0,width:0,height:0}],0,0),null,'Unmeasured targets cannot accept a tile');
assert.equal(findPuzzleDropZone(dropZones,210-30,470-300),'right','Screen coordinates translate to board coordinates after scrolling');
assert.equal(findPuzzleDropZone([{id:'grown-basket',x:10,y:120,width:100,height:240}],60,330),'grown-basket','Expanded baskets accept drops in the new area');
assert.deepEqual(JSON.parse(JSON.stringify(movePatternTile([null,null],0,0))),[0,null]);
assert.deepEqual(JSON.parse(JSON.stringify(movePatternTile([0,1],2,0))),[2,1],'A bank tile replaces a filled gap and frees the old tile');
assert.deepEqual(JSON.parse(JSON.stringify(movePatternTile([0,1],0,1))),[1,0],'Dragging between filled gaps swaps the tiles');
assert.deepEqual(JSON.parse(JSON.stringify(movePatternTile([0,null],0,1))),[null,0],'A tile moves between gaps without duplication');
assert.deepEqual(JSON.parse(JSON.stringify(movePatternTile([0,1],0,null))),[null,1],'Returning a tile to the bank clears its gap');
assert.deepEqual(JSON.parse(JSON.stringify(movePatternTile([0,1],0,0))),[0,1],'Dropping on the same slot preserves the board');
assert.deepEqual(JSON.parse(JSON.stringify(movePatternTile([0,1],0,9))),[0,1],'An invalid target preserves the board');
const originalOrder = [1,6,8,3];
assert.deepEqual(JSON.parse(JSON.stringify(moveOrderTile(originalOrder,3,1))),[1,3,6,8],'Dragging left inserts a number and shifts the intervening tiles');
assert.deepEqual(JSON.parse(JSON.stringify(moveOrderTile(originalOrder,0,3))),[6,8,3,1],'Dragging right also preserves the intervening order');
assert.deepEqual(originalOrder,[1,6,8,3],'Reordering never mutates the source');
assert.deepEqual(JSON.parse(JSON.stringify(moveOrderTile([2,1,2],0,2))),[1,2,2],'Equal values remain separate tiles');
for (const [from,to] of [[1,1],[-1,2],[1,4],[1,NaN],[1.5,2]]) {
  assert.deepEqual(JSON.parse(JSON.stringify(moveOrderTile(originalOrder,from,to))),originalOrder,'Invalid and unchanged positions preserve the board');
}
const { LEARNING_CATALOG, getPracticeIds, getRequiredIds, getLearningProgress, getTopicProgress, getTopicLessons, getLearningTopics, getLearningLevelState, isLessonAvailable, resolveLearningSession } = curriculum;
const { getBossSceneProgress, advanceBossOutcome } = load('@/utils/boss-story');
const storyBosses = LEARNING_CATALOG.lessons.flatMap(lesson => lesson.levels.filter(level => level.kind === 'boss'));
assert.equal(storyBosses.length, LEARNING_CATALOG.lessons.length, 'Every lesson has its own boss');
assert.equal(new Set(storyBosses.map(boss => boss.story?.sceneId)).size, storyBosses.length, 'Every lesson has its own animation scene');
for(const locale of ['en','lv']) {
  assert.equal(new Set(storyBosses.map(boss=>boss.story.backstory[locale])).size,storyBosses.length,'Every boss has an individual backstory');
  assert.equal(new Set(storyBosses.map(boss=>boss.story.outcome[locale])).size,storyBosses.length,'Every boss has an individual ending');
}
for (const boss of storyBosses) {
  assert.ok(boss.story, `${boss.id}: missing story`);
  assert.equal(boss.puzzleIds.length, 3, 'A story is exactly three saved tasks');
  assert.equal(boss.story.stages.length, 3);
  assert.equal(boss.story.catActions.length, 4, 'The cat participates before the mission and after all three tasks');
  for (const locale of ['en', 'lv']) {
    for (const line of [boss.story.backstory, boss.story.intro, boss.story.outcome, ...boss.story.catActions, ...boss.story.stages.flatMap(stage => [stage.title, stage.before, stage.after])]) {
      assert.ok(typeof line[locale] === 'string' && line[locale].trim().length > 5, `${boss.id}: incomplete ${locale} story`);
    }
    assert.equal(new Set(boss.story.stages.map(stage => stage.title[locale])).size, 3, 'Each task has its own role in the mission');
  }
  for (let phase = 0; phase < 3; phase++) {
    assert.equal(getBossSceneProgress(phase), phase, 'Entry and resumed scenes use the saved session checkpoint');
    assert.equal(getBossSceneProgress(phase, false), phase, 'Wrong answers do not change the scene');
    assert.equal(getBossSceneProgress(phase, true), phase + 1, 'Only a successful task changes the scene');
  }
}
assert.equal(getBossSceneProgress(0), 0, 'Replaying a cleared boss starts with an unfinished scene');
for (const invalid of [NaN, Infinity, -3]) assert.equal(getBossSceneProgress(invalid), 0);
let ending = { elapsed: 0, frame: 0, finished: false };
for (let frame = 0; frame < 120; frame++) ending = advanceBossOutcome(ending.elapsed, 1000 / 60);
assert.equal(ending.frame, 15);
// Floating-point sums can finish one animation frame later; they never loop.
ending = advanceBossOutcome(ending.elapsed, 17);
assert.equal(ending.finished, true);
assert.equal(advanceBossOutcome(ending.elapsed, 100).frame, 15);
assert.equal(advanceBossOutcome(0, 10000).elapsed, 100, 'A stalled frame cannot skip the ending');
let reaction = { elapsed: 0, frame: 0, finished: false };
for (let i = 0; i < 10; i++) reaction = advanceBossOutcome(reaction.elapsed, 100, 8);
assert.equal(reaction.elapsed, 1000, 'Task cat reactions last one second');
assert.equal(reaction.frame, 7);
assert.equal(reaction.finished, true);
assert.equal(advanceBossOutcome(reaction.elapsed, 100, 8).frame, 7, 'Task reactions hold without looping');
const { applyPuzzleAnswer, getSolvedCounts } = load('@/utils/game-operations');
const { createDefaultGameSave, parseGameSaveFromValue } = load('@/utils/game-storage');
const { getPuzzleCoinReward } = load('@/constants/game');
const tiers = ['easy','medium','hard'];
const en = tiers.flatMap(tier=>getPuzzlesByDifficulty('en',tier));
const animatedTasks = en.filter(puzzle => puzzle.taskVisual);
assert.ok(animatedTasks.length >= 10, 'At least ten arithmetic tasks have authored quantity models');
for (const puzzle of animatedTasks) {
  const model = puzzle.taskVisual;
  const total = model.kind === 'array' ? model.rows * model.columns : model.kind === 'join' ? model.left + model.right : model.left - model.right;
  assert.equal(Number(puzzle.choices[puzzle.correctIndex]), total, `${puzzle.id}: the task model must match the answer`);
  assert.deepEqual(puzzle.taskVisual, tiers.flatMap(tier=>getPuzzlesByDifficulty('lv',tier)).find(other=>other.id===puzzle.id).taskVisual,'Authored quantities match across locales');
  const before = getQuantityTaskTokens(model, 0), after = getQuantityTaskTokens(model, 1);
  assert.deepEqual(Array.from(before,token=>token.id), Array.from(after,token=>token.id),'Counter identities survive the animation');
  assert.equal(after.filter(token=>token.visible!==false).length, model.kind==='take_away' ? total : before.length);
  assert.ok(after.every(token=>token.label===''), 'The animation shows quantities without writing the result');
  for(const token of [...before,...after].filter(token=>token.visible!==false)) {
    assert.ok(token.x>=6 && token.x<=294 && token.y>=6 && token.y<=getQuantityTaskHeight(model)-6,`${puzzle.id}: counters fit in the scene`);
  }
  for (const frame of [before,after]) {
    const visible = frame.filter(token=>token.visible!==false);
    for (let i=0;i<visible.length;i++) for(let j=i+1;j<visible.length;j++) {
      assert.ok(Math.abs(visible[i].x-visible[j].x)>=12 || Math.abs(visible[i].y-visible[j].y)>=12,`${puzzle.id}: counters must never overlap`);
    }
  }
}
for (const puzzle of en.filter(puzzle=>puzzle.type==='fair_share')) {
  const model={kind:'share',items:puzzle.payload.items,groups:puzzle.payload.people};
  for(let round=0;round<=Math.floor(model.items/model.groups)+1;round++) {
    const tokens=getQuantityTaskTokens(model,round), counters=tokens.filter(token=>token.id.startsWith('counter-'));
    assert.equal(counters.length,model.items,'No counters are omitted or duplicated, including leftovers');
    assert.equal(new Set(counters.map(token=>token.id)).size,model.items);
    const dealt=counters.filter(token=>token.y>=85);
    assert.equal(dealt.length,Math.min(round,Math.floor(model.items/model.groups))*model.groups,'Only complete equal rounds leave the pool');
    for(let group=0;group<model.groups;group++) assert.equal(dealt.filter(token=>Number(token.id.split('-')[1])%model.groups===group).length,dealt.length/model.groups,'All plates receive the same amount');
  }
}
const byId = new Map(en.map(p=>[p.id,p]));
const canonical = value => JSON.parse(JSON.stringify(value));
const topicIds = LEARNING_CATALOG.topics.map(topic=>topic.id);
assert.equal(new Set(topicIds).size,topicIds.length);
assert.equal(new Set(LEARNING_CATALOG.lessons.map(lesson=>lesson.id)).size,LEARNING_CATALOG.lessons.length);
assert.equal(LEARNING_CATALOG.version,PUZZLE_CONTENT_VERSION);
const placements=[]; let bosses=0,challenges=0;
for(const lesson of LEARNING_CATALOG.lessons) {
  assert.ok(topicIds.includes(lesson.topicId));
  assert.ok(tiers.includes(lesson.difficulty));
  assert.ok(getPracticeIds(lesson).length>0);
  assert.equal(lesson.levels.filter(level=>level.kind==='challenge').length,1,`${lesson.id}: one timed challenge`);
  assert.equal(lesson.levels.filter(level=>level.kind==='boss').length,1,`${lesson.id}: one boss mission`);
  assert.equal(lesson.levels.at(-1).kind,'boss','The boss ends its lesson');
  const first=lesson.levels[0];
  for(const level of lesson.levels) {
    assert.ok(level.puzzleIds.length>0);
    assert.ok(level.title.en && level.title.lv && level.description.en && level.description.lv);
    if(level.kind==='boss') { bosses++; assert.ok(level.puzzleIds.length>=3); }
    if(level.kind==='challenge') { challenges++; assert.ok(level.puzzleIds.every(id=>['find_all_pairs','sort_buckets','repair_pattern','route_grid','budget_plan'].includes(byId.get(id).type))); }
    if(level.kind==='practice' || level.kind==='boss') assert.ok(level.puzzleIds.every(id=>!['find_all_pairs','sort_buckets','repair_pattern','route_grid','budget_plan'].includes(byId.get(id).type)),'Optional challenges have distinct interactions');
    for(const id of level.puzzleIds) { assert.equal(byId.get(id)?.difficulty,lesson.difficulty); placements.push(id); }
  }
  const core = getPracticeIds(lesson);
  const onlyPractice=lesson.levels.filter(l=>l.kind==='practice');
  assert.equal(curriculum.getNextPracticeLevel(lesson,onlyPractice[0]).id,onlyPractice[1].id);
  assert.equal(curriculum.getNextPracticeLevel(lesson,onlyPractice.at(-1)),undefined,'The play queue ends at the current lesson');
  assert.equal(getLearningLevelState(lesson,first,[]),getTopicLessons(lesson.difficulty,lesson.topicId)[0].id===lesson.id?'current':'locked');
  assert.equal(getLearningLevelState(lesson,onlyPractice[1],[]),'locked');
  assert.equal(getLearningLevelState(lesson,onlyPractice[1],[core[0]]),'current');
  for(const special of lesson.levels.filter(l=>l.kind!=='practice')) {
    assert.equal(getLearningLevelState(lesson,special,[]),'locked');
    assert.equal(getLearningLevelState(lesson,special,core),'current');
  }
}
assert.equal(placements.length,en.length);
assert.equal(new Set(placements).size,placements.length,'Every puzzle appears in exactly one lesson or mission stage');
assert.equal(new Set(LEARNING_CATALOG.lessons.flatMap(l=>l.levels.map(level=>level.id))).size,LEARNING_CATALOG.lessons.flatMap(l=>l.levels).length);
assert.ok(bosses >= 18);assert.ok(challenges >= 11);assert.ok(en.length >= 209);
for(const type of ['find_all_pairs','sort_buckets','repair_pattern','route_grid','budget_plan']) assert.ok(en.some(p=>p.type===type),`Missing optional interaction: ${type}`);
assert.ok(!getPuzzlesByDifficulty('en','easy').some(p=>['route_grid','budget_plan'].includes(p.type)),'Route planning and discounts are not Easy activities');
assert.ok(en.filter(p=>p.type==='budget_plan').every(p=>p.difficulty==='hard'),'Discount planning is reserved for Hard');
for(const tier of tiers) assert.ok(getLearningTopics(tier).length > 0);
const bossTitles={en:new Set(),lv:new Set()};
for(const tier of tiers) for(const topic of getLearningTopics(tier)) {
  const lessons=getTopicLessons(tier,topic.id);
  assert.ok(lessons.length>=10,`${tier}/${topic.id}: at least ten lessons`);
  assert.ok(lessons.some(lesson=>lesson.levels.some(level=>level.kind==='challenge' && level.timeLimitSeconds>=60)),`${tier}/${topic.id}: timed challenges are present`);
  const topicBosses=lessons.flatMap(lesson=>lesson.levels.filter(level=>level.kind==='boss'));
  assert.equal(topicBosses.length,lessons.length,`${tier}/${topic.id} must have a boss in every lesson`);
  const boards=lessons.map(lesson=>byId.get(lesson.levels.find(level=>level.kind==='challenge').puzzleIds[0]));
  assert.equal(new Set(boards.map(puzzle=>JSON.stringify(puzzle.payload))).size,lessons.length,`${tier}/${topic.id}: challenge boards vary between lessons`);
  const boss=topicBosses.at(-1),last=lessons.at(-1);
  assert.equal(last.levels.at(-1).id,boss.id,'The boss is the final level of the final lesson');
  for(const topicBoss of topicBosses) for(const locale of ['en','lv']) {
    assert.ok(!bossTitles[locale].has(topicBoss.title[locale]),'Every lesson has a uniquely named mission');
    bossTitles[locale].add(topicBoss.title[locale]);
  }
  const practice=lessons.flatMap(getPracticeIds);
  const bossStages=lessons.flatMap(lesson=>lesson.levels.filter(level=>level.kind==='boss').flatMap(level=>level.puzzleIds));
  const challenges=lessons.flatMap(lesson=>lesson.levels.filter(level=>level.kind==='challenge').flatMap(level=>level.puzzleIds));
  const practiceProgress=getTopicProgress(tier,topic.id,practice);
  assert.equal(practiceProgress.complete,bossStages.length===0,'A topic requires its bosses for completion');
  assert.equal(practiceProgress.total,practice.length+bossStages.length,'Progress includes boss stages and excludes optional challenges');
  assert.equal(getTopicProgress(tier,topic.id,[...practice,...challenges]).complete,bossStages.length===0,'Challenges cannot substitute for a boss');
  assert.equal(getTopicProgress(tier,topic.id,[...practice,...bossStages]).complete,true,'Challenges are not required for topic completion');
  if(bossStages.length) assert.equal(getTopicProgress(tier,topic.id,[...practice,...bossStages.slice(0,-1),...challenges]).complete,false,'The final boss stage must be cleared');
  assert.equal(getLearningLevelState(last,boss,practice.slice(0,-1)),'locked','The finale opens after all topic practice');
  assert.equal(getLearningLevelState(last,boss,practice),'current','Optional challenges never gate the finale');
  for(let stage=0;stage<boss.puzzleIds.length;stage++) {
    const completed=[...practice,...boss.puzzleIds.slice(0,stage)];
    const resumed=resolveLearningSession(tier,last.id,boss.id,undefined,completed);
    assert.equal(resumed.phase,stage,'Every boss resumes at its first unfinished stage');
    assert.equal(getTopicProgress(tier,topic.id,completed).complete,false,'Partial boss progress does not complete a topic');
  }
  for(const lesson of lessons) {
    const core=getPracticeIds(lesson);
    const bosses=lesson.levels.filter(level=>level.kind==='boss').flatMap(level=>level.puzzleIds);
    assert.equal(getLearningProgress(getRequiredIds(lesson),core).complete,bosses.length===0,'Lesson completion requires all its boss stages');
    assert.equal(getLearningProgress(getRequiredIds(lesson),[...core,...bosses]).complete,true,'A lesson can finish without its challenge');
  }
  for(const lesson of lessons.slice(1)) {
    const earlierPractice=lessons.slice(0,lessons.indexOf(lesson)).flatMap(getPracticeIds);
    assert.equal(isLessonAvailable(lesson,earlierPractice),true,'Uncleared bosses never block later lessons');
    assert.ok(resolveLearningSession(tier,lesson.id,lesson.levels[0].id,undefined,earlierPractice),'A new lesson remains playable without earlier bosses');
  }
}
assert.ok(!getLearningTopics('easy').some(t=>t.id==='percentages'));
assert.ok(getLearningTopics('hard').some(t=>t.id==='percentages'));
assert.ok(!getPuzzlesByDifficulty('en','easy').some(p=>p.type==='target_build'),'Complex expression building is absent from Easy');

function numeric(expression) {
  const cleaned=expression.replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-').replaceAll(' ','');
  assert.match(cleaned,/^[\d.+*/-]+$/);
  // This evaluator accepts only validated arithmetic tokens, never question text.
  const values=cleaned.split(/([+*/-])/); let nums=[Number(values[0])], ops=[];
  for(let i=1;i<values.length;i+=2) { const op=values[i],next=Number(values[i+1]); if(op==='*')nums[nums.length-1]*=next;else if(op==='/')nums[nums.length-1]/=next;else {ops.push(op);nums.push(next);} }
  return nums.slice(1).reduce((value,num,i)=>ops[i]==='+'?value+num:value-num,nums[0]);
}
function authoredAnswer(puzzle) {
  const challenge=challengeAnswers(puzzle);
  if(challenge) {assert.ok(challenge.length>0,`${puzzle.id}: challenge must have a valid solution`); return challenge[0];}
  const p=puzzle.payload;
  switch(puzzle.type) {
    case 'find_all_pairs':return {kind:'pairs',pairs:getValidPairs(p.numbers,p.target)};
    case 'target_build':return {kind:'operators',operators:p.solution};
    case 'operation_path':return {kind:'operators',operators:p.steps.map(step=>step.operator)};
    case 'fraction_build':return {kind:'fraction',shaded:p.numerator};
    case 'number_line':return {kind:'value',value:p.correctValue};
    case 'pair_sum':return {kind:'pair',indices:p.correctIndices};
    case 'order_numbers':return {kind:'order',numbers:p.correctOrder};
    case 'fraction_match':return {kind:'fraction_match',matchedCount:p.pairs.length};
    case 'true_false':return {kind:'choice',index:puzzle.isTrue?0:1};
    default:return {kind:'choice',index:puzzle.correctIndex};
  }
}
// Check the givens rather than wording: changing a story must not disguise the
// same operands, and changing the first term must not disguise the same rule.
function practiceFacts(puzzle) {
  const p = puzzle.payload;
  let facts;
  switch (puzzle.type) {
    case 'multiple_choice': facts = puzzle.question; break;
    case 'balance': facts = p.leftDisplay.replace('?', p.choices[puzzle.correctIndex]); break;
    case 'pair_sum': facts = p.correctIndices.map(i => p.numbers[i]); break;
    case 'fix_mistake': facts = p.wrongWork[0].split('=')[0] + puzzle.question; break;
    case 'function_machine': facts = `${p.input} ${p.choices[puzzle.correctIndex]}`; break;
    case 'true_false': facts = p.statement.split(/[=>]/)[0]; break;
    case 'number_line': facts = [p.start, p.jump]; break;
    case 'order_numbers': facts = p.numbers; break;
    case 'compare': facts = `${p.optionA} ${p.optionB}`; break;
    case 'fraction_build': case 'fraction_equivalent': facts = [p.numerator, p.denominator]; break;
    case 'fraction_match': facts = p.pairs.flatMap(pair => [pair.numerator, pair.denominator]); break;
    case 'fair_share': facts = [p.items, p.people]; break;
    case 'operation_path': facts = [p.start, ...p.steps.map(step => step.operand)]; break;
    case 'target_build': facts = p.numbers; break;
    case 'estimate': facts = p.expression; break;
    case 'pattern_next': facts = p.sequence; break;
    default: assert.fail(`Missing practice variety check for ${puzzle.type}`);
  }
  return (String(facts).match(/\d+/g) ?? []).map(Number).sort((a,b) => a-b).join(',');
}
function checkPatternVariety(tasks, label) {
  const next = tasks.filter(p => p.type === 'pattern_next');
  const rules = next.map(({payload:{sequence}}) => {
    const difference = sequence[1]-sequence[0];
    return sequence.slice(1).every((n,i) => n-sequence[i] === difference) ? `+${difference}` : `×${sequence[1]/sequence[0]}`;
  });
  const machine = tasks.find(p => p.type === 'function_machine');
  const machineRule = machine.payload.choices[machine.correctIndex];
  const gap = tasks.find(p => p.type === 'multiple_choice');
  const terms = gap.question.match(/(\d+), (\d+), \?, (\d+), (\d+)\./);
  assert.ok(terms, `${gap.id}: a readable five-term missing-number pattern`);
  const filled = [Number(terms[1]), Number(terms[2]), Number(gap.choices[gap.correctIndex]), Number(terms[3]), Number(terms[4])];
  const difference = filled[1]-filled[0];
  const additive = filled.slice(1).every((n,i) => n-filled[i] === difference);
  assert.ok(additive || filled.slice(1).every((n,i) => n/filled[i] === filled[1]/filled[0]), `${gap.id}: the answer repairs the pattern`);
  rules.push(additive ? `+${difference}` : `×${filled[1]/filled[0]}`);
  rules.push(machineRule.startsWith('÷') ? `×${1/Number(machineRule.slice(1))}` : machineRule.startsWith('−') ? `+-${machineRule.slice(1)}` : machineRule);
  assert.equal(new Set(rules).size, rules.length, `${label}: the machine and next-number puzzles must use different rules`);
  for (const puzzle of tasks) assert.ok(!/[×÷]|Every step|Katrā solī/.test(puzzle.question), `${puzzle.id}: discover the pattern without naming its rule`);
}
for (const lesson of LEARNING_CATALOG.lessons) {
  const practice = getPracticeIds(lesson).map(id => byId.get(id));
  const localized = getPuzzlesByDifficulty('lv', lesson.difficulty);
  for (const puzzle of practice) {
    const counterpart = localized.find(p => p.id === puzzle.id);
    assert.equal(counterpart.type, puzzle.type);
    assert.equal(practiceFacts(counterpart), practiceFacts(puzzle), `${puzzle.id}: both languages use the same givens`);
  }
  assert.equal(practice.length, 4);
  assert.ok(new Set(practice.map(p => p.type)).size >= 3, `${lesson.id}: mix at least three task types`);
  assert.equal(new Set(practice.map(practiceFacts)).size, 4, `${lesson.id}: use independent numbers for each activity`);
  if (lesson.topicId === 'patterns') checkPatternVariety(practice, lesson.id);
}
for (const lesson of LEARNING_CATALOG.lessons) for (const level of lesson.levels.filter(l => l.kind === 'boss')) {
  const stages = level.puzzleIds.map(id => byId.get(id));
  assert.ok(new Set(stages.map(p => p.type)).size >= 2, `${level.id}: a mission needs different task types`);
  if (/lesson-\d+-boss$/.test(level.id)) assert.equal(new Set(stages.map(practiceFacts)).size,3,`${level.id}: new boss stages use independent examples`);
  if (lesson.topicId === 'patterns') checkPatternVariety(stages, level.id);
}
for(const locale of ['en','lv']) {
  const helpLocale=load(`@/locales/visual-help/${locale}`)[locale==='en'?'visualHelpEn':'visualHelpLv'];
  const labels=JSON.parse(fs.readFileSync(`locales/${locale}.json`));
  for(const tier of tiers) {
    const puzzles=getPuzzlesByDifficulty(locale,tier);
    assert.deepEqual(canonical(puzzles.map(p=>p.id)),canonical(getPuzzlesByDifficulty('en',tier).map(p=>p.id)));
    for(const puzzle of puzzles) {
      assert.equal(puzzle.difficulty,tier);
      assert.ok(puzzle.id.startsWith(`v2-${tier}-`));
      assert.ok(puzzle.question && puzzle.hint && puzzle.explanation);
      assert.ok(labels.puzzleTypes[puzzle.type],`Missing type label: ${puzzle.type}`);
      assert.equal(checkPuzzleAnswer(puzzle,authoredAnswer(puzzle)),true,puzzle.id);
      const choices=puzzle.choices ?? puzzle.payload?.choices;
      if(choices) {
        assert.ok(Number.isInteger(puzzle.correctIndex) && puzzle.correctIndex >= 0 && puzzle.correctIndex < choices.length, `Invalid answer key: ${puzzle.id}`);
        assert.equal(new Set(choices).size,choices.length,`Duplicate answers in ${puzzle.id}`);
      }
      if(puzzle.type==='true_false') {
        const [left, operator, right] = puzzle.payload.statement.split(/([=>])/);
        const value = expression => numeric(expression.replace(/(\d+)%/g,'$1/100'));
        const correct = operator === '=' ? value(left) === value(right) : value(left) > value(right);
        assert.equal(puzzle.isTrue,correct,`${puzzle.id}: statement truth must be mathematically correct`);
      }
      if(puzzle.type==='estimate') {
        const [a,b] = puzzle.payload.expression.split('+').map(Number);
        assert.equal(Number(puzzle.payload.choices[puzzle.correctIndex].replace(/[^0-9]/g,'')),Math.round((a+b)/10)*10);
      }
      const equation = puzzle.explanation.match(/(\d+(?:\s*[+×÷−]\s*\d+)+)\s*=\s*(\d+)/);
      if(equation) assert.equal(numeric(equation[1]),Number(equation[2]),`${puzzle.id}: explanation arithmetic`);
      if(puzzle.type==='number_line') {
        assert.equal(puzzle.payload.start+puzzle.payload.jump,puzzle.payload.correctValue);
        assert.ok(puzzle.payload.correctValue>=puzzle.payload.min && puzzle.payload.correctValue<=puzzle.payload.max);
      }
      if(puzzle.type==='order_numbers') assert.deepEqual(canonical(puzzle.payload.correctOrder),canonical([...puzzle.payload.numbers].sort((a,b)=>a-b)),`${puzzle.id}: increasing number order`);
      if(puzzle.type==='function_machine') {
        const {input,output,choices}=puzzle.payload;
        const matches=choices.map(rule => numeric(`${input}${rule}`) === output);
        assert.deepEqual(matches,choices.map((_,i) => i === puzzle.correctIndex),`${puzzle.id}: exactly one machine rule produces the output`);
      }
      if(puzzle.type==='pattern_next') {
        const {sequence,choices}=puzzle.payload;
        const step=sequence[1]-sequence[0],ratio=sequence[1]/sequence[0];
        const additive=sequence.slice(1).every((n,i)=>n-sequence[i]===step);
        const multiplicative=sequence.slice(1).every((n,i)=>n/sequence[i]===ratio);
        assert.ok(additive || multiplicative,`${puzzle.id}: consistent pattern rule`);
        assert.equal(Number(choices[puzzle.correctIndex]),additive ? sequence.at(-1)+step : sequence.at(-1)*ratio,`${puzzle.id}: pattern continuation`);
      }
      if(puzzle.type==='operation_path') {
        const end=puzzle.payload.steps.reduce((value,step)=>numeric(`${value}${step.operator}${step.operand}`),puzzle.payload.start);
        assert.equal(end,puzzle.payload.target,`${puzzle.id}: route reaches its target`);
      }
      if(puzzle.type==='target_build') {
        const expression=puzzle.payload.numbers.map((n,i)=>`${i ? puzzle.payload.solution[i-1] : ''}${n}`).join('');
        assert.equal(numeric(expression),puzzle.payload.target,`${puzzle.id}: expression respects operation precedence`);
      }
      const challenge=challengeAnswers(puzzle);
      if(challenge) {
        for(const answer of challenge) assert.equal(checkPuzzleAnswer(puzzle,answer),true,`${puzzle.id}: every valid solution is accepted`);
        assert.equal(checkPuzzleAnswer(puzzle,{kind:'choice',index:0}),false,'Challenges cannot be bypassed with a choice answer');
        const answer=challenge[0];
        if(puzzle.type==='sort_buckets') {
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'sort',buckets:answer.buckets.slice(1)}),false);
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'sort',buckets:answer.buckets.map((b,i)=>i===0?-1:b)}),false);
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'sort',buckets:answer.buckets.map((b,i)=>i===0?1-b:b)}),false);
          if(puzzle.payload.rule==='range') assert.equal(answer.buckets[puzzle.payload.numbers.indexOf(puzzle.payload.boundary)],1,'The boundary belongs in the upper basket');
        }
        if(puzzle.type==='repair_pattern') {
          let gap=0;const filled=puzzle.payload.sequence.map(n=>n===null?answer.values[gap++]:n);
          const difference=filled[1]-filled[0],ratio=filled[1]/filled[0];
          assert.ok(filled.slice(1).every((n,i)=>n-filled[i]===difference)||filled.slice(1).every((n,i)=>n/filled[i]===ratio),'The repaired strip follows one rule');
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'sequence',values:answer.values.slice(1)}),false);
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'sequence',values:[...answer.values].reverse()}),false);
        }
        if(puzzle.type==='route_grid') {
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'route',cells:[0,puzzle.payload.cells.length-1]}),false,'No diagonal teleport to the exit');
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'route',cells:answer.cells.slice(1)}),false,'Routes start at the start');
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'route',cells:answer.cells.slice(0,-1)}),false,'An unfinished route cannot complete');
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'route',cells:[0,1,0,...answer.cells.slice(1)]}),false,'A square cannot be visited twice');
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'route',cells:[0,NaN,...answer.cells.slice(2)]}),false);
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'route',cells:[0,3,2,5,8]}),false,'Rows do not wrap into neighboring rows');
        }
        if(puzzle.type==='budget_plan') {
          assert.ok(challenge.length>=2,'The planning challenge accepts multiple solutions');
          assert.equal(checkPuzzleAnswer(puzzle,{kind:'budget',indices:[answer.indices[0],answer.indices[0]]}),false,'The same item cannot be bought twice');
          for(const indices of [[],[0],[0,2],[-1,1],[0.5,1],[NaN,1],[0,99]]) assert.equal(checkPuzzleAnswer(puzzle,{kind:'budget',indices}),false,'Reject incomplete, over-budget and invalid plans');
        }
      }
      if(puzzle.type==='balance') assert.equal(numeric(puzzle.payload.leftDisplay.replace('?',puzzle.payload.choices[puzzle.correctIndex])),puzzle.payload.rightValue);
      if(puzzle.type==='fraction_equivalent') assert.equal(numeric(puzzle.payload.choices[puzzle.correctIndex]),puzzle.payload.numerator/puzzle.payload.denominator);
      if(puzzle.type==='compare') {
        const left=numeric(puzzle.payload.optionA),right=numeric(puzzle.payload.optionB);
        assert.notEqual(left,right,puzzle.id);
        assert.equal(puzzle.correctIndex,left>right?0:1,puzzle.id);
      }
      if(puzzle.type==='find_all_pairs') {
        const pairs=getValidPairs(puzzle.payload.numbers,puzzle.payload.target);
        assert.ok(pairs.length >= 3);
        assert.equal(checkPuzzleAnswer(puzzle,{kind:'pairs',pairs:pairs.slice(1)}),false);
        assert.equal(checkPuzzleAnswer(puzzle,{kind:'pairs',pairs:[...pairs.slice(1),pairs[1]]}),false);
        assert.equal(checkPuzzleAnswer(puzzle,{kind:'pairs',pairs:pairs.map(([a,b])=>[b,a])}),true);
        assert.equal(checkPuzzleAnswer(puzzle,{kind:'pairs',pairs:[[0,0],...pairs.slice(1)]}),false);
        assert.equal(checkPuzzleAnswer(puzzle,{kind:'pairs',pairs:[[0.5,1],...pairs.slice(1)]}),false);
      }
      const help=getVisualExplanation(puzzle);
      for(const frame of help.keyframes) assert.equal(typeof frame.captionKey.split('.').slice(1).reduce((v,key)=>v?.[key],helpLocale),'string',`${puzzle.id}: help captions`);
      const forbidden=new Set(['question','hint','explanation','payload','visualHelp','correctIndex','choices','isTrue']);
      assert.deepEqual(getVisualExplanation(new Proxy(puzzle,{get(target,key){assert.ok(!forbidden.has(key),'Worked examples must remain independent');return target[key];}})),help);
    }
  }
}
const start=createDefaultGameSave(),now=Date.now();
const easyAddition=getTopicLessons('easy','addition'),easySubtraction=getTopicLessons('easy','subtraction');
let save=start;
for(const id of getPracticeIds(easySubtraction[0])) save=applyPuzzleAnswer(save,byId.get(id),true,`sub-${id}`,now).save;
assert.equal(getTopicProgress('easy','addition',save.progress.completedPuzzleIds).solved,0,'Working on subtraction cannot advance addition');
assert.equal(getTopicProgress('medium','addition',save.progress.completedPuzzleIds).solved,0,'Difficulty progress is independent');
assert.equal(getTopicProgress('easy','subtraction',save.progress.completedPuzzleIds).solved,4);
assert.equal(isLessonAvailable(easySubtraction[1],save.progress.completedPuzzleIds),true,'Optional levels do not gate the next lesson');
assert.equal(isLessonAvailable(easyAddition[1],save.progress.completedPuzzleIds),false);
assert.equal(save.progress.topicStatsByDifficulty.easy.subtraction.correct,4);
assert.equal(save.progress.topicStatsByDifficulty.medium,undefined);
const parsed=parseGameSaveFromValue(save).save;
assert.deepEqual(canonical(parsed.progress.completedPuzzleIds),canonical(save.progress.completedPuzzleIds));
assert.equal(getTopicProgress('easy','subtraction',parsed.progress.completedPuzzleIds).solved,4);
const old={...save,wallet:{coins:321},progress:{...save.progress,puzzleContentVersion:undefined,completedPuzzleIds:['easy-mc-01'],puzzlesSolved:{easy:20,medium:8,hard:2},topicStats:{addition:{correct:10,wrong:2}},streak:6}};
const reset=parseGameSaveFromValue(old).save;
assert.equal(reset.wallet.coins,321,'Curriculum reset must preserve the wallet');
assert.equal(reset.pet.name,old.pet.name);
assert.deepEqual(canonical(reset.progress.decorationsUnlocked),canonical(old.progress.decorationsUnlocked));
assert.equal(reset.progress.completedPuzzleIds.length,0);
assert.equal(reset.progress.puzzleContentVersion,2);
assert.equal(reset.progress.streak,0);
assert.equal(reset.progress.puzzleStreak,0);
assert.deepEqual(canonical(reset.progress.topicStats),{});
assert.deepEqual(canonical(reset.progress.puzzlesSolved),{easy:0,medium:0,hard:0});
assert.equal(computePetWisdom(reset.progress.puzzlesSolved,reset.progress.completedPuzzleIds),0);
const bossLesson=LEARNING_CATALOG.lessons.find(l=>l.levels.some(level=>level.kind==='boss'));
const boss=bossLesson.levels.find(l=>l.kind==='boss');
let bossSave={...start,progress:{...start.progress,completedPuzzleIds:getPracticeIds(bossLesson)}};
assert.equal(resolveLearningSession(bossLesson.difficulty,bossLesson.id,boss.id,'1',bossSave.progress.completedPuzzleIds),null,'Cannot skip a boss stage');
assert.equal(resolveLearningSession(bossLesson.difficulty,bossLesson.id,boss.id,undefined,bossSave.progress.completedPuzzleIds).phase,0);
bossSave=applyPuzzleAnswer(bossSave,byId.get(boss.puzzleIds[0]),true,'boss-1',now).save;
const restored=parseGameSaveFromValue(bossSave).save;
assert.equal(resolveLearningSession(bossLesson.difficulty,bossLesson.id,boss.id,undefined,restored.progress.completedPuzzleIds).phase,1,'Closing after success resumes at the next stage');
const unsuccessfulStage=applyPuzzleAnswer(restored,byId.get(boss.puzzleIds[1]),false,'boss-stage-retry',now);
assert.equal(unsuccessfulStage.coins,0);
assert.deepEqual(canonical(unsuccessfulStage.save.progress.completedPuzzleIds),canonical(restored.progress.completedPuzzleIds));
assert.equal(resolveLearningSession(bossLesson.difficulty,bossLesson.id,boss.id,undefined,unsuccessfulStage.save.progress.completedPuzzleIds).phase,1,'A wrong stage answer does not reset earlier checkpoints');
const replay=applyPuzzleAnswer(restored,byId.get(boss.puzzleIds[0]),true,'boss-replay',now);
assert.equal(replay.coins,getPuzzleCoinReward(bossLesson.difficulty,true,"boss"));
assert.equal(replay.save.progress.completedPuzzleIds.length,restored.progress.completedPuzzleIds.length);
assert.equal(applyPuzzleAnswer(replay.save,byId.get(boss.puzzleIds[0]),true,'boss-replay',now).coins,0,'A delivered attempt rewards only once');
const { getBossAchievements, getShareableBossAchievement } = load('@/utils/boss-achievements');
const achievementOrder = getBossAchievements();
assert.equal(new Set(achievementOrder.map(item => item.id)).size, 180);
assert.equal(getShareableBossAchievement('missing-boss', []), null);
for (const difficulty of ['easy','medium','hard']) for (const topic of LEARNING_CATALOG.topics) {
  if (!LEARNING_CATALOG.lessons.some(lesson => lesson.difficulty === difficulty && lesson.topicId === topic.id)) continue;
  assert.deepEqual(achievementOrder.filter(item => item.lesson.difficulty === difficulty && item.topic.id === topic.id).map(item => item.lessonNumber), [1,2,3,4,5,6,7,8,9,10], 'Achievements stay in lesson order within each topic and difficulty');
}
for (const item of achievementOrder) {
  assert.equal(getShareableBossAchievement(item.id, []), null, 'Locked awards cannot be shared');
  assert.equal(getShareableBossAchievement(item.id, item.level.puzzleIds.slice(0,2)), null, 'A partial boss cannot be shared');
  assert.equal(getShareableBossAchievement(item.id, item.level.puzzleIds)?.id, item.id, 'Completing all stages enables sharing');
}
assert.equal(getBossAchievements().filter(item=>item.collected).length,0,'New players have no collected endings');
assert.equal(getBossAchievements(storyBosses.filter(boss=>!/-lesson-\d+-boss$/.test(boss.id)).flatMap(boss=>boss.puzzleIds)).filter(item=>item.collected).length,18,'Previously completed finales automatically become achievements');
for (const mission of storyBosses) {
  const lesson = LEARNING_CATALOG.lessons.find(item => item.levels.includes(mission));
  let checkpointSave = { ...start, progress: { ...start.progress, completedPuzzleIds: getPracticeIds(lesson) } };
  for (let phase = 0; phase < 3; phase++) {
    const resumed = resolveLearningSession(lesson.difficulty, lesson.id, mission.id, undefined, checkpointSave.progress.completedPuzzleIds);
    assert.equal(resumed.phase, phase, `${mission.id}: resume at the first unfinished story task`);
    assert.equal(getBossSceneProgress(resumed.phase), phase);
    const wrong = applyPuzzleAnswer(checkpointSave, byId.get(mission.puzzleIds[phase]), false, `${mission.id}-wrong-${phase}`, now).save;
    assert.equal(getBossAchievements(wrong.progress.completedPuzzleIds).find(item=>item.id===mission.id).collected,false,'Wrong answers and partial checkpoints do not unlock the ending');
    assert.equal(resolveLearningSession(lesson.difficulty, lesson.id, mission.id, undefined, wrong.progress.completedPuzzleIds).phase, phase);
    const clear = applyPuzzleAnswer(checkpointSave, byId.get(mission.puzzleIds[phase]), true, `${mission.id}-clear-${phase}`, now);
    assert.equal(clear.coins, getPuzzleCoinReward(lesson.difficulty, false, 'boss'));
    assert.equal(clear.coins, 2 * getPuzzleCoinReward(lesson.difficulty), 'Boss stages pay twice the regular reward');
    assert.equal(clear.save.wallet.coins - checkpointSave.wallet.coins, clear.coins, 'The displayed boss reward is actually credited');
    const bossReplay = applyPuzzleAnswer(clear.save, byId.get(mission.puzzleIds[phase]), true, `${mission.id}-replay-${phase}`, now);
    assert.equal(bossReplay.coins, 2 * getPuzzleCoinReward(lesson.difficulty, true), 'Boss replays pay twice the regular replay reward');
    assert.equal(applyPuzzleAnswer(bossReplay.save, byId.get(mission.puzzleIds[phase]), true, `${mission.id}-replay-${phase}`, now).coins, 0, 'A duplicate boss attempt never pays twice');
    checkpointSave = clear.save;
    const reopened = parseGameSaveFromValue(JSON.stringify(checkpointSave)).save;
    assert.equal(getBossAchievements(reopened.progress.completedPuzzleIds).find(item=>item.id===mission.id).collected,phase===2,'The third checkpoint unlocks its achievement and survives save/reopen');
    assert.equal(getLearningProgress(mission.puzzleIds, checkpointSave.progress.completedPuzzleIds).complete, phase === 2, 'Only the third task completes a boss');
  }
  const replaySession = resolveLearningSession(lesson.difficulty, lesson.id, mission.id, undefined, checkpointSave.progress.completedPuzzleIds);
  assert.equal(replaySession.phase, 0, `${mission.id}: replay resets its story scene`);
  const savedBefore=JSON.stringify(checkpointSave);
  for(let n=0;n<3;n++) assert.equal(getBossAchievements(checkpointSave.progress.completedPuzzleIds).filter(item=>item.collected).length,1,'Replays do not duplicate the collected boss');
  assert.equal(JSON.stringify(checkpointSave),savedBefore,'Browsing and replaying an achievement do not alter rewards, lives or progress');
}
for(const bad of ['-1','1.5','NaN','Infinity','999999999999999999999','3']) assert.equal(resolveLearningSession(bossLesson.difficulty,bossLesson.id,boss.id,bad,restored.progress.completedPuzzleIds),null);
assert.equal(resolveLearningSession('hard',bossLesson.id,boss.id,undefined,restored.progress.completedPuzzleIds),null);
assert.equal(resolveLearningSession('easy','missing','missing',undefined,[]),null);
const addedLesson={...bossLesson,id:'test-future-lesson',levels:[{...bossLesson.levels[0],id:'test-future-level'}]};
LEARNING_CATALOG.lessons.push(addedLesson);
const prerequisitePractice=getTopicLessons(bossLesson.difficulty,bossLesson.topicId).filter(l=>l.id!==addedLesson.id).flatMap(getPracticeIds);
assert.equal(isLessonAvailable(addedLesson,prerequisitePractice),true,'A future lesson opens without requiring bosses or challenges');
LEARNING_CATALOG.lessons.pop();
assert.deepEqual(canonical(getSolvedCounts(save.progress.completedPuzzleIds)),canonical(save.progress.puzzlesSolved));
console.log(`Verified ${en.length*2} localized puzzles, ${LEARNING_CATALOG.lessons.length} lessons, ${bosses} lesson bosses, ${challenges} optional challenges, completion, checkpoints, reset isolation and route guards.`);

const registration = fs.readdirSync('supabase/migrations').filter(file=>file.endsWith('.sql')).sort().map(file=>fs.readFileSync(`supabase/migrations/${file}`,'utf8')).join('\n');
const registered = new Map([...registration.matchAll(/\('([^']+)',(\d+),(\d+)\)/g)].map(([,id,first,replay])=>[id,[Number(first),Number(replay)]]));
for(const puzzle of en) assert.deepEqual(registered.get(puzzle.id),[getPuzzleCoinReward(puzzle.difficulty,false,curriculum.getPuzzleLevelKind(puzzle.id)),getPuzzleCoinReward(puzzle.difficulty,true,curriculum.getPuzzleLevelKind(puzzle.id))], `${puzzle.id}: server registration matches the difficulty and level-kind reward`);
console.log(`Verified server reward registrations for all ${en.length} current puzzles, including introductory number lines.`);

const lifeRules=load('@/utils/lives');
const timedRules=load('@/utils/timed-challenge');
assert.equal(load('@/constants/game').MAX_LIVES,3);
for (const tier of tiers) for (const kind of ['practice','boss','challenge']) {
  const level=LEARNING_CATALOG.lessons.filter(l=>l.difficulty===tier).flatMap(l=>l.levels).find(l=>l.kind===kind);
  const puzzle=byId.get(level.puzzleIds[0]);
  let current=createDefaultGameSave();
  if(kind==='challenge') current.progress=timedRules.beginTimedChallenge(current.progress,level,'life-run',now);
  assert.equal(current.progress.lives.current,3);
  const balance=current.wallet.coins;
  for(let mistake=1;mistake<=3;mistake++) {
    const failed=applyPuzzleAnswer(current,puzzle,false,`life-${mistake}`,now+mistake);
    assert.equal(failed.accepted,true);
    assert.equal(failed.save.progress.lives.current,3-mistake);
    assert.equal(failed.save.wallet.coins,balance,'A mistake costs one life and no existing coins');
    assert.equal(failed.save.progress.lives.nextRegenAt,now+1+1800000,'Later mistakes do not postpone regeneration');
    assert.equal(applyPuzzleAnswer(failed.save,puzzle,false,`life-${mistake}`,now+mistake).save,failed.save,'A duplicate submission cannot cost a second life');
    current=parseGameSaveFromValue(JSON.stringify(failed.save)).save;
    assert.equal(current.progress.lives.current,3-mistake,'Closing the puzzle preserves the remaining lives');
  }
  for(const correct of [false,true]) {
    const blocked=applyPuzzleAnswer(current,puzzle,correct,'blocked',now+4);
    assert.equal(blocked.accepted,false);
    assert.equal(blocked.save,current,'Zero lives cannot change completion, rewards or statistics');
    assert.equal(blocked.coins,0);
  }
  const deadline=current.progress.lives.nextRegenAt;
  assert.equal(lifeRules.applyLifeRegen(current.progress.lives,deadline-1).current,0);
  assert.equal(lifeRules.applyLifeRegen(current.progress.lives,deadline).current,1);
  assert.equal(lifeRules.applyLifeRegen(current.progress.lives,deadline+3600000).current,3);
  const restored={...current,progress:{...current.progress,lives:lifeRules.buyOneLife(current.progress.lives,now+4)}};
  const clear=applyPuzzleAnswer(restored,puzzle,true,'after-refill',now+4);
  assert.equal(clear.accepted,true);
  assert.equal(clear.coins,getPuzzleCoinReward(tier,false,kind),'Recovered attempts retain ordinary coin rewards');
  assert.equal(clear.save.progress.lives.current,1,'A correct answer neither uses nor refills lives');
  assert.ok(clear.save.progress.completedPuzzleIds.includes(puzzle.id));
  let regenerated={...current,progress:timedRules.settleChallengeTimeout(current.progress,deadline)};
  regenerated={...regenerated,progress:{...regenerated.progress,lives:lifeRules.applyLifeRegen(regenerated.progress.lives,deadline)}};
  if(kind==='challenge') regenerated.progress=timedRules.beginTimedChallenge(regenerated.progress,level,'regenerated-run',deadline);
  assert.equal(applyPuzzleAnswer(regenerated,puzzle,true,'after-regen',deadline).accepted,true,'A regenerated life permits a new timed run or an ordinary answer');
}
const legacyLives=createDefaultGameSave();
legacyLives.progress.lives={current:5,nextRegenAt:null};
assert.equal(parseGameSaveFromValue(legacyLives).save.progress.lives.current,3,'Older five-life saves migrate to the new cap');
legacyLives.progress.lives={current:-3,nextRegenAt:null};
assert.equal(parseGameSaveFromValue(legacyLives).save.progress.lives.current,0);
console.log('Verified three-life loss and gating for every difficulty and level kind, duplicate taps, save/reopen, regeneration, refill, full rewards and legacy migration.');

const timedLevels=LEARNING_CATALOG.lessons.flatMap(lesson=>lesson.levels.filter(level=>level.kind==='challenge'));
for(const level of timedLevels) {
  const clock=Date.now(), puzzle=byId.get(level.puzzleIds[0]), original=createDefaultGameSave();
  assert.ok(level.timeLimitSeconds>=60 && level.timeLimitSeconds<=600);
  assert.equal(level.puzzleIds.length,1);
  assert.equal(applyPuzzleAnswer(original,puzzle,true,'before-start',clock).accepted,false,'Previewing a challenge cannot earn completion');
  const active={...original,progress:timedRules.beginTimedChallenge(original.progress,level,`${level.id}-run`,clock)};
  const run=active.progress.challengeAttempt, deadline=run.deadlineAt;
  const resume=timedRules.beginTimedChallenge(active.progress,level,'replacement',clock+1000);
  assert.equal(resume.challengeAttempt.id,run.id,'Reopening resumes the same attempt');
  assert.equal(resume.challengeAttempt.deadlineAt,deadline,'Reopening cannot restart the timer');
  const other=timedLevels.find(candidate=>candidate.id!==level.id);
  assert.equal(timedRules.beginTimedChallenge(active.progress,other,'other',clock+1000),null,'Another challenge cannot silently replace the running one');
  const beforeDeadline=applyPuzzleAnswer(active,puzzle,true,'on-time',deadline-1);
  assert.equal(beforeDeadline.accepted,true); assert.equal(beforeDeadline.save.progress.challengeAttempt.status,'completed');
  assert.equal(beforeDeadline.save.progress.lives.current,3);
  assert.equal(timedRules.settleChallengeTimeout(beforeDeadline.save.progress,deadline+1),beforeDeadline.save.progress,'A completed challenge cannot expire later');
  const late=applyPuzzleAnswer(active,puzzle,true,'late',deadline);
  assert.equal(late.accepted,false,'The exact deadline rejects even a correct pending submission');
  assert.equal(late.coins,0); assert.equal(late.save.progress.lives.current,2);
  assert.equal(late.save.progress.challengeAttempt.status,'expired');
  assert.equal(late.save.progress.challengeAttempt.lifeLost,true);
  assert.ok(!late.save.progress.completedPuzzleIds.includes(puzzle.id));
  assert.equal(late.save.progress.lives.nextRegenAt,deadline+1800000,'Regeneration starts at the original expiry, including offline expiry');
  assert.equal(timedRules.settleChallengeTimeout(late.save.progress,deadline+1),late.save.progress,'Expiry charges exactly one life');
  const retry=timedRules.beginTimedChallenge(late.save.progress,level,'retry',deadline+1);
  assert.equal(retry.lives.current,2); assert.equal(retry.challengeAttempt.startedAt,deadline+1);
  assert.equal(timedRules.settleChallengeTimeout(retry,retry.challengeAttempt.deadlineAt,run.id),retry,'An old expiry callback cannot charge a newer run');
  assert.equal(timedRules.normalizeChallengeAttempt({...run,deadlineAt:deadline+1}),undefined,'A modified saved deadline is rejected');

  // No lives were available at expiry. A later offline regeneration must not be
  // spent retroactively when loading the save.
  const awayStart=clock-45*60000;
  const away=timedRules.beginTimedChallenge(original.progress,level,'offline',awayStart);
  away.lives={current:0,nextRegenAt:clock-15*60000};
  const loaded=parseGameSaveFromValue({...original,progress:away}).save;
  assert.equal(loaded.progress.challengeAttempt.status,'expired');
  assert.equal(loaded.progress.challengeAttempt.lifeLost,false);
  assert.equal(loaded.progress.lives.current,1,'Offline regeneration happens after settling the old timeout');
  assert.equal(parseGameSaveFromValue(JSON.stringify(loaded)).save.progress.lives.current,1,'Repeated reload cannot charge the timeout again');
}
for(const lesson of LEARNING_CATALOG.lessons) for(const level of lesson.levels.filter(level=>level.kind!=='challenge')) assert.equal(level.timeLimitSeconds,undefined,'Only optional challenges are timed');
console.log(`Verified ${timedLevels.length} durable timed challenges: ready/resume/retry, exact deadlines, one-life expiry, race guards, offline settlement and reward gating.`);

// List states must distinguish optional work without changing unlocks or completion.
{
 const {getLessonProgress}=load('@/utils/lesson-progress');
 for(const lesson of curriculum.LEARNING_CATALOG.lessons) {
  const track=curriculum.getTopicLessons(lesson.difficulty,lesson.topicId);
  const previous=track.slice(0,track.findIndex(item=>item.id===lesson.id)).flatMap(curriculum.getPracticeIds);
  const practice=curriculum.getPracticeIds(lesson), boss=lesson.levels.find(level=>level.kind==='boss'), challenge=lesson.levels.find(level=>level.kind==='challenge');
  const state=(ids,attempted=[])=>getLessonProgress(lesson,{completedPuzzleIds:[...previous,...ids],attemptedPuzzleIds:attempted});
  assert.equal(state([]).status,'notStarted');
  assert.equal(state([], [practice[0]]).status,'started','A first mistake counts as started, not completed');
  assert.equal(state(practice.slice(0,2)).status,'started');
  assert.equal(state(practice).status,'bossLeft');
  assert.equal(state([...practice,...challenge.puzzleIds]).status,'bossLeft','Optional completion cannot conceal the unfinished boss');
  assert.equal(state([...practice,boss.puzzleIds[0]]).parts[2].solved,1);
  const optional=state([...practice,...boss.puzzleIds]);
  assert.equal(optional.status,'challengeLeft');assert.ok(optional.requiredComplete,'Optional challenges never revoke core completion');
  assert.equal(state([...practice,...boss.puzzleIds,...challenge.puzzleIds]).status,'complete');
 }
 const lesson=curriculum.getTopicLessons('easy','addition')[0], first=curriculum.getLevelPuzzles('en',lesson,lesson.levels[0])[0];
 const wrong=applyPuzzleAnswer(createDefaultGameSave(),first,false,'list-first-mistake').save;
 const restored=parseGameSaveFromValue(JSON.stringify(wrong)).save;
 assert.ok(restored.progress.attemptedPuzzleIds.includes(first.id));
 assert.equal(getLessonProgress(lesson,restored.progress).status,'started');
 assert.ok(!restored.progress.completedPuzzleIds.includes(first.id));
 const malformed={...wrong,progress:{...wrong.progress,attemptedPuzzleIds:[first.id,first.id,'unknown-puzzle',17]}};
 assert.deepEqual(JSON.parse(JSON.stringify(parseGameSaveFromValue(malformed).save.progress.attemptedPuzzleIds)),[first.id],'Attempt history keeps only distinct known puzzle IDs');
 malformed.progress.puzzleContentVersion=0;
 assert.equal(parseGameSaveFromValue(malformed).save.progress.attemptedPuzzleIds.length,0,'A curriculum reset also resets started markers');
 const {beginTimedChallenge,settleChallengeTimeout}=load('@/utils/timed-challenge');
 const challenges=curriculum.LEARNING_CATALOG.lessons.slice(0,2).map(item=>item.levels.find(level=>level.kind==='challenge'));
 const started=beginTimedChallenge(createDefaultGameSave().progress,challenges[0],'progress-start-one');
 const expired=settleChallengeTimeout(started,started.challengeAttempt.deadlineAt);
 const second=beginTimedChallenge(expired,challenges[1],'progress-start-two',started.challengeAttempt.deadlineAt+1);
 assert.ok(second.attemptedPuzzleIds.includes(challenges[0].puzzleIds[0]) && second.attemptedPuzzleIds.includes(challenges[1].puzzleIds[0]),'Starting another timed challenge retains the earlier started marker');
 assert.equal(getLessonProgress(curriculum.getTopicLessons('easy','addition')[1],createDefaultGameSave().progress).status,'locked');
 console.log('Verified visual practice/challenge/boss states for all180 lessons, optional completion, first mistakes and saved attempt history.');
}
