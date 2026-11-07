import assert from 'node:assert/strict';

// Solve the displayed questions, independently of the generator's answer/explanation.
export function solveAlignedReview(q) {
  const p = q.prompt.en, ns = p.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let m;
  if ((m = p.match(/area (\d+) square units and width (\d+)/))) return +m[1] / +m[2];
  if ((m = p.match(/perimeter (\d+) units and width (\d+)/))) return +m[1] / 2 - +m[2];
  if (p.startsWith('Equal-sized strips')) {
    const [,a,b]=ns;return a>b?'A':a<b?'B':'A = B';
  }
  if (p.startsWith('Rectangle A is')) {
    const [a,b,c,d] = ns, first = a+b, second = c+d;
    return first > second ? 'A' : first < second ? 'B' : 'A = B';
  }
  if (p.startsWith('A rectangle has') && p.includes('rows')) return ns[0]*ns[1];
  if (p.startsWith('A rectangle is')) return 2*(ns[0]+ns[1]);
  if (p.startsWith('Build ')) return ns[0]-10*ns[1];
  if (p.includes('Exchange one ten for ones')) return ns[1]+10;
  if (p.includes('Exchange ten ones for a ten')) return ns[0]+1;
  if (p.startsWith('Exchange tens')) return p.includes('−') ? ns[0]-ns[1] : ns[0]+ns[1];
  if (p.includes('Exchange one tenth for hundredths')) return ns[1]+10;
  if (p.includes('Exchange ten hundredths for a tenth')) return ns[0]+1;
  if (p.includes('which digit is in the tenths')) return Math.floor(Math.round(ns[0]*100)/10)%10;
  if (p.startsWith('How many hundredths make')) return Math.round(ns[0]*100);
  if (p.startsWith('A whole grid')) return Math.round(ns[0]*ns[1]);
  if ((m = p.match(/has (\d+) equal intervals.*reach (\d+)\/(\d+)/))) return +m[1]*+m[2]/+m[3];
  if (p.startsWith('Use the same rule')) {
    const seq=p.match(/in (.*)\?$/)[1].split(', ').map(n=>n==='?'?null:+n),i=seq.indexOf(null);
    const known=seq.slice(0,2), step=known[1]-known[0], factor=known[1]/known[0];
    const additive=seq.every((n,j)=>n===null||n===known[0]+step*j);
    const geometric=seq.every((n,j)=>n===null||Math.abs(n-known[0]*factor**j)<1e-9);
    assert.ok(additive||geometric,`Displayed sequence follows one consistent rule: ${p}`);
    return additive ? known[0]+step*i : Math.round(known[0]*factor**i);
  }
  if (p.includes('equal bags hold')) return ns[1]/ns[0]*ns[2];
  if (p.startsWith('Add ') && p.includes('round the total')) return Math.round((ns[0]+ns[1])/10)*10;
  if (p.includes('arranged in rows')) return ns[0]/ns[1];
  if (p.startsWith('What is') && p.includes('%')) return ns[0]*ns[1]/100;
  if (p.includes('before a') && p.includes('discount')) return ns[0]*(100-ns[1])/100;
  if (p.startsWith('Which even number')) return Array.from({length:ns[1]-ns[0]-1},(_,i)=>ns[0]+i+1).find(n=>n%2===0);
  if (p.startsWith('The code is')) return Array.from({length:ns[1]-ns[0]-1},(_,i)=>ns[0]+i+1).find(n=>n%ns[2]===0);
  if (p.startsWith('Someone claims')) {
    const matches=q.choices.map(Number).filter(n=>n%ns[0]===0&&n%2===1);
    assert.equal(matches.length,1,'Exactly one counterexample');return matches[0];
  }
  if (p.startsWith('A box holds')) return ns[0];
  if (p.startsWith('Which number comes just before')) return ns[0]-1;
  if (p.startsWith('Which number lies between')) return (ns[0]+ns[1])/2;
  if (p.startsWith('Which number comes just after')) return ns[0]+1;
  if (p.startsWith('Share ') && p.includes('whole cookies')) return p.includes('remain') ? ns[0]%ns[1] : Math.floor(ns[0]/ns[1]);
  if (p.includes('rows with') && p.includes('seeds')) return ns[0]*ns[1];
  if (/groups? holds?/.test(p)) return ns[1]/ns[0]*ns[2];
  if (p.startsWith('Start at') && p.includes('step')) return ns[0]+(p.includes('left')?-ns[1]:ns[1]);
  if ((m=p.match(/Find x: (\d*)x(?: ([+−]) (\d+))? = (-?\d+)/))) return (+m[4]-(m[2]==='−'?-1:1)*+(m[3]??0))/+(m[1]||1);
  if (p.includes('grid units separate')) return Math.abs(ns[2]-ns[0])+Math.abs(ns[3]-ns[1]);
  if (p.startsWith('Which ordered pair')) return `(${ns[0]}, ${ns[1]})`;
  if (p.startsWith('Start at (')) return `(${ns[0]+ns[2]}, ${ns[1]+ns[3]})`;
  if (p.startsWith('What is the value of')) {
    // Restricted arithmetic grammar, evaluated independently with ordinary precedence.
    const expr=p.slice('What is the value of '.length,-1).replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-');
    assert.match(expr,/^[\d\s+*/().-]+$/);
    return Function(`return (${expr})`)();
  }
  return undefined;
}

