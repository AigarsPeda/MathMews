import { readPuzzles } from './catalog.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DECIMAL_PILOT_LESSONS } from './decimal-model-pilot.mjs';

export function checkDecimalModels({ load }) {
  const clone=v=>JSON.parse(JSON.stringify(v));
  const { decimalLabel, checkDecimalGrid, decimalGridCell, initialDecimalPlace, changeDecimalPlace, decimalTotal, checkDecimalPlace }=load('@/utils/decimal-models');
  const { checkPuzzleAnswer }=load('@/utils/puzzle-type');
  const { getPuzzleDraftAnswer, getPuzzleAttemptHint }=load('@/utils/puzzle-attempt');
  const { getVisualExplanation }=load('@/constants/visual-explanations');
  const en=readPuzzles('en', 'medium'), lv=readPuzzles('lv', 'medium');
  const boards=en.filter(p=>p.type.startsWith('decimal_'));assert.equal(boards.length,30);
  const labels=['en','lv'].map(l=>JSON.parse(fs.readFileSync(`locales/${l}.json`)).decimalModels);
  assert.deepEqual(Object.keys(labels[0]).sort(),Object.keys(labels[1]).sort());
  assert.ok(labels.every(l=>Object.values(l).every(v=>typeof v==='string'&&v.length>0)));
  assert.equal(decimalLabel(4,2,'en'),'0.04');assert.equal(decimalLabel(104,2,'lv-LV'),'1,04');
  assert.equal(decimalLabel(40,1,'en'),'0.4');assert.equal(decimalLabel(40,2,'lv'),'0,40');
  for(const p of boards) {
    const q=lv.find(q=>q.id===p.id), {hundredths:n,digits}=p.payload;
    assert.deepEqual(q.payload,p.payload);assert.ok(Number.isInteger(n)&&n>=0&&n<300);
    if(digits===1) assert.equal(n%10,0);
    assert.equal(getVisualExplanation(p).keyframes.length,3);
    assert.equal(checkPuzzleAnswer(p,{kind:'choice',index:0}),false);
    assert.equal(getPuzzleDraftAnswer(p,{decimalGrid:null,decimalPlace:null}),null);
    if(p.type==='decimal_grid') {
      const {scale}=p.payload;assert.ok(n<=100&&[10,100].includes(scale));
      for(let count=-1;count<=scale+1;count++) {
        const expected=count>=0&&count<=scale&&count*100===n*scale;
        assert.equal(checkDecimalGrid(p,count),expected);
        assert.equal(checkPuzzleAnswer(p,{kind:'decimal_grid',shaded:count}),expected);
      }
      for(const bad of [NaN,Infinity,0.5]) assert.equal(checkDecimalGrid(p,bad),false);
      assert.ok(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{decimalGrid:n*scale/100})));
      assert.equal(getPuzzleAttemptHint(p,{kind:'decimal_grid',shaded:0}).key,'decimalGridFew');
      for(const width of [180,220,280]) for(let count=1;count<=scale;count++) {
        const x=((count-1)%10+.5)*width/10, y=scale===10?width/2:(Math.floor((count-1)/10)+.5)*width/10;
        assert.equal(decimalGridCell(x,y,width,scale),count);
      }
    } else {
      const {mode,exchangeUnit,units}=p.payload;
      const initial=initialDecimalPlace(p), before=clone(initial);
      assert.ok(Object.values(initial).every(n=>Number.isInteger(n)&&n>=0),'Every authored starting board has real, nonnegative pieces');
      if(mode==='build') {
        let state=initial;
        for(const [unit,count] of [['ones',Math.floor(n/100)],['tenths',Math.floor(n%100/10)],['hundredths',n%10]]) {
          for(let i=0;i<count;i++) state=changeDecimalPlace(p,state,{kind:'add',unit});
        }
        assert.equal(decimalTotal(state),n);assert.ok(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{decimalPlace:state})));
        // Exhaust all reachable column combinations, including zero placeholders.
        for(let ones=0;ones<=2;ones++)for(let tenths=0;tenths<=9;tenths++)for(let hundredths=0;hundredths<=9;hundredths++){
          const s={ones,tenths,hundredths};
          assert.equal(checkDecimalPlace(p,s),decimalTotal(s)===n&&Object.keys(s).every(k=>units.includes(k)||s[k]===0));
        }
        assert.deepEqual(clone(changeDecimalPlace(p,initial,{kind:'remove',unit:'tenths'})),before);
        const max={ones:2,tenths:9,hundredths:9};
        for(const unit of units) assert.equal(changeDecimalPlace(p,max,{kind:'add',unit}),max);
      } else {
        assert.equal(decimalTotal(initial),n);assert.equal(checkDecimalPlace(p,initial),false,'Must perform the exchange');
        const action={kind:mode,unit:exchangeUnit}, changed=changeDecimalPlace(p,initial,action);
        assert.equal(decimalTotal(changed),n);assert.ok(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{decimalPlace:changed})));
        assert.equal(changeDecimalPlace(p,changed,action),changed,'A repeated exchange is disabled');
        assert.equal(changeDecimalPlace(p,initial,{kind:'add',unit:'ones'}),initial,'Cannot alter the quantity during exchange');
        assert.equal(changeDecimalPlace(p,initial,{kind:mode==='bundle'?'split':'bundle',unit:exchangeUnit}),initial);
        assert.equal(getPuzzleAttemptHint(p,{kind:'decimal_place',state:initial}).key,'decimalExchange');
      }
      assert.deepEqual(clone(initial),before,'Operations must not mutate drafts');
      for(const bad of [-1,NaN,Infinity,.5,20]) assert.equal(checkDecimalPlace(p,{ones:0,tenths:bad,hundredths:0}),false);
    }
  }
  const grid=boards.find(p=>p.type==='decimal_grid');
  for(const hundredths of [0,100]) {const p={...grid,payload:{...grid.payload,hundredths}};assert.ok(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{decimalGrid:hundredths/10})));}
  for(const args of [[1,1,0,100],[NaN,1,220,100],[1,Infinity,220,10]])assert.equal(decimalGridCell(...args),null);
  const { PUZZLE_PATHS, getPathStepState, isPathAvailable }=load('@/constants/puzzle-path');
  const { createDefaultGameSave, parseGameSaveFromValue }=load('@/utils/game-storage');
  const { beginTimedChallenge }=load('@/utils/timed-challenge');
  for(const plan of DECIMAL_PILOT_LESSONS){
    const lesson=PUZZLE_PATHS.find(l=>l.id===plan.id), tasks=lesson.levels.map(l=>en.find(p=>p.id===l.puzzleIds[0]));
    assert.deepEqual(clone(tasks.map(p=>p.payload.hundredths)),plan.tasks.map(p=>p.hundredths));
    assert.ok(tasks.slice(0,3).every(p=>p.payload.guided)&&tasks.slice(3).every(p=>!p.payload.guided));
    assert.equal(tasks[7].payload.mode,'build','The challenge requires constructing a fresh decimal, not one automatic exchange');
    for(let count=0;count<=10;count++){
      const save=createDefaultGameSave();save.wallet.coins=241;
      save.progress.completedPuzzleIds=lesson.levels.slice(0,count).flatMap(l=>l.puzzleIds);
      save.progress.attemptedPuzzleIds=[...save.progress.completedPuzzleIds];save.progress.unlockedPathLessonIds=[lesson.id];
      save.progress.learningSupportIds=[lesson.levels[0].puzzleIds[0]];
      if(count===7)save.progress=beginTimedChallenge(save.progress,lesson.levels[7],'pre-decimal-pilot',Date.now(),'untimed');
      const before=clone(save), restored=parseGameSaveFromValue(JSON.stringify(save)).save;
      for(const key of ['completedPuzzleIds','attemptedPuzzleIds','learningSupportIds','unlockedPathLessonIds'])assert.deepEqual(clone(restored.progress[key]),before.progress[key]);
      assert.equal(restored.wallet.coins,241);
      assert.deepEqual(lesson.levels.map(l=>getPathStepState(lesson,l,restored.progress)),lesson.levels.map(l=>getPathStepState(lesson,l,before.progress)));
      assert.deepEqual(PUZZLE_PATHS.map(l=>isPathAvailable(l,restored.progress)),PUZZLE_PATHS.map(l=>isPathAvailable(l,before.progress)));
      if(count===7)assert.deepEqual(clone(restored.progress.challengeAttempt),before.progress.challengeAttempt);
    }
  }
  console.log('Verified 30 bilingual decimal tasks, exact hundredths, every grid answer and place-value combination, conserved exchanges, zero placeholders, guidance, and saved progress at every step.');
}
