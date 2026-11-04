const area=(width,height)=>({mode:'area',width,height});
const perimeter=(width,height)=>({mode:'perimeter',width,height});
const compare=(width,height,w,h)=>({mode:'compare',width,height,other:{width:w,height:h}});
const missing=(mode,width,height)=>({mode,width,height});
export const GEOMETRY_PILOT_LESSONS=[
  {id:'hard-measurement-area',title:{en:'Area with unit squares',lv:'Laukums ar vienības kvadrātiem'},tasks:[area(2,3),area(3,3),area(4,3),area(4,4),area(5,2),area(3,5),area(2,6),area(4,5),area(3,6),area(5,5)]},
  {id:'hard-measurement-explore-3',title:{en:'Perimeter around the boundary',lv:'Perimetrs gar ārējo malu'},tasks:[perimeter(2,3),perimeter(3,3),perimeter(4,3),perimeter(5,2),area(4,4),perimeter(6,2),area(3,5),perimeter(5,4),area(2,7),perimeter(4,6)]},
  {id:'hard-measurement-explore-6',title:{en:'Compare rectangles and find missing sides',lv:'Salīdzini taisnstūrus un atrodi nezināmās malas'},tasks:[compare(3,4,2,6),missing('missing_area',3,5),missing('missing_perimeter',4,3),compare(1,8,2,4),missing('missing_area',4,6),compare(2,6,3,4),missing('missing_perimeter',5,2),missing('missing_area',5,7),compare(3,6,6,3),missing('missing_perimeter',6,5)]},
];
const words={
 area:{en:['What is the area of this rectangle?','Count the unit squares inside the boundary. Each square has area one square unit.'],lv:['Kāds ir šī taisnstūra laukums?','Saskaiti vienības kvadrātus ārējās malas iekšpusē. Katra kvadrāta laukums ir viena kvadrātvienība.']},
 perimeter:{en:['What is the perimeter of this rectangle?','Count every unit edge around the outside once. Do not count the lines inside.'],lv:['Kāds ir šī taisnstūra perimetrs?','Saskaiti katru vienības nogriezni ārējā malā vienu reizi. Neskaiti līnijas iekšpusē.']},
 compare:{en:['Which rectangle has the larger perimeter?','The areas are equal. Compare the total lengths around the two boundaries. They may be equal too.'],lv:['Kuram taisnstūrim ir lielāks perimetrs?','Laukumi ir vienādi. Salīdzini abu taisnstūru ārējo malu kopgarumu. Arī tas var būt vienāds.']},
 missing_area:{en:['Find the missing side using the area.','Divide the area by the known side length. The drawing is not to scale.'],lv:['Atrodi nezināmo malu, izmantojot laukumu.','Izdali laukumu ar zināmās malas garumu. Zīmējums nav mērogā.']},
 missing_perimeter:{en:['Find the missing side using the perimeter.','Halve the perimeter, then subtract the known side. The drawing is not to scale.'],lv:['Atrodi nezināmo malu, izmantojot perimetru.','Izdali perimetru ar divi un atņem zināmo malu. Zīmējums nav mērogā.']},
};
export function applyGeometryPilot({puzzles,lessons,pathExtras}){
 for(const plan of GEOMETRY_PILOT_LESSONS){
  const lesson=lessons.find(l=>l.id===plan.id);lesson.title=plan.title;
  lesson.description={en:'Measure the inside and the boundary, then use the measurements to reason about rectangles.',lv:'Izmēri iekšpusi un ārējo malu, tad izmanto mērījumus, lai spriestu par taisnstūriem.'};
  const ids=[...lesson.levels.filter(l=>l.kind==='practice').flatMap(l=>l.puzzleIds),...lesson.levels.filter(l=>l.kind==='boss').flatMap(l=>l.puzzleIds),...lesson.levels.filter(l=>l.kind==='challenge').flatMap(l=>l.puzzleIds),...pathExtras[lesson.id]];
  for(const locale of ['en','lv'])ids.forEach((id,i)=>{
   const p=puzzles[locale].hard.find(p=>p.id===id),{difficulty,ageRange,learning}=p,payload=plan.tasks[i];
   const {mode,width:w,height:h,other}=payload;
   const [question,hint]=words[mode][locale];
   const explanation=mode==='area'?`${w} × ${h} = ${w*h}.`:mode==='perimeter'?`${w} + ${h} + ${w} + ${h} = ${2*(w+h)}.`
    :mode==='missing_area'?`${w*h} ÷ ${w} = ${h}.`:mode==='missing_perimeter'?`${2*(w+h)} ÷ 2 − ${w} = ${h}.`
    :`A: ${2*(w+h)}; B: ${2*(other.width+other.height)}.`;
   for(const key of Object.keys(p))delete p[key];
   Object.assign(p,{id,difficulty,ageRange,learning:{...learning,representation:'objects',reasoningSteps:mode==='compare'||mode==='missing_perimeter'?2:1},topic:'measurement',type:'geometry_measure',question,hint,explanation,payload:{...payload,guided:i<3},helpTemplate:`geometry_${mode}`});
  });
 }
 // Replacing estimation slots must not restore the old smallest-answer shortcut.
 for(const locale of ['en','lv'])puzzles[locale].hard.filter(p=>p.type==='estimate').forEach((p,i)=>{
  const label=p.payload.choices[p.correctIndex],correct=Number(label.match(/\d+/)[0]),rank=i%3;
  const wrong=rank===0?[correct+10,correct+20]:rank===1?[correct-10,correct+10]:[correct-10,correct-20];
  const index=(i*2+1)%3,values=[...wrong];values.splice(index,0,correct);
  p.payload.choices=values.map(n=>label.replace(/\d+/,String(n)));p.correctIndex=index;
 });
 for(const locale of ['en','lv'])puzzles[locale].hard.filter(p=>p.type==='compare').forEach((p,i)=>{if(p.correctIndex!==i%2){[p.payload.optionA,p.payload.optionB]=[p.payload.optionB,p.payload.optionA];p.correctIndex=i%2;}});
}
