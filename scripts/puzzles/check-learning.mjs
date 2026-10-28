import assert from 'node:assert/strict';
export function checkLearning({load}) {
  const {LEARNING_CATALOG,getPracticeIds}=load('@/constants/curriculum');
  const {getPuzzlesByDifficulty}=load('@/constants/puzzles');
  const {shufflePuzzleChoices}=load('@/utils/puzzle-practice');
  const {checkPuzzleAnswer}=load('@/utils/puzzle-type');
  const {createDefaultGameSave,parseGameSaveFromValue}=load('@/utils/game-storage');
  const {applyPuzzleAnswer}=load('@/utils/game-operations');
  const {applyLearningReview}=load('@/utils/learning-review');
  const {getLearningReview}=load('@/constants/learning-review');
  const clone=x=>JSON.parse(JSON.stringify(x)), now=Date.now(),day=Math.floor(now/86400000);
  const lesson=LEARNING_CATALOG.lessons.find(l=>l.id==='easy-addition-join');
  const all=['easy','medium','hard'].flatMap(d=>getPuzzlesByDifficulty('en',d)),byId=new Map(all.map(p=>[p.id,p]));
  const ranks=[0,0,0], reviewRanks=[0,0,0], reviewPositions=[0,0,0];
  for(const tier of ['easy','medium','hard']) {
    for(const locale of ['en','lv']) {
      const comparisons=getPuzzlesByDifficulty(locale,tier).filter(p=>p.type==='compare');
      assert.ok(Math.abs(comparisons.filter(p=>p.correctIndex===0).length-comparisons.filter(p=>p.correctIndex===1).length)<=1,'Comparison answers balance left and right');
      for(const p of comparisons) {
        const original=clone(p),positions=new Set();
        for(let seed=0;seed<12;seed++) {
          const shuffled=shufflePuzzleChoices(p,`review-${seed}`);positions.add(shuffled.correctIndex);
          assert.ok(checkPuzzleAnswer(shuffled,{kind:'choice',index:shuffled.correctIndex}));
          assert.equal(shuffled.correctIndex===0?shuffled.payload.optionA:shuffled.payload.optionB,p.correctIndex===0?p.payload.optionA:p.payload.optionB,'Swapping keeps the mathematical answer');
        }
        assert.equal(positions.size,2);assert.deepEqual(clone(p),original,'Shuffling never mutates catalog content');
      }
    }
  }
  for(const l of LEARNING_CATALOG.lessons) {
    assert.ok(l.skillId);assert.ok(l.prerequisiteSkillIds.every(id=>LEARNING_CATALOG.lessons.some(p=>p.skillId===id)));
    for(const id of getPracticeIds(l)) {
      const p=byId.get(id),choices=p.choices??p.payload?.choices;
      assert.equal(p.learning.skillId,l.skillId);
      if(choices?.every(s=>/^\d+$/.test(s))&&'correctIndex' in p) ranks[choices.map(Number).filter(n=>n<Number(choices[p.correctIndex])).length]++;
    }
    for(let variant=0;variant<12;variant++) {
      const check=getLearningReview(l,day+variant);
      assert.equal(new Set(check.choices).size,check.choices.length,'Review choices are distinct');
      assert.ok(check.correctIndex>=0&&check.correctIndex<check.choices.length);
      if(check.choices.every(value=>/^\d+$/.test(value))) {
        reviewRanks[check.choices.map(Number).filter(n=>n<Number(check.choices[check.correctIndex])).length]++;
        reviewPositions[check.correctIndex]++;
      }
    }
  }
  for(const distribution of [reviewRanks,reviewPositions]) assert.ok(distribution.every(n=>n/distribution.reduce((a,b)=>a+b,0)>.2&&n/distribution.reduce((a,b)=>a+b,0)<.45),`Review answers vary rank and position: ${distribution}`);
  const total=ranks.reduce((a,b)=>a+b,0);
  assert.ok(ranks.every(n=>n/total>.2&&n/total<.45),`Numeric answer ranks are balanced: ${ranks}`);
  const firstFractions=LEARNING_CATALOG.lessons.filter(l=>l.difficulty==='easy'&&l.topicId==='fractions').slice(0,5);
  assert.ok(firstFractions.every(l=>l.levels.flatMap(v=>v.puzzleIds).every(id=>byId.get(id).type!=='fraction_equivalent')),'Equivalence follows introductory fraction work');
  assert.ok(getPracticeIds(lesson).every(id=>byId.get(id).type==='multiple_choice'),'First addition lesson keeps familiar joining controls');
  assert.ok(getPracticeIds(lesson).every(id=>!byId.get(id).hint.includes('full ten')),'Small sums receive a suitable hint');

  const empty=createDefaultGameSave();empty.progress.lives={current:0,nextRegenAt:now+1800000};
  const check=getLearningReview(lesson,day);
  assert.equal(applyLearningReview(empty,lesson.id,day,check.correctIndex,now).accepted,false,'Independent checks remain gated at zero lives');

  let evidenceSave=createDefaultGameSave();
  const [p1,p2,p3,p4]=getPracticeIds(lesson).map(id=>byId.get(id));
  evidenceSave=applyPuzzleAnswer(evidenceSave,p1,true,'independent-1',now).save;
  evidenceSave=applyPuzzleAnswer(evidenceSave,p2,true,'independent-2',now).save;
  assert.equal(evidenceSave.progress.learningEvidence[lesson.skillId].independentPuzzleIds.length,2);
  const legacy=clone(evidenceSave);
  legacy.progress.guidedAttemptIds=['old-session'];
  legacy.progress.learningEvidence[lesson.skillId].guidedSessions=2;
  const migrated=parseGameSaveFromValue(JSON.stringify(legacy)).save;
  assert.equal('guidedAttemptIds' in migrated.progress,false);
  assert.equal('guidedSessions' in migrated.progress.learningEvidence[lesson.skillId],false);
  assert.deepEqual(clone(migrated.wallet),clone(evidenceSave.wallet));
  assert.deepEqual(clone(migrated.progress.completedPuzzleIds),clone(evidenceSave.progress.completedPuzzleIds));
  const helped=applyPuzzleAnswer(evidenceSave,p3,true,'helped',now,{helpUsed:true}).save;
  assert.equal(helped.progress.learningEvidence[lesson.skillId].independentPuzzleIds.length,2);
  assert.equal(helped.progress.learningEvidence[lesson.skillId].supportedSuccesses,1);
  const helpSave=clone(evidenceSave);helpSave.progress.learningSupportIds=[p3.id];
  const reopenedHelp=parseGameSaveFromValue(JSON.stringify(helpSave)).save;
  const supported=applyPuzzleAnswer(reopenedHelp,p3,true,'reopened-help',now).save;
  assert.equal(supported.progress.learningEvidence[lesson.skillId].independentPuzzleIds.length,2,'Viewing help remains supported after reopening');
  assert.equal(supported.progress.learningEvidence[lesson.skillId].supportedSuccesses,1);
  let retry=applyPuzzleAnswer(helped,p4,false,'wrong',now).save;
  retry=parseGameSaveFromValue(JSON.stringify(retry)).save;
  retry=applyPuzzleAnswer(retry,p4,true,'retry',now).save;
  assert.equal(retry.progress.learningEvidence[lesson.skillId].independentPuzzleIds.length,2,'Reopening after a mistake does not make a retry independent');
  const correctReview=applyLearningReview(evidenceSave,lesson.id,day,check.correctIndex,now);
  assert.equal(correctReview.accepted,true);assert.equal(correctReview.correct,true);
  assert.equal(correctReview.save.progress.learningEvidence[lesson.skillId].reviewCorrect,1);
  assert.deepEqual(clone(correctReview.save.wallet),clone(evidenceSave.wallet),'Review never awards currency');
  assert.deepEqual(clone(correctReview.save.progress.completedPuzzleIds),clone(evidenceSave.progress.completedPuzzleIds));
  assert.equal(applyLearningReview(correctReview.save,lesson.id,day,check.correctIndex,now).accepted,false,'A review cannot be farmed by reopening');
  const failedReview=applyLearningReview(evidenceSave,lesson.id,day,(check.correctIndex+1)%3,now);
  assert.equal(failedReview.save.progress.lives.current,evidenceSave.progress.lives.current-1);
  assert.equal(applyLearningReview(parseGameSaveFromValue(JSON.stringify(failedReview.save)).save,lesson.id,day,check.correctIndex,now).accepted,false,'An exposed review answer cannot become independent evidence');
  assert.equal(applyLearningReview(evidenceSave,lesson.id,day-1,check.correctIndex,now).accepted,false,'Stale checks cannot submit');
  const timed = clone(evidenceSave);
  timed.progress.lives = {current:1,nextRegenAt:now+1800000};
  timed.progress.challengeAttempt = {id:'expired-review-test',levelId:'test',puzzleId:'test',startedAt:now-2000,deadlineAt:now-1000,status:'active'};
  const afterExpiry = applyLearningReview(timed,lesson.id,day,check.correctIndex,now);
  assert.equal(afterExpiry.accepted,false,'An expired challenge spends the last life before a review');
  assert.equal(afterExpiry.save.progress.lives.current,0);
  assert.equal(afterExpiry.save.progress.challengeAttempt.status,'expired');
  console.log(`Verified saved evidence, legacy save compatibility, independent review life costs, and numeric answer ranks ${ranks.join('/')}.`);
}
