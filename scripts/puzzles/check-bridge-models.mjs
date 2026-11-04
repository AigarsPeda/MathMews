import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BRIDGE_PLANS,BRIDGE_TYPES,bridgeSolution} from './bridge-pilot.mjs';
export function checkBridgeModels({load}){
 const json=v=>JSON.parse(JSON.stringify(v));
 const {bridgeTarget,checkBridgeAnswer,transformEquation}=load('@/utils/bridge-models');
 const {getPuzzleDraftAnswer}=load('@/utils/puzzle-attempt');
 const {getLearningReview}=load('@/constants/learning-review');
 const {getVisualExplanation}=load('@/constants/visual-explanations');
 const {checkPuzzleAnswer}=load('@/utils/puzzle-type');
 const catalog=JSON.parse(fs.readFileSync('data/puzzle-curriculum.json'));
 const lists=Object.fromEntries(['en','lv','ru'].map(l=>[l,['easy','medium','hard'].flatMap(d=>JSON.parse(fs.readFileSync(`assets/puzzles/${l==='en'?'':l+'/'}${d}.json`)))]));
 const tasks=lists.en.filter(p=>BRIDGE_TYPES.includes(p.type));assert.equal(tasks.length,120);
 for(const type of BRIDGE_TYPES)for(const tier of ['easy','medium','hard'])assert.equal(tasks.filter(p=>p.type===type&&p.difficulty===tier).length,10);
 for(const p of tasks){
  const q=p.payload,target=bridgeSolution(p.type,q);assert.deepEqual(json(bridgeTarget(p)),target);
  const state=p.type==='equation_board'?{equation:{a:1,b:0,c:target}}:typeof target==='number'?{value:target}:{point:target};
  assert.equal(getPuzzleDraftAnswer(p,{}),null);
  assert.equal(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{bridge:state})),true);
  assert.equal(checkPuzzleAnswer(p,{kind:'choice',index:0}),false);
  if(typeof target==='number'&&p.type!=='equation_board')for(let v=-30;v<=120;v++)assert.equal(checkBridgeAnswer(p,{value:v}),v===target);
  if(p.type==='coordinate_map'&&q.mode!=='distance')for(let x=q.min;x<=q.max;x++)for(let y=q.min;y<=q.max;y++)assert.equal(checkBridgeAnswer(p,{point:{x,y}}),target.x===x&&target.y===y);
  if(p.type==='equation_board'){
   let s={a:q.a,b:q.b,c:q.c};
   // Every offered transform keeps the same root, including unhelpful moves.
   for(const op of ['add','divide'])for(const n of [-5,-1,1,2,3,4,5]){const next=transformEquation(s,op,n);if(next)assert.equal((next.c-next.b)/next.a,target);}
   while(s.b!==0)s=transformEquation(s,'add',s.b>0?-1:1);
   if(s.a!==1)s=transformEquation(s,'divide',s.a);
   assert.ok(checkBridgeAnswer(p,{equation:s}));assert.equal(checkBridgeAnswer(p,{equation:{...s,c:s.c+1}}),false);
   if(p.difficulty==='easy')assert.equal(q.a,1);
   if(p.difficulty==='medium')assert.ok(q.a===1||q.b===0);
   if(p.difficulty==='hard')assert.ok(q.a>1&&q.b!==0);
  }
  if(p.type==='signed_line'){
   assert.ok(target>=q.min&&target<=q.max);
   if(p.difficulty==='easy')assert.ok(q.min===0&&target>=0&&q.max<=10);
   if(p.difficulty==='medium')assert.ok(Math.abs(q.delta)<=6);
   if(p.difficulty==='hard')assert.equal(q.mode,'move');
  }
  if(p.type==='ratio_table'){
   assert.ok(Number.isInteger(target)&&target>0);
   if(p.difficulty==='easy')assert.ok(q.a===1&&q.b<=5&&target<=20);
   if(p.difficulty==='medium')assert.equal(q.targetA%q.a,0);
   if(p.difficulty==='hard')assert.ok(q.a>1);
  }
  if(p.type==='coordinate_map'){
   if(q.mode==='distance')assert.ok(q.start.x===q.end.x||q.start.y===q.end.y,'Only axis-aligned distances are authored');
   else assert.ok(target.x>=q.min&&target.x<=q.max&&target.y>=q.min&&target.y<=q.max);
   if(p.difficulty==='easy')assert.ok(q.mode==='plot'&&q.min===0&&q.max===4);
   if(p.difficulty==='medium')assert.equal(q.min,0);
   if(p.difficulty==='hard')assert.ok(q.min<0);
  }
  assert.equal(getVisualExplanation(p).keyframes.length,3);
  for(const locale of ['lv','ru']){const other=lists[locale].find(x=>x.id===p.id);assert.deepEqual(other.payload,q);assert.equal(other.type,p.type);assert.notEqual(other.question,p.question);assert.ok(checkPuzzleAnswer(other,{kind:'bridge',state}));}
 }
 for(const plan of BRIDGE_PLANS){
  const lesson=catalog.lessons.find(l=>l.id===plan.id),tasksInLesson=tasks.filter(p=>p.learning.skillId===lesson.skillId);
  assert.equal(tasksInLesson.length,10);assert.equal(tasksInLesson.filter(p=>p.payload.guided).length,3);
  for(let day=20500;day<20522;day++){const review=getLearningReview(lesson,day);assert.equal(new Set(review.choices).size,3);for(const l of ['en','lv','ru'])assert.ok(review.prompt[l]&&review.explanation[l]);if(plan.type==='signed_line'){const value=Number(review.choices[review.correctIndex]);assert.ok(value>=(plan.difficulty==='easy'?0:-6)&&value<=(plan.difficulty==='easy'?10:6),'Daily review keeps the taught signed range');}}
 }
 const {createDefaultGameSave,parseGameSaveFromValue}=load('@/utils/game-storage');
 const {resetPuzzleProgress,lifetimePuzzleIds}=load('@/utils/reset-puzzle-progress');
 const {getBossAchievements}=load('@/utils/boss-achievements');
 const {applyPuzzleAnswer}=load('@/utils/game-operations');
 const {PUZZLE_PATHS}=load('@/constants/puzzle-path');
 const save=createDefaultGameSave();save.progress.completedPuzzleIds=lists.en.slice(0,20).map(p=>p.id);
 const boss=catalog.lessons[0].levels.find(l=>l.kind==='boss');save.progress.completedPuzzleIds.push(...boss.puzzleIds);
 save.progress.attemptedPuzzleIds=[...save.progress.completedPuzzleIds];save.progress.completedPathLessonIds=[PUZZLE_PATHS[0].id];save.progress.unlockedPathLessonIds=[PUZZLE_PATHS[1].id];
 save.progress.visualHelpsUnlocked=[lists.en[0].id];save.progress.processedAttemptIds=['receipt-kept'];save.progress.streak=7;save.wallet.coins=853;
 save.pet.stats.level=1+Math.floor(save.progress.completedPuzzleIds.length/10);
 const original=json(save),reset=resetPuzzleProgress(save);
 assert.deepEqual(json(save),original,'Reset is immutable');
 assert.deepEqual(json(reset.pet),original.pet);assert.deepEqual(json(reset.wallet),original.wallet);
 for(const k of ['roomsUnlocked','bedsUnlocked','toysUnlocked','decorationsUnlocked','skinsUnlocked','visualHelpsUnlocked','lives','processedAttemptIds','streak'])assert.deepEqual(json(reset.progress[k]),original.progress[k]);
 assert.equal(reset.progress.completedPuzzleIds.length,0);assert.equal(reset.progress.attemptedPuzzleIds.length,0);assert.equal(reset.progress.unlockedPathLessonIds.length,0);
 assert.equal(getBossAchievements(reset.progress.completedPuzzleIds).filter(a=>a.collected).length,0,'Achievements reset with learning progress');
 const restored=parseGameSaveFromValue(JSON.stringify(reset)).save;assert.equal(restored.pet.stats.level,save.pet.stats.level);assert.equal(restored.wallet.coins,853);assert.equal(restored.progress.completedPuzzleIds.length,0);
 assert.deepEqual(json(lifetimePuzzleIds(restored.progress)),json(save.progress.completedPuzzleIds));
 for(const bad of [null,{},'bad',42]){const malformed=json(reset);malformed.progress.lifetimeCompletedPuzzleIds=bad;const parsed=parseGameSaveFromValue(JSON.stringify(malformed));assert.ok(parsed.save);assert.equal(parsed.save.wallet.coins,853);assert.equal(parsed.save.progress.lifetimeCompletedPuzzleIds.length,0);}
 const next=applyPuzzleAnswer(restored,lists.en[0],true,'post-reset').save;assert.equal(next.pet.stats.level,save.pet.stats.level,'Replaying does not lower earned pet growth');
 console.log('Verified 120 bridge tasks across Easy/Medium/Hard in three languages: exact grading, reachable equation operations, signed bounds, coordinate distances, daily reviews and puzzle-only reset isolation.');
}
