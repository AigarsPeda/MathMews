import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FRACTION_PILOT_LESSONS } from './fraction-model-pilot.mjs';

export function checkFractionModels({ load }) {
  const clone = v => JSON.parse(JSON.stringify(v));
  const { validFractionPoint, validFractionStrip, fractionTickAt, partitionFractionStrip } = load('@/utils/fraction-models');
  const { checkPuzzleAnswer } = load('@/utils/puzzle-type');
  const { getPuzzleDraftAnswer, getPuzzleAttemptHint } = load('@/utils/puzzle-attempt');
  const { getVisualExplanation } = load('@/constants/visual-explanations');
  const read = locale => ['easy','medium','hard'].flatMap(d => JSON.parse(fs.readFileSync(`assets/puzzles/${locale==='lv'?'lv/':''}${d}.json`)));
  const en = read('en'), lv = read('lv');
  const labels = ['en','lv'].map(l => JSON.parse(fs.readFileSync(`locales/${l}.json`)));
  assert.deepEqual(Object.keys(labels[0].fractionModels).sort(), Object.keys(labels[1].fractionModels).sort());
  for (const l of labels) assert.ok(Object.values(l.fractionModels).every(v => typeof v === 'string' && v.length > 0));
  const boards = en.filter(p => ['fraction_number_line','fraction_strip'].includes(p.type));
  assert.equal(boards.length,28);
  const positions = new Set();
  for (const p of boards) {
    const counterpart = lv.find(q=>q.id===p.id), { numerator:n,denominator:d } = p.payload;
    assert.deepEqual(counterpart.payload,p.payload);
    assert.ok(Number.isInteger(n) && Number.isInteger(d) && d > 0 && n > 0 && n <= d);
    assert.equal(checkPuzzleAnswer(p,{kind:'choice',index:0}),false);
    assert.equal(getPuzzleDraftAnswer(p,{numberLine:null,fractionStrip:null}),null);
    assert.equal(getVisualExplanation(p).keyframes.length,3);
    if(p.type==='fraction_number_line') {
      const divisions=p.payload.divisions;
      assert.ok(Number.isInteger(divisions) && divisions>=2 && divisions<=8);
      const answer=n*divisions/d;
      assert.ok(Number.isInteger(answer)); positions.add(answer);
      for(let tick=-1;tick<=divisions+1;tick++) {
        const expected=tick>=0 && tick<=divisions && tick*d===n*divisions;
        assert.equal(validFractionPoint(p,tick),expected);
        assert.equal(checkPuzzleAnswer(p,{kind:'fraction_point',tick}),expected);
      }
      for(const bad of [NaN,Infinity,answer+.01]) assert.equal(validFractionPoint(p,bad),false);
      assert.ok(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{numberLine:answer})));
      assert.equal(getPuzzleAttemptHint(p,{kind:'fraction_point',tick:answer-1}).key,'moveRight');
      assert.equal(getPuzzleAttemptHint(p,{kind:'fraction_point',tick:answer+1}).key,'moveLeft');
      for(const width of [208,248,330]) for(let tick=0;tick<=divisions;tick++) {
        assert.equal(fractionTickAt(width*tick/divisions,width,divisions),tick,'Geometry snaps to exact integer ticks at narrow and wide sizes');
      }
    } else {
      const { partitions,mode }=p.payload;
      assert.equal(new Set(partitions).size,partitions.length);
      assert.ok(partitions.every(n=>Number.isInteger(n)&&n>=2&&n<=12));
      if(mode==='equivalent') assert.ok(!partitions.includes(d),'Repartitioning requires a different denominator');
      let solutions=0;
      for(const parts of partitions) {
        const fresh=partitionFractionStrip(p,parts);
        assert.equal(fresh.shaded,null);
        assert.equal(getPuzzleDraftAnswer(p,{fractionStrip:fresh}),null,'Choosing parts alone cannot submit');
        for(let shaded=-1;shaded<=parts+1;shaded++) {
          const state={parts,shaded}, expected=shaded>=0&&shaded<=parts&&shaded*d===n*parts;
          assert.equal(validFractionStrip(p,state),expected);
          assert.equal(checkPuzzleAnswer(p,{kind:'fraction_strip',state}),expected);
          if(expected) {solutions++;assert.ok(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{fractionStrip:state})));}
        }
        if(n*parts%d!==0) assert.equal(getPuzzleAttemptHint(p,{kind:'fraction_strip',state:{parts,shaded:0}}).key,'fractionDifferentParts');
        for(const bad of [null,NaN,Infinity,.5]) assert.equal(validFractionStrip(p,{parts,shaded:bad}),false);
      }
      assert.ok(solutions>=1,'Every strip has an exact solution');
      assert.equal(partitionFractionStrip(p,99),null);
      assert.equal(validFractionStrip(p,{parts:99,shaded:33}),false);
      assert.equal(getPuzzleDraftAnswer(p,{fractionStrip:null}),null,'Reset clears readiness');
    }
  }
  assert.ok(positions.size>=5,'Line answers cannot always be the first or middle tick');
  // Zero and one are selectable answers, not mistaken for an untouched draft.
  const sample=boards.find(p=>p.type==='fraction_number_line');
  for(const n of [0,4]) {
    const p={...sample,payload:{numerator:n,denominator:4,divisions:8,guided:false}};
    assert.ok(checkPuzzleAnswer(p,getPuzzleDraftAnswer(p,{numberLine:n*2})));
  }
  const strip=boards.find(p=>p.type==='fraction_strip');
  const zero={...strip,payload:{...strip.payload,numerator:0,denominator:4,partitions:[4]}};
  assert.ok(checkPuzzleAnswer(zero,getPuzzleDraftAnswer(zero,{fractionStrip:{parts:4,shaded:0}})));
  for(const args of [[1,0,4],[NaN,20,4],[1,20,0],[1,20,1.5]]) assert.equal(fractionTickAt(...args),null);
  assert.equal(fractionTickAt(-30,200,4),0); assert.equal(fractionTickAt(300,200,4),4);

  const { PUZZLE_PATHS, getPathStepState, isPathAvailable } = load('@/constants/puzzle-path');
  const { createDefaultGameSave, parseGameSaveFromValue } = load('@/utils/game-storage');
  const { beginTimedChallenge } = load('@/utils/timed-challenge');
  for(const plan of FRACTION_PILOT_LESSONS) {
    const lesson=PUZZLE_PATHS.find(l=>l.id===plan.id);
    const first=lesson.levels.slice(0,4).map(l=>en.find(p=>p.id===l.puzzleIds[0]));
    assert.ok(first.slice(0,3).every(p=>p.payload.guided)&&!first[3].payload.guided,'Guidance fades before independent placement');
    assert.ok(lesson.levels.slice(4,7).every(l=>!boards.some(p=>p.id===l.puzzleIds[0])),'Existing symbolic and picture transfer tasks remain');
    for(let count=0;count<=10;count++) {
      const save=createDefaultGameSave();save.wallet.coins=241;
      save.progress.completedPuzzleIds=lesson.levels.slice(0,count).flatMap(l=>l.puzzleIds);
      save.progress.attemptedPuzzleIds=[...save.progress.completedPuzzleIds];
      save.progress.unlockedPathLessonIds=[lesson.id];
      save.progress.learningSupportIds=[lesson.levels[0].puzzleIds[0]];
      if(count===7) save.progress=beginTimedChallenge(save.progress,lesson.levels[7],'pre-fraction-pilot',Date.now(),'untimed');
      const before=clone(save),restored=parseGameSaveFromValue(JSON.stringify(save)).save;
      for(const key of ['completedPuzzleIds','attemptedPuzzleIds','learningSupportIds','unlockedPathLessonIds']) assert.deepEqual(clone(restored.progress[key]),before.progress[key]);
      assert.equal(restored.wallet.coins,241);
      assert.deepEqual(lesson.levels.map(l=>getPathStepState(lesson,l,restored.progress)),lesson.levels.map(l=>getPathStepState(lesson,l,before.progress)));
      assert.deepEqual(PUZZLE_PATHS.map(l=>isPathAvailable(l,restored.progress)),PUZZLE_PATHS.map(l=>isPathAvailable(l,before.progress)));
      if(count===7) assert.deepEqual(clone(restored.progress.challengeAttempt),before.progress.challengeAttempt);
    }
  }
  console.log('Verified 28 bilingual fraction boards, all tick/partition answers, exact equivalence, endpoints, reset, guidance, and saves at every pilot step.');
}
