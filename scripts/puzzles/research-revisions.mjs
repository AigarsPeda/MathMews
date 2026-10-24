/** Teaching sequence revisions. Stable IDs keep saved progress and reward registrations. */
const text = (en, lv) => ({ en, lv });
const hash = value => [...value].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 0);
const addGoals = [
  ['join','Join small groups','Apvieno mazas grupas'], ['symbols','Pictures and sums','Attēli un summas'],
  ['count-on','Count on from a known amount','Skaiti tālāk no zināma daudzuma'], ['make-ten','Make ten, then add the rest','Izveido desmitu un pieskaiti pārējo'],
  ['missing-part','Find the missing part','Atrodi trūkstošo daļu'], ['pairs','Find pairs with the same total','Atrodi pārus ar vienādu summu'],
  ['explain','Check a sum with a model','Pārbaudi summu ar modeli'], ['repair','Repair an addition mistake','Izlabo saskaitīšanas kļūdu'],
  ['apply','Use addition in a story','Izmanto saskaitīšanu stāstā'], ['review','Revisit addition strategies','Atkārto saskaitīšanas paņēmienus'],
];
const fractionGoals = [
  ['equal-parts','Equal parts and halves','Vienādas daļas un puses'], ['quarters','Halves and quarters','Puses un ceturtdaļas'],
  ['unit','One part of a whole','Viena veselā daļa'], ['magnitude','Compare parts of the same whole','Salīdzini viena veselā daļas'],
  ['compare','Compare colored amounts','Salīdzini iekrāsotos daudzumus'], ['equivalence','Split pieces without changing the amount','Sadali sīkāk, saglabājot daudzumu'],
  ['models','Read different fraction pictures','Nolasi dažādus daļu attēlus'], ['equivalent','Choose equivalent fractions','Izvēlies vienādas daļas'],
  ['apply','Fractions in a collection','Daļas kolekcijā'], ['review','Revisit fraction ideas','Atkārto daļu jēdzienus'],
];
function arithmetic(stage, slot, boss, locale) {
  const lv=locale==='lv', a=stage<2 ? 2+slot : stage===2 ? 5+slot : 7+slot%3;
  const b=stage<2 ? 1+(slot+(boss?1:0))%3 : stage===2 ? 2+slot%2 : 4+slot%4;
  const total=a+b, base={topic:'addition',hint:lv?`Sāc ar ${a} un pieskaiti ${b}.`:`Start with ${a} and add ${b}.`,explanation:`${a} + ${b} = ${total}.`};
  if(stage===3) base.hint=lv?`Lai no ${a} iegūtu 10, vajag ${10-a}. Sadali ${b} un pieskaiti pārējo.`:`It takes ${10-a} to reach 10 from ${a}. Split ${b}, then add what remains.`;
  if(stage===4) return {...base,type:'balance',correctIndex:0,question:lv?'Kura daļa trūkst?':'Which part is missing?',payload:{leftDisplay:`${a} + ?`,rightValue:total,choices:[b,b+1,b+2].map(String)}};
  if(stage===5) return {...base,type:'pair_sum',question:lv?`Izvēlies divas kartītes, kuru summa ir ${total}.`:`Choose two tiles that make ${total}.`,payload:{numbers:[a,b,1,total-1],target:total,correctIndices:[0,1]},hint:lv?'Izvēlies vienu kartīti un atrodi trūkstošo daļu.':'Choose one tile and find the missing part.'};
  if(stage===7 || stage===6 && slot%2===1) return {...base,type:'fix_mistake',question:lv?'Kurš labojums dod pareizo kopskaitu?':'Which repair gives the correct total?',payload:{wrongWork:[`${a} + ${b} = ${total-1}`],choices:[total,total-1,total+1].map(n=>`${a} + ${b} = ${n}`)},correctIndex:0};
  if(stage===2 || stage===9 && slot===1) return {...base,type:'number_line',question:lv?`Sāc ar ${a} un lec ${b} soļus uz priekšu.`:`Start at ${a} and jump forward ${b}.`,payload:{start:a,jump:b,min:0,max:total+3,correctValue:total}};
  return {...base,type:'multiple_choice',question:lv?`Kaķim ir ${a} lentes, un viņš pievieno vēl ${b}. Cik lenšu kopā?`:`The cat has ${a} ribbons and adds ${b} more. How many altogether?`,choices:[total,total-1,total+1].map(String),correctIndex:0,taskVisual:{kind:'join',left:a,right:b,object:'ribbon'}};
}
function fraction(stage,slot,boss,locale) {
  const lv=locale==='lv', d=stage===0?2:stage===1?4:[3,4,6,8][(slot+(boss?1:0))%4], n=stage<3?1:1+slot%(d-1);
  const base={topic:'fractions',hint:lv?'Visām daļām jābūt vienādām. Saskaiti iekrāsotās daļas un visas daļas.':'Every part must be equal. Count the colored parts and all the parts.',explanation:lv?`${n} no ${d} vienādām daļām ir ${n}/${d}.`:`${n} out of ${d} equal parts is ${n}/${d}.`};
  if(stage>=5 && slot%3===2) return {...base,type:'fraction_equivalent',question:lv?'Sadali katru daļu uz pusēm. Kura daļa saglabā to pašu daudzumu?':'Split each piece in two. Which fraction keeps the same amount?',payload:{numerator:n,denominator:d,choices:[`${n*2}/${d*2}`,`${n}/${d*2}`,`${n+1}/${d}`]},correctIndex:0,explanation:`${n}/${d} = ${2*n}/${2*d}.`};
  if(stage>=3 && slot%3===1) return {...base,type:'compare',question:lv?'Veselie ir vienāda lieluma. Kura iekrāsotā daļa ir lielāka?':'The wholes are the same size. Which colored fraction is larger?',payload:{optionA:`${n}/${d}`,optionB:`${n+1}/${d}`},correctIndex:1,explanation:`${n+1}/${d} > ${n}/${d}.`};
  if(slot%2===1) return {...base,type:'fraction_match',question:lv?'Savieno daļu ar tās attēlu.':'Match each fraction to its picture.',payload:{pairs:[{numerator:n,denominator:d,visual:'pie'},{numerator:d,denominator:d,visual:'grid'}]},explanation:lv?'Daļas ir vienāda lieluma. Visas daļas kopā veido vienu veselo.':'The pieces are equal. All the pieces together make one whole.'};
  return {...base,type:'fraction_build',question:lv?`Iekrāso ${n} no ${d} vienādām daļām: ${n}/${d}.`:`Color ${n} of the ${d} equal parts: ${n}/${d}.`,payload:{numerator:n,denominator:d}};
}
function replaceTask(target, spec) {
  const {id,difficulty,ageRange}=target;
  for(const key of Object.keys(target)) delete target[key];
  Object.assign(target,{id,difficulty,ageRange,...spec});
}
export function applyResearchRevisions({puzzles,lessons}) {
  // The authoring factories may share payload objects between locales.
  for (const locale of ['en','lv']) for (const tier of ['easy','medium','hard']) for (const p of puzzles[locale][tier]) {
    if (p.payload) p.payload = structuredClone(p.payload);
    if (p.choices) p.choices = [...p.choices];
  }
  for(const topic of ['addition','fractions']) {
    const entries=lessons.filter(l=>l.difficulty==='easy'&&l.topicId===topic);
    entries.forEach((lesson,stage)=>{
      const goal=(topic==='addition'?addGoals:fractionGoals)[stage];
      lesson.title=text(goal[1],goal[2]);
      lesson.description=text(stage===9?'Revisit earlier strategies with new examples.':`Learn to ${goal[1].toLowerCase()}. Ask the cat for a guided example at any time.`,stage===9?'Atkārto iepriekšējos paņēmienus jaunos piemēros.':`${goal[2]}. Jebkurā brīdī vari mācīties kopā ar kaķi.`);
      lesson.skillId=`easy.${topic}.${goal[0]}`;
      lesson.prerequisiteSkillIds=stage?[`easy.${topic}.${(topic==='addition'?addGoals:fractionGoals)[stage-1][0]}`]:[];
      lesson.review=stage===9;
      for(const locale of ['en','lv']) {
        const byId=new Map(puzzles[locale].easy.map(p=>[p.id,p]));
        for(const level of lesson.levels) {
          // Keep the original topic finales and their scene-specific quantities.
          if(level.kind==='challenge' || level.kind==='boss'&&stage===9) continue;
          const ids=level.kind==='practice'?lesson.levels.filter(x=>x.kind==='practice').flatMap(x=>x.puzzleIds):level.puzzleIds;
          for(const id of level.puzzleIds) replaceTask(byId.get(id),(topic==='addition'?arithmetic:fraction)(stage,ids.indexOf(id),level.kind==='boss',locale));
        }
        if(topic==='fractions'&&stage<5) {
          const id=lesson.levels.find(l=>l.kind==='challenge').puzzleIds[0], p=byId.get(id), d=[2,4,3,4,6][stage], n=stage>=3?2:1;
          replaceTask(p,{type:'sort_buckets',topic:'fractions',question:locale==='lv'?'Sašķiro daļas pēc norādītā daudzuma.':'Sort the fractions by the amount shown.',hint:locale==='lv'?'Salīdzini skaitītāju un saucēju ar groza uzrakstu.':'Match the numerator and denominator to the basket label.',explanation:locale==='lv'?'Katra daļa atrodas pareizajā grozā.':'Each fraction is in its matching basket.',payload:{rule:'fractions',targets:[[n,d],[d,d]],fractions:[[n,d],[d,d],[n,d],[d,d]]},helpTemplate:'fraction_build'});
        }
      }
    });
  }
  // Metadata describes the skill and representation separately from the interaction control.
  for(const lesson of lessons) {
    lesson.skillId??=`${lesson.difficulty}.${lesson.topicId}.${lesson.id.split('-').slice(2).join('-')}`;
    const track = lessons.filter(l => l.difficulty === lesson.difficulty && l.topicId === lesson.topicId);
    const previous = track[track.indexOf(lesson) - 1];
    lesson.prerequisiteSkillIds ??= previous ? [previous.skillId ?? `${previous.difficulty}.${previous.topicId}.${previous.id.split('-').slice(2).join('-')}`] : [];
    for(const locale of ['en','lv']) {
      const byId=new Map(puzzles[locale][lesson.difficulty].map(p=>[p.id,p]));
      for(const level of lesson.levels) for(const id of level.puzzleIds) {
        const p=byId.get(id);
        p.learning={skillId:lesson.skillId,prerequisiteSkillIds:lesson.prerequisiteSkillIds,role:lesson.review?'review':level.kind==='practice'?'practice':'application',representation:p.taskVisual?'objects':p.type?.startsWith('fraction')?'fraction-model':'symbols',reasoningSteps:p.type==='operation_path'?p.payload.steps.length:p.type==='route_grid'?p.payload.moves:1};
      }
    }
  }
  for(const locale of ['en','lv']) for(const tier of ['easy','medium','hard']) {
    const comparisons=puzzles[locale][tier].filter(p=>p.type==='compare');
    comparisons.forEach((p,i)=>{
      const desired=i%2;
      if(p.correctIndex!==desired){[p.payload.optionA,p.payload.optionB]=[p.payload.optionB,p.payload.optionA];p.correctIndex=desired;}
    });
    for(const p of puzzles[locale][tier]) {
      const choices=p.choices||p.payload?.choices;
      if(!choices || !('correctIndex' in p) || !choices.every(s=>/^\d+$/.test(s))) continue;
      const value=Number(choices[p.correctIndex]);
      // Vary correct-value rank. Preserve authored errors when they fit the desired rank.
      const rank=value>=2?hash(p.id)%3:value===1?1:0;
      const wrong=choices.filter((_,i)=>i!==p.correctIndex).map(Number), selected=[];
      for(let i=0;i<2;i++) {
        const below=i<rank, existing=wrong.find(n=>(below?n<value:n>value)&&!selected.includes(n));
        let n=existing??value+(below?-(i+1):(i+1));
        while(n<0||n===value||selected.includes(n)) n=below?n-1:n+1;
        selected.push(n);
      }
      const fixed=[String(value),...selected.map(String)];
      if(p.choices)p.choices=fixed;else p.payload.choices=fixed;
      p.correctIndex=0;
    }
  }
}
