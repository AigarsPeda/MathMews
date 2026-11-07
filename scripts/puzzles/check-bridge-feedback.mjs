import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPuzzles } from './catalog.mjs';

export function checkBridgeFeedback({load}) {
  const { getPuzzleAttemptHint } = load('@/utils/puzzle-attempt');
  const { bridgeTarget, checkBridgeAnswer, transformEquation } = load('@/utils/bridge-models');
  const all=['easy','medium','hard'].flatMap(d=>readPuzzles('en',d));
  const langs=Object.fromEntries(['en','lv','ru'].map(l=>[l,JSON.parse(fs.readFileSync(`locales/${l}.json`)).play.attemptHints]));
  const clone=v=>JSON.parse(JSON.stringify(v));
  const p=(type,payload)=>({...all.find(p=>p.type===type),payload});
  const ratio=p('ratio_table',{a:2,b:3,targetA:4});
  const signed=p('signed_line',{mode:'move',start:-2,delta:3,min:-6,max:6});
  const plot=p('coordinate_map',{mode:'plot',start:{x:0,y:0},end:{x:2,y:3},min:-4,max:4});
  const translate=p('coordinate_map',{mode:'translate',start:{x:1,y:2},end:{x:2,y:-1},min:-4,max:4});
  const distance=p('coordinate_map',{mode:'distance',start:{x:-2,y:0},end:{x:3,y:0},min:-4,max:4});
  const equation=p('equation_board',{a:2,b:3,c:11});
  const cases=[
    [ratio,{value:5},'ratioAdded'],[ratio,{value:2},'ratioMustGrow'],[ratio,{value:4},'ratioLow'],[ratio,{value:8},'ratioHigh'],
    [p('ratio_table',{a:1,b:3,targetA:3}),{value:3},'ratioOneGroup'],
    [p('ratio_table',{a:3,b:12,targetA:1}),{value:12},'ratioMustShrink'],
    [signed,{value:-2},'signedNoMove'],[signed,{value:-5},'signedWrongDirection'],[signed,{value:0},'signedIntervals'],
    [signed,{value:-1},'signedTooFarLeft'],[signed,{value:4},'signedTooFarRight'],
    [p('signed_line',{mode:'place',start:-3,delta:0,min:-6,max:6}),{value:3},'signedSign'],
    [equation,{equation:{a:2,b:8,c:16}},'equationSubtract'],
    [p('equation_board',{a:2,b:-3,c:5}),{equation:{a:2,b:-3,c:5}},'equationAdd'],
    [equation,{equation:{a:2,b:0,c:8}},'equationDivide'],
    [equation,{equation:{a:1,b:0,c:999}},'equationCheck'],
    [plot,{point:{x:3,y:2}},'coordinateSwapped'],[plot,{point:{x:2,y:1}},'coordinateCheckY'],
    [plot,{point:{x:1,y:3}},'coordinateCheckX'],[plot,{point:{x:0,y:0}},'coordinateCheckBoth'],
    [translate,{point:{x:1,y:2}},'coordinateNotMoved'],[translate,{point:{x:2,y:-1}},'coordinateUsedMove'],
    [distance,{value:6},'coordinateCountSpaces'],[distance,{value:4},'coordinateDistanceLow'],[distance,{value:8},'coordinateDistanceHigh'],
  ];
  const used=new Set();
  for(const [puzzle,state,key] of cases){
    const original=clone({puzzle,state});
    for(const attempt of [1,2,3,10]){
      const hint=getPuzzleAttemptHint(puzzle,{kind:'bridge',state},attempt);
      assert.equal(hint.key,key);assert.equal(Boolean(hint.detailKey),attempt>=2);
      for(const k of [hint.key,hint.detailKey].filter(Boolean)){
        used.add(k);
        for(const lang of ['en','lv','ru']){
          assert.ok(langs[lang][k]?.trim(),`${lang}/${k}`);
          assert.doesNotMatch(langs[lang][k],/\d|\{\{|undefined|NaN/,'Hints describe a strategy without supplying numeric solutions');
        }
        assert.notEqual(langs.en[k],langs.lv[k]);assert.notEqual(langs.en[k],langs.ru[k]);
      }
    }
    assert.deepEqual(clone({puzzle,state}),original,'Feedback preserves the draft and authored puzzle');
  }
  let checked=0;
  for(const puzzle of all.filter(p=>['ratio_table','signed_line','equation_board','coordinate_map'].includes(p.type))){
    const target=bridgeTarget(puzzle),states=[];
    if(puzzle.type==='equation_board'){
      const {a,b,c}=puzzle.payload;
      states.push({equation:{a,b,c}},{equation:{a:1,b:0,c:target}});
      for(const op of ['add','divide'])for(const n of [-5,-1,1,2,3,4,5]){
        const next=transformEquation({a,b,c},op,n);if(next)states.push({equation:next});
      }
    }else if(typeof target==='number'){
      const min=puzzle.type==='signed_line'?puzzle.payload.min:0,max=puzzle.type==='signed_line'?puzzle.payload.max:Math.ceil(target)+12;
      for(let value=min;value<=max;value++)states.push({value});
    }else{
      for(let x=puzzle.payload.min;x<=puzzle.payload.max;x++)for(let y=puzzle.payload.min;y<=puzzle.payload.max;y++)states.push({point:{x,y}});
    }
    for(const state of states){
      const answer={kind:'bridge',state};
      const correct=checkBridgeAnswer(puzzle,state),h=getPuzzleAttemptHint(puzzle,answer,2);
      assert.equal(h===null,correct,`${puzzle.id}: no corrective hint for a solved board`);
      if(h)for(const lang of ['en','lv','ru'])assert.ok(langs[lang][h.key]&&langs[lang][h.detailKey]);
      checked++;
    }
    assert.equal(getPuzzleAttemptHint(puzzle,{kind:'bridge',state:{}},2),null);
    assert.equal(getPuzzleAttemptHint(puzzle,{kind:'choice',index:0},2),null);
  }
  console.log(`Verified bridge feedback across ${checked} drafts: ${cases.length} mistake diagnoses, ${used.size} translated hint keys, correct-answer silence, repeated-attempt guidance and immutable work.`);
}
