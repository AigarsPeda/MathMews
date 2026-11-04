import plans from '@/data/puzzle-bridge-lessons.json';
import type { LearningLesson } from '@/types/curriculum';
import type { ReviewQuestion } from '@/constants/learning-review';
/** Fresh transfer checks use the same range and operations as the taught board. */
export function getBridgeReview(lesson: LearningLesson, day: number): ReviewQuestion | null {
  const plan=plans.find(p=>p.id===lesson.id);if(!plan)return null;
  const v=Math.abs(day)%7,tier=lesson.difficulty;
  let prompt:ReviewQuestion['prompt'],answer:string,options:string[],detail:string;
  if(plan.type==='ratio_table'){
    const a=tier==='easy'?1:tier==='medium'?2:3, b=tier==='easy'?2+v%3:tier==='medium'?3+v%4:3*(2+v%4), n=tier==='easy'?2+v%2:tier==='medium'?4:2+v%3;
    const result=n*b/a;answer=String(result);detail=`${b} ÷ ${a} × ${n} = ${result}.`;
    prompt={en:`${a} groups hold ${b} items. How many items are in ${n} equal groups?`,lv:`${a} grupās ir ${b} priekšmeti. Cik priekšmetu ir ${n} tādās pašās grupās?`,ru:`В ${a} группах ${b} предметов. Сколько предметов в ${n} таких же группах?`};options=[answer,String(result+1),String(result+2)];
  }else if(plan.type==='signed_line'){
    const a=tier==='easy'?2+v:tier==='hard'?-3+v:-4+v,b=tier==='hard'?(v%2===0?-3:3):tier==='easy'?1:0,result=a+b;
    answer=String(result);detail=`${a} ${b<0?'−':'+'} ${Math.abs(b)} = ${result}.`;prompt={en:`Find the endpoint: ${a} ${b<0?'−':'+'} ${Math.abs(b)}.`,lv:`Atrodi beigu punktu: ${a} ${b<0?'−':'+'} ${Math.abs(b)}.`,ru:`Найди конечную точку: ${a} ${b<0?'−':'+'} ${Math.abs(b)}.`};options=[answer,String(result-1),String(result+1)];
  }else if(plan.type==='equation_board'){
    const x=1+v,a=tier==='easy'?1:2,b=tier==='medium'?0:tier==='hard'?-3:2,c=a*x+b,equation=`${a===1?'':a}x${b?` ${b<0?'−':'+'} ${Math.abs(b)}`:''} = ${c}`;
    answer=String(x);detail=`x = ${x}.`;prompt={en:`Find x: ${equation}.`,lv:`Atrodi x: ${equation}.`,ru:`Найди x: ${equation}.`};options=[answer,String(x+1),String(x+2)];
  }else{
    const x=tier==='hard'?-1-v%3:1+v%3,y=1+(v+1)%3;
    answer=`(${x}, ${y})`;detail=`x = ${x}; y = ${y}.`;prompt={en:`Which ordered pair has x = ${x} and y = ${y}?`,lv:`Kuram koordinātu pārim x = ${x} un y = ${y}?`,ru:`В какой паре координат x = ${x} и y = ${y}?`};options=[answer,`(${y}, ${x})`,`(${x+1}, ${y})`];
  }
  const shift=Math.abs(day)%3,choices=[...options.slice(shift),...options.slice(0,shift)];
  return {prompt,choices,correctIndex:choices.indexOf(answer),explanation:{en:detail,lv:detail,ru:detail}};
}
