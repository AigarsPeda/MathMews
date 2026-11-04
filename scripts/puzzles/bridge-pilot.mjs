import { balanceTruthValues } from './progression-revisions.mjs';
const tr=(en,lv,ru)=>({en,lv,ru});
export const BRIDGE_TEXT={
 ratio_table:tr('Complete the missing amount in the ratio table.','Aizpildi trūkstošo daudzumu attiecību tabulā.','Заполни пропущенное количество в таблице отношений.'),
 signed_place:tr('Place the number on the number line.','Atzīmē skaitli uz skaitļu taisnes.','Отметь число на числовой прямой.'),
 signed_move:tr('Start at the first number. Find where the move ends.','Sāc pie pirmā skaitļa. Atrodi pārvietojuma beigas.','Начни с первого числа. Найди, где закончится перемещение.'),
 equation_board:tr('Leave one x alone by doing the same operation to both sides.','Atstāj vienu x atsevišķi, abās pusēs veicot vienādu darbību.','Оставь один x отдельно, выполняя одинаковые действия с обеими частями.'),
 coordinate_plot:tr('Place the point at the given coordinates.','Atzīmē punktu dotajās koordinātās.','Отметь точку с заданными координатами.'),
 coordinate_translate:tr('Move point A by the shown changes in x and y.','Pārvieto punktu A par norādītajām x un y izmaiņām.','Перемести точку A на указанные изменения x и y.'),
 coordinate_distance:tr('How many units separate A and B along the grid line?','Cik vienības šķir A un B pa režģa līniju?','Сколько единиц между A и B вдоль линии сетки?'),
 ratio_hint:tr('Keep the same amount per group. Scale both quantities by the same factor.','Saglabā vienādu daudzumu katrā grupā. Abus daudzumus reizini ar vienādu skaitli.','Сохраняй одинаковое количество в каждой группе. Умножай обе величины на одно число.'),
 signed_hint:tr('Numbers increase to the right. Adding moves right; subtracting moves left.','Skaitļi palielinās pa labi. Saskaitot virzies pa labi, atņemot — pa kreisi.','Числа возрастают вправо. Прибавляй вправо, вычитай влево.'),
 equation_hint:tr('Undo the added or subtracted amount, then divide both sides into equal groups.','Atcel pieskaitīto vai atņemto daudzumu, tad sadali abas puses vienādās grupās.','Убери прибавленное или вычтенное число, затем раздели обе части на равные группы.'),
 coordinate_hint:tr('Read x across first, then y up or down. Count intervals, not grid points.','Vispirms nolasi x horizontāli, tad y uz augšu vai leju. Skaiti intervālus, nevis režģa punktus.','Сначала прочитай x по горизонтали, затем y вверх или вниз. Считай промежутки, а не точки сетки.'),
 description:tr('Start with a model, practise the relationship, then solve fresh examples independently.','Sāc ar modeli, vingrinies sakarībā un tad patstāvīgi atrisini jaunus piemērus.','Начни с модели, потренируйся находить связь, затем реши новые примеры самостоятельно.'),
};
const titles={
 easy:[tr('Equal groups in a table','Vienādas grupas tabulā','Равные группы в таблице'),tr('Positions and moves from zero','Vietas un soļi no nulles','Положения и шаги от нуля'),tr('Missing parts on a balance','Trūkstošās daļas līdzsvarā','Недостающие части на весах'),tr('First coordinate maps','Pirmās koordinātu kartes','Первые координатные карты')],
 medium:[tr('Equivalent ratios','Vienādas attiecības','Равные отношения'),tr('Numbers below zero','Skaitļi zem nulles','Числа меньше нуля'),tr('One-step equations','Vienas darbības vienādojumi','Уравнения в одно действие'),tr('Move points on a map','Pārvieto punktus kartē','Перемещай точки на карте')],
 hard:[tr('Unit rates and ratio scaling','Vienības likmes un attiecību mērogošana','Единичные нормы и масштабирование отношений'),tr('Calculate across zero','Aprēķini pāri nullei','Вычисления через ноль'),tr('Two-step equations','Divu darbību vienādojumi','Уравнения в два действия'),tr('Four-quadrant maps','Četru kvadrantu kartes','Карты с четырьмя квадрантами')],
};
export const BRIDGE_PLANS=[
 ['easy','multiplication',8,'ratio_table'],['easy','numbers',8,'signed_line'],['easy','addition',8,'equation_board'],['easy','numbers',9,'coordinate_map'],
 ['medium','multiplication',8,'ratio_table'],['medium','subtraction',8,'signed_line'],['medium','addition',8,'equation_board'],['medium','operations',9,'coordinate_map'],
 ['hard','measurement',8,'ratio_table'],['hard','operations',8,'signed_line'],['hard','operations',9,'equation_board'],['hard','measurement',9,'coordinate_map'],
].map(([difficulty,topic,n,type],i)=>({id:`${difficulty}-${topic}-explore-${n}`,difficulty,type,title:titles[difficulty][i%4]}));
export const BRIDGE_TYPES=['ratio_table','signed_line','equation_board','coordinate_map'];
function payload(type,tier,i){
 const guided=i<3;
 if(type==='ratio_table'){
  const easy=[[1,2,2],[1,3,2],[1,2,3],[1,4,2],[1,3,3],[1,5,2],[1,2,4],[1,4,3],[1,3,4],[1,2,5]];
  const medium=[[2,3,4],[3,2,6],[2,5,6],[4,3,8],[3,4,9],[2,7,4],[5,2,15],[3,5,12],[4,5,12],[5,3,20]];
  const hard=[[3,12,1],[4,20,6],[6,18,4],[5,35,3],[8,24,10],[6,30,9],[4,28,2],[9,36,12],[7,42,5],[8,40,14]];
  const [a,b,targetA]=({easy,medium,hard})[tier][i];return {a,b,targetA,guided};
 }
 if(type==='signed_line'){
  const starts=tier==='easy'?[2,4,6,8,9,7,5,3,10,1]:tier==='medium'?[-1,-3,2,-4,3,-2,0,4,-5,1]:[-3,4,-2,5,-4,2,-1,3,-5,0];
  const deltas=tier==='easy'?[0,0,0,-3,-2,2,-4,4,-5,5]:tier==='medium'?[0,0,0,2,-5,3,0,-6,4,-3]:[5,-7,-3,-8,6,-5,5,-7,8,-4];
  return {mode:i<3&&tier!=='hard'?'place':'move',start:starts[i],delta:deltas[i],min:tier==='easy'?0:-6,max:tier==='easy'?10:6,guided};
 }
 if(type==='equation_board'){
  const x=[3,5,2,6,4,7,1,8,9,0][i];
  const a=tier==='easy'?1:tier==='medium'?(i%2===0?1:2+i%3):2+i%3;
  const b=tier==='easy'?1+i%3:tier==='medium'?(a===1?(i%4===0?3:-2):0):(i%2===0?3+i%4:-2-i%4);
  return {a,b,c:a*x+b,guided};
 }
 const points=[[1,2],[3,1],[2,4],[4,3],[0,2],[3,4],[2,0],[4,1],[1,3],[0,0]],start={x:1+i%3,y:1+(i+1)%3};
 if(tier==='easy')return {mode:'plot',min:0,max:4,start:{x:0,y:0},end:{x:points[i][0],y:points[i][1]},guided};
 if(tier==='medium')return {mode:i<3?'plot':i%3===0?'distance':'translate',min:0,max:6,start,end:i<3?{x:points[i][0],y:points[i][1]}:i%3===0?{x:start.x+2,y:start.y}:{x:i%2===0?2:-1,y:i%2===0?-1:2},guided};
 const s={x:-3+i%4,y:2-i%4};
 return {mode:i<3?'plot':i%3===0?'distance':'translate',min:-4,max:4,start:s,end:i<3?{x:[-2,3,-1][i],y:[3,-2,-3][i]}:i%3===0?{x:s.x+4,y:s.y}:{x:2,y:-1},guided};
}
export function bridgeSolution(type,p){
 if(type==='ratio_table')return p.targetA*p.b/p.a;
 if(type==='signed_line')return p.mode==='place'?p.start:p.start+p.delta;
 if(type==='equation_board')return (p.c-p.b)/p.a;
 if(p.mode==='distance')return Math.abs(p.end.x-p.start.x)+Math.abs(p.end.y-p.start.y);
 return p.mode==='plot'?p.end:{x:p.start.x+p.end.x,y:p.start.y+p.end.y};
}
export function applyBridgePilot({puzzles,lessons,pathExtras}){
 for(const plan of BRIDGE_PLANS){
  const lesson=lessons.find(l=>l.id===plan.id); lesson.title=plan.title;lesson.description=BRIDGE_TEXT.description;
  const ids=[...['practice','boss','challenge'].flatMap(kind=>lesson.levels.filter(l=>l.kind===kind).flatMap(l=>l.puzzleIds)),...pathExtras[lesson.id]];
  for(const locale of ['en','lv'])ids.forEach((id,i)=>{
   const old=puzzles[locale][plan.difficulty].find(p=>p.id===id),{difficulty,ageRange,learning,topic}=old,q=payload(plan.type,plan.difficulty,i),target=bridgeSolution(plan.type,q);
   const key=plan.type==='signed_line'?`signed_${q.mode}`:plan.type==='coordinate_map'?`coordinate_${q.mode}`:plan.type;
   const hint=BRIDGE_TEXT[`${plan.type.split('_')[0]}_hint`][locale];
   const explanation=plan.type==='ratio_table'?`${q.b} ÷ ${q.a} × ${q.targetA} = ${target}.`:plan.type==='signed_line'?`${q.start} ${q.delta<0?'−':'+'} ${Math.abs(q.delta)} = ${target}.`:plan.type==='equation_board'?`x = ${target}.`:typeof target==='number'?`${target}`:`(${target.x}, ${target.y})`;
   for(const key of Object.keys(old))delete old[key];
   Object.assign(old,{id,difficulty,ageRange,topic,learning:{...learning,representation:'objects',reasoningSteps:plan.difficulty==='hard'?2:1},type:plan.type,question:BRIDGE_TEXT[key][locale],hint,explanation,payload:q,helpTemplate:plan.type==='signed_line'&&plan.difficulty==='easy'?'bridge_positive':plan.type});
  });
 }
 for(const locale of ['en','lv'])for(const tier of ['easy','medium','hard'])balanceTruthValues(puzzles[locale][tier],locale);
 for(const locale of ['en','lv'])for(const tier of ['easy','medium','hard'])puzzles[locale][tier].filter(p=>p.type==='estimate').forEach((p,i)=>{
  const label=p.payload.choices[p.correctIndex],correct=Number(label.match(/\d+/)[0]),rank=i%3;
  const wrong=rank===0?[correct+10,correct+20]:rank===1?[correct-10,correct+10]:[correct-10,correct-20];
  const index=(i*2+1)%3,values=[...wrong];values.splice(index,0,correct);
  p.payload.choices=values.map(n=>label.replace(/\d+/,String(n)));p.correctIndex=index;
 });
 // Removed comparison slots must not reintroduce a side or answer-rank shortcut.
 for(const locale of ['en','lv'])for(const tier of ['easy','medium','hard'])puzzles[locale][tier].filter(p=>p.type==='compare').forEach((p,i)=>{if(p.correctIndex!==i%2){[p.payload.optionA,p.payload.optionB]=[p.payload.optionB,p.payload.optionA];p.correctIndex=i%2;}});
}
export const BRIDGE_TRANSLATIONS=[...Object.values(BRIDGE_TEXT),...Object.values(titles).flat()];
