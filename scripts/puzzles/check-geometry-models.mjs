import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GEOMETRY_PILOT_LESSONS } from './geometry-pilot.mjs';

export function checkGeometryModels({load}) {
 const clone=v=>JSON.parse(JSON.stringify(v));
 const {geometryTarget,checkGeometryAnswer,appendGeometryDigit,rectangleEdges}=load('@/utils/geometry-models');
 const {checkPuzzleAnswer}=load('@/utils/puzzle-type');
 const {getPuzzleDraftAnswer,getPuzzleAttemptHint}=load('@/utils/puzzle-attempt');
 const {getVisualExplanation}=load('@/constants/visual-explanations');
 const puzzles=Object.fromEntries(['en','lv','ru'].map(locale=>[locale,JSON.parse(fs.readFileSync(`assets/puzzles/${locale==='en'?'':locale+'/'}hard.json`))]));
 const en=puzzles.en.filter(p=>p.type==='geometry_measure');assert.equal(en.length,30);
 const labels=['en','lv','ru'].map(l=>JSON.parse(fs.readFileSync(`locales/${l}.json`)).geometryModels);
 for(const label of labels){assert.deepEqual(Object.keys(label).sort(),Object.keys(labels[0]).sort());assert.ok(Object.values(label).every(v=>v.length));}
 const comparisons=new Set();
 for(const p of en){
  const {mode,width:w,height:h,other}=p.payload;
  assert.ok([w,h].every(n=>Number.isInteger(n)&&n>0&&n<=9));
  const target=mode==='area'?w*h:mode==='perimeter'?2*w+2*h:mode.startsWith('missing')?h:w+h===other.width+other.height?2:w+h>other.width+other.height?0:1;
  assert.equal(geometryTarget(p),target);
  assert.equal(getPuzzleDraftAnswer(p,{geometry:null}),null);
  assert.equal(checkPuzzleAnswer(p,{kind:'choice',index:target}),false);
  for(let value=-1;value<=100;value++)assert.equal(checkPuzzleAnswer(p,{kind:'geometry',value}),value===target);
  for(const bad of [NaN,Infinity,target+.5])assert.equal(checkGeometryAnswer(p,bad),false);
  let entered=null;for(const digit of String(target))entered=appendGeometryDigit(entered,Number(digit));
  assert.ok(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{geometry:entered})));
  assert.equal(getVisualExplanation(p).keyframes.length,3);
  if(mode==='compare'){assert.equal(w*h,other.width*other.height,'Equal-area comparison really has equal area');comparisons.add(target);}
  if(mode==='area'&&w*h!==2*(w+h))assert.equal(getPuzzleAttemptHint(p,{kind:'geometry',value:2*(w+h)}).key,'geometryAreaNotBoundary');
  if(mode==='perimeter'&&w*h!==2*(w+h))assert.equal(getPuzzleAttemptHint(p,{kind:'geometry',value:w*h}).key,'geometryBoundaryNotArea');
  for(const locale of ['lv','ru']){
   const translated=puzzles[locale].find(q=>q.id===p.id);assert.equal(translated.type,p.type);assert.deepEqual(translated.payload,p.payload);assert.deepEqual(translated.learning,p.learning);
   assert.ok(checkPuzzleAnswer(translated,{kind:'geometry',value:target}));assert.ok(translated.question!==p.question);
  }
 }
 assert.deepEqual([...comparisons].sort(),[0,1,2],'All comparison answers occur, including equal perimeters');
 for(let w=1;w<=9;w++)for(let h=1;h<=9;h++){
  const edges=rectangleEdges(w,h);assert.equal(edges.length,2*(w+h));
  assert.equal(new Set(edges.map(e=>`${e.x},${e.y},${e.horizontal}`)).size,edges.length);
  assert.ok(edges.every(e=>e.horizontal?(e.y===0||e.y===h)&&e.x>=0&&e.x<w:(e.x===0||e.x===w)&&e.y>=0&&e.y<h),'Only outside unit edges are traced');
 }
 assert.equal(appendGeometryDigit(null,0),0);assert.equal(appendGeometryDigit(99,9),999);assert.equal(appendGeometryDigit(999,9),999);
 for(const bad of [-1,10,.5,NaN])assert.equal(appendGeometryDigit(null,bad),null);
 const {PUZZLE_PATHS,getPathStepState,isPathAvailable}=load('@/constants/puzzle-path');
 const {createDefaultGameSave,parseGameSaveFromValue}=load('@/utils/game-storage');
 const {beginTimedChallenge}=load('@/utils/timed-challenge');
 for(const plan of GEOMETRY_PILOT_LESSONS){
  const lesson=PUZZLE_PATHS.find(l=>l.id===plan.id),tasks=lesson.levels.map(l=>puzzles.en.find(p=>p.id===l.puzzleIds[0]));
  assert.equal(tasks.length,10);assert.deepEqual(clone(tasks.map(p=>{const {guided,...payload}=p.payload;return payload;})),plan.tasks);
  assert.ok(tasks.slice(0,3).every(p=>p.payload.guided)&&tasks.slice(3).every(p=>!p.payload.guided));
  for(const locale of ['en','lv','ru'])for(let count=0;count<=10;count++){
   const save=createDefaultGameSave();save.wallet.coins=241;
   save.progress.completedPuzzleIds=lesson.levels.slice(0,count).flatMap(l=>l.puzzleIds);
   save.progress.attemptedPuzzleIds=[...save.progress.completedPuzzleIds];save.progress.unlockedPathLessonIds=[lesson.id];save.progress.learningSupportIds=[lesson.levels[0].puzzleIds[0]];
   if(count===7)save.progress=beginTimedChallenge(save.progress,lesson.levels[7],'pre-geometry',Date.now(),'untimed');
   const before=clone(save),restored=parseGameSaveFromValue(JSON.stringify(save)).save;
   for(const key of ['completedPuzzleIds','attemptedPuzzleIds','unlockedPathLessonIds','learningSupportIds'])assert.deepEqual(clone(restored.progress[key]),before.progress[key]);
   assert.equal(restored.wallet.coins,241);assert.deepEqual(lesson.levels.map(l=>getPathStepState(lesson,l,restored.progress)),lesson.levels.map(l=>getPathStepState(lesson,l,before.progress)));
   assert.deepEqual(PUZZLE_PATHS.map(l=>isPathAvailable(l,restored.progress)),PUZZLE_PATHS.map(l=>isPathAvailable(l,before.progress)));
   for(const id of restored.progress.completedPuzzleIds)assert.ok(puzzles[locale].some(p=>p.id===id),'Completed IDs resolve after changing language');
   if(count===7)assert.deepEqual(clone(restored.progress.challengeAttempt),before.progress.challengeAttempt);
  }
 }
 console.log('Verified 30 geometry tasks in English, Latvian and Russian: exact area/perimeter, boundary edges, equal-area comparisons, missing sides, answer entry, guidance and progress across every lesson boundary.');
}
