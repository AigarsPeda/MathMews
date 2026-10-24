import type { LearningLesson } from '@/types/curriculum';
import type { AppLocale } from '@/types/locale';
export type ReviewQuestion = { diagram?: {parts:number;colored:number}; prompt: Record<AppLocale,string>; choices: string[]; correctIndex: number; explanation: Record<AppLocale,string> };
const hash = (value: string) => {
  let seed = 2166136261;
  for (const char of value) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return seed >>> 0;
};
function numericChoices(answer: number, key: string) {
  const rank = hash(`${key}/rank`) % 3;
  const values = rank === 0 ? [answer, answer + 1, answer + 3]
    : rank === 1 ? [answer - 1, answer, answer + 2] : [answer - 2, answer - 1, answer];
  return values.map((value, index) => ({ value, order: hash(`${key}/position/${index}`) }))
    .sort((a, b) => a.order - b.order).map(item => String(item.value));
}
/** Fresh, self-contained checks. No previous teaching step supplies the answer. */
export function getLearningReview(lesson: LearningLesson, day: number): ReviewQuestion {
  const seed = [...lesson.id].reduce((n,c) => n+c.charCodeAt(0), day), v = seed % 11;
  const a = (lesson.difficulty === 'easy' ? 3 : lesson.difficulty === 'medium' ? 23 : 103) + v, b = (lesson.difficulty === 'easy' ? 2 : 8) + v % 4;
  const key = `${lesson.id}/${day}`;
  if(lesson.topicId === 'fractions') {
    const advanced=lesson.difficulty==='hard', equivalent=lesson.difficulty==='medium'||['equivalence','equivalent','review'].some(key=>lesson.skillId?.endsWith('.'+key));
    const d=lesson.skillId?.endsWith('.equal-parts')?2:lesson.skillId?.endsWith('.quarters')?4:3+v%4, n=1+v%(d-1);
    const options=advanced?numericChoices(a,key):equivalent?[`${2*n}/${2*d}`,`${n}/${2*d}`,`${n+1}/${d}`]:[`${n}/${d}`,`${d}/${n}`,`${n+1}/${d}`];
    const shift=seed%3,choices=[...options.slice(shift),...options.slice(0,shift)];
    return {prompt:advanced?{en:`There are ${a*d} seeds. 1/${d} of them are flower seeds. How many flowers?`,lv:`Ir ${a*d} sēklas. Puķu sēklas veido 1/${d}. Cik puķu sēklu?`}:equivalent?{en:`Which fraction equals ${n}/${d}?`,lv:`Kura daļa ir vienāda ar ${n}/${d}?`}:{en:'Which fraction of this whole is colored?',lv:'Kāda šī veselā daļa ir iekrāsota?'},choices,correctIndex:choices.indexOf(advanced?String(a):options[0]),explanation:{en:advanced?`${a*d} ÷ ${d} = ${a}.`:equivalent?`${n}/${d} = ${2*n}/${2*d}.`:`${n} of ${d} equal parts: ${n}/${d}.`,lv:advanced?`${a*d} ÷ ${d} = ${a}.`:equivalent?`${n}/${d} = ${2*n}/${2*d}.`:`${n} no ${d} vienādām daļām: ${n}/${d}.`},...(!advanced&&!equivalent?{diagram:{parts:d,colored:n}}:{})};
  }
  let en: string, lv: string, answer: number, detail: string;
  switch (lesson.topicId) {
    case 'addition': en=`There are ${a} pencils. Add ${b} more. How many altogether?`;lv=`Ir ${a} zīmuļi. Pievieno vēl ${b}. Cik kopā?`;answer=a+b;detail=`${a} + ${b} = ${answer}.`;break;
    case 'subtraction': en=`There are ${a+b} pencils. Give away ${b}. How many remain?`;lv=`Ir ${a+b} zīmuļi. Atdod ${b}. Cik paliek?`;answer=a;detail=`${a+b} − ${b} = ${a}.`;break;
    case 'multiplication': en=`There are ${b} bags with ${a} buttons each. How many buttons?`;lv=`Ir ${b} maisiņi, katrā ${a} pogas. Cik pogu kopā?`;answer=a*b;detail=`${b} × ${a} = ${answer}.`;break;
    case 'division': en=`Share ${a*b} buttons equally among ${b} bags. How many in each?`;lv=`Sadali ${a*b} pogas vienādi ${b} maisiņos. Cik katrā?`;answer=a;detail=`${a*b} ÷ ${b} = ${a}.`;break;
    case 'patterns': en=`Continue the equal jumps: ${a}, ${a+b}, ${a+2*b}, ?`;lv=`Turpini vienādus soļus: ${a}, ${a+b}, ${a+2*b}, ?`;answer=a+3*b;detail=`${a+2*b} + ${b} = ${answer}.`;break;
    case 'operations': en=`Start at ${a}. Add ${b}, then take away 2. Where do you finish?`;lv=`Sāc ar ${a}. Pieskaiti ${b}, tad atņem 2. Kur nonāc?`;answer=a+b-2;detail=`${a} + ${b} − 2 = ${answer}.`;break;
    case 'percentages': en=`What is 25% of ${a*4}?`;lv=`Cik ir 25% no ${a*4}?`;answer=a;detail=`${a*4} ÷ 4 = ${a}.`;break;
    case 'measurement': en=`A rectangle has ${a} rows of ${b} unit squares. How many square units cover it?`;lv=`Taisnstūrī ir ${a} rindas, katrā ${b} vienības kvadrāti. Cik kvadrātvienību to pārklāj?`;answer=a*b;detail=`${a} × ${b} = ${answer}.`;break;
    default: en=`Choose the even number strictly between ${2*a} and ${2*a+4}.`;lv=`Izvēlies pāra skaitli stingri starp ${2*a} un ${2*a+4}.`;answer=2*a+2;detail=`${2*a} < ${answer} < ${2*a+4}.`;
  }
  if(lesson.topicId==='addition' && ['missing-part','pairs'].some(key=>lesson.skillId?.endsWith('.'+key))) {
    en=`What is the missing part? ${a} + ? = ${a+b}`;lv=`Kāda ir trūkstošā daļa? ${a} + ? = ${a+b}`;answer=b;detail=`${a} + ${b} = ${a+b}.`;
  }
  const choices = numericChoices(answer, key);
  return {prompt:{en,lv},choices,correctIndex:choices.indexOf(String(answer)),explanation:{en:detail,lv:detail}};
}