export function checkReviewAlignment({load}) {
  const {LEARNING_CATALOG}=load('@/constants/curriculum');
  const {getLearningReview}=load('@/constants/learning-review');
  const {getModelReview}=load('@/constants/model-review');
  const {getTopicReview}=load('@/constants/topic-review');
  const {getBridgeReview}=load('@/constants/bridge-review');
  const {numericReview}=load('@/utils/review-question');
  const clone=x=>JSON.parse(JSON.stringify(x));
  let solved=0;
  for(const l of LEARNING_CATALOG.lessons){
    const stage=LEARNING_CATALOG.lessons.filter(x=>x.difficulty===l.difficulty&&x.topicId===l.topicId).indexOf(l);
    const seen=new Set(),positions=new Set();
    for(let day=20760;day<20850;day++){
      const before=clone(l),q=getLearningReview(l,day);
      assert.deepEqual(clone(getLearningReview(l,day)),clone(q),'Reopening keeps the exact question and choices');
      assert.deepEqual(clone(l),before,'Generation does not change the saved catalog');
      assert.equal(q.choices.length,3,l.id);assert.equal(new Set(q.choices).size,3,l.id);
      assert.ok(Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<3);
      for(const lang of ['en','lv','ru']){
        assert.ok(q.prompt[lang]?.trim()&&q.explanation[lang]?.trim(),`${l.id}/${lang}`);
        assert.doesNotMatch(q.prompt[lang]+q.explanation[lang],/undefined|NaN|Infinity/);
        // All languages describe the same mathematical givens, including decimal commas.
        const numbers=s=>(s.replace(/(\d),(\d)/g,'$1.$2').match(/-?\d+(?:\.\d+)?/g)??[]).map(Number).sort((a,b)=>a-b);
        assert.deepEqual(numbers(q.prompt[lang]),numbers(q.prompt.en),`${l.id}/${lang}: prompt quantities`);
      }
      const aligned=getBridgeReview(l,day)??getModelReview(l,day)??getTopicReview(l,day,stage);
      if(aligned){
        const expected=solveAlignedReview(q);
        assert.notEqual(expected,undefined,`${l.id}: independent solver covers ${q.prompt.en}`);
        assert.equal(q.choices[q.correctIndex],String(expected),`${l.id}: ${q.prompt.en}`);
        assert.equal(q.choices.filter(c=>c===String(expected)).length,1);
        solved++;
      }
      seen.add(q.models ? JSON.stringify(q.models.en) : q.prompt.en);positions.add(q.correctIndex);
    }
    assert.equal(positions.size,3,`${l.id}: answer position varies`);
    if(l.topicId!=='fractions'||['medium-fractions-explore-7','medium-fractions-explore-8','medium-fractions-explore-9'].includes(l.id))
      assert.ok(seen.size>=(l.format === 'path' ? 3 : l.id==='easy-multiplication-rows'?5:8),`${l.id}: fresh givens, not just shuffled choices (${seen.size})`);
  }
  for(const id of ['hard-measurement-area','hard-measurement-explore-3','hard-measurement-explore-6','medium-fractions-explore-9','medium-operations-explore-9','hard-measurement-explore-9']){
    const l=LEARNING_CATALOG.lessons.find(l=>l.id===id),prompts=Array.from({length:90},(_,i)=>getLearningReview(l,20760+i).prompt.en).join('\n');
    const required=id.endsWith('area')?['area']:id.endsWith('explore-3')?['perimeter','area']:id.endsWith('explore-6')?['width','height','larger perimeter']:id.startsWith('medium-fractions')?['Exchange one tenth','Exchange ten hundredths','How many hundredths']:['grid units','Change x','ordered pair'];
    required.forEach(word=>assert.ok(prompts.includes(word),`${id}: review ${word}`));
  }
  // Bounds, deduplication and rank variation at zero and near an upper bound.
  for(const answer of [0,1,5,9,10])for(let i=0;i<50;i++){
    const q=numericReview({en:'',lv:'',ru:''},answer,'',`bounds/${i}`,[answer,answer,-1,100],0,10);
    assert.equal(new Set(q.choices).size,3);assert.ok(q.choices.every(s=>+s>=0&&+s<=10));
  }
  for(const id of ['hard-measurement-rates','hard-measurement-area','medium-addition-explore-8']){
    const l=LEARNING_CATALOG.lessons.find(l=>l.id===id),ranks=new Set();
    for(let day=20760;day<20850;day++){const q=getLearningReview(l,day),a=+q.choices[q.correctIndex];ranks.add(q.choices.filter(s=>+s<a).length);}
    assert.equal(ranks.size,3,`${id}: always choosing smallest/largest fails`);
  }
  console.log(`Verified 90 days × ${LEARNING_CATALOG.lessons.length} lessons in EN/LV/RU: ${solved} independently solved aligned questions, unique choices, varied givens and answer ranks, deterministic reopening and language parity.`);
}
