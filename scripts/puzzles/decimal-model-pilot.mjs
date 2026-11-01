const grid = (hundredths, scale = 100, digits = 2) => ({ type: 'decimal_grid', hundredths, scale, digits });
const place = (hundredths, digits = 2, mode = 'build', exchangeUnit = 'hundredths') => ({ type: 'decimal_place_value', hundredths, digits, mode, exchangeUnit, units: digits === 1 ? ['ones', 'tenths'] : ['ones', 'tenths', 'hundredths'] });
// Tasks follow the visible ten-step path: practice, applications, challenge, reviews.
export const DECIMAL_PILOT_LESSONS = [
  { id: 'medium-fractions-explore-7', title: { en: 'Tenths as decimals', lv: 'Desmitdaļas decimāldaļās' }, tasks: [
    grid(30,10,1), place(60,1), grid(40,10,1), place(20,1), grid(70,10,1), place(90,1), grid(50,10,1), place(80,1), grid(10,10,1), place(100,1),
  ] },
  { id: 'medium-fractions-explore-8', title: { en: 'Hundredths and zero placeholders', lv: 'Simtdaļas un nulles pierakstā' }, tasks: [
    grid(40), place(35), grid(7), place(60), grid(24), place(9), grid(80,100,1), place(52), grid(5), place(90),
  ] },
  { id: 'medium-fractions-explore-9', title: { en: 'Build and exchange decimals', lv: 'Veido un samaini decimāldaļas' }, tasks: [
    place(125), place(46,2,'bundle'), place(73,2,'split'), grid(58), place(104), grid(62), place(109), place(163), place(87,2,'bundle'), place(206),
  ] },
];
const number = (n, digits, lv) => `${Math.floor(n/100)}${lv?',':'.'}${String(n%100).padStart(2,'0').slice(0,digits)}`;
export function applyDecimalModelPilot({ puzzles, lessons, pathExtras }) {
  for (const plan of DECIMAL_PILOT_LESSONS) {
    const lesson = lessons.find(l=>l.id===plan.id); lesson.title=plan.title;
    lesson.description={en:'Connect tenths and hundredths to decimals, then build and exchange equal amounts.',lv:'Saisti desmitdaļas un simtdaļas ar decimāldaļām, tad veido un samaini vienādus daudzumus.'};
    const ids=[...lesson.levels.filter(l=>l.kind==='practice').flatMap(l=>l.puzzleIds), ...lesson.levels.filter(l=>l.kind==='boss').flatMap(l=>l.puzzleIds), ...lesson.levels.filter(l=>l.kind==='challenge').flatMap(l=>l.puzzleIds), ...pathExtras[lesson.id]];
    for(const locale of ['en','lv']) ids.forEach((id,i)=>{
      const p=puzzles[locale].medium.find(p=>p.id===id), {difficulty,ageRange,learning}=p;
      const {type,...payload}=plan.tasks[i], {hundredths:n,digits,scale,mode}=payload, lv=locale==='lv', label=number(n,digits,lv);
      const question=type==='decimal_grid' ? (lv?`Iekrāso ${label} no veselā.`:`Shade ${label} of the whole.`)
        : mode==='build' ? (lv?`Izveido skaitli ${label}.`:`Build ${label}.`)
        : mode==='bundle' ? (lv?'Samaini 10 simtdaļas pret 1 desmitdaļu.':'Exchange 10 hundredths for 1 tenth.')
        : (lv?'Samaini 1 desmitdaļu pret 10 simtdaļām.':'Exchange 1 tenth for 10 hundredths.');
      const hint=type==='decimal_grid' ? (lv?`Veselajā ir ${scale} vienādas daļas. Katra daļa ir ${scale===10?'0,1':'0,01'}.`:`The whole has ${scale} equal parts. Each part is ${scale===10?'0.1':'0.01'}.`)
        : mode==='build' && digits===1 ? (lv?'Pirms komata ir vieni, aiz tā ir desmitdaļas. Desmit desmitdaļas veido vienu veselo.':'Ones come before the decimal point and tenths after it. Ten tenths make one whole.')
        : mode==='build' ? (lv?'Pirms komata ir vieni, aiz tā ir desmitdaļas un tad simtdaļas. Nulle saglabā cipara vietu.':'Ones come before the decimal point, then tenths and hundredths. A zero holds an empty place.')
        : (lv?'Desmit simtdaļas ir viena desmitdaļa. Samainot daudzums nemainās.':'Ten hundredths equal one tenth. Exchanging keeps the total unchanged.');
      const explanation=type==='decimal_grid' ? `${n*scale/100}/${scale} = ${label}.` : mode==='build'
        ? `${Math.floor(n/100)} × 1 + ${Math.floor(n%100/10)} × ${number(10,1,lv)}${digits===2?` + ${n%10} × ${number(1,2,lv)}`:''} = ${label}.`
        : `${number(10,2,lv)} = ${number(10,1,lv)}. ${lv?'Kopā joprojām':'The total is still'} ${label}.`;
      for(const key of Object.keys(p)) delete p[key];
      Object.assign(p,{id,difficulty,ageRange,learning:{...learning,representation:type==='decimal_grid'?'fraction-model':'objects',reasoningSteps:mode==='bundle'||mode==='split'?2:1},topic:'fractions',type,question,hint,explanation,payload:{...payload,guided:i<3},helpTemplate:type==='decimal_grid'?`decimal_grid_${scale}`:`decimal_place_${digits===1?'tenths':mode}`});
    });
  }
  for(const locale of ['en','lv']) puzzles[locale].medium.filter(p=>p.type==='compare').forEach((p,i)=>{
    if(p.correctIndex!==i%2){[p.payload.optionA,p.payload.optionB]=[p.payload.optionB,p.payload.optionA];p.correctIndex=i%2;}
  });
}
