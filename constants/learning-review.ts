import { getBridgeReview } from "@/constants/bridge-review";
import { getEverydayReview } from "@/constants/everyday-review";
import { getModelReview } from "@/constants/model-review";
import { getTopicReview } from "@/constants/topic-review";
import { numericReview, reviewHash } from "@/utils/review-question";
import type { LearningLesson } from '@/types/curriculum';
import type { AppLocale } from '@/types/locale';
import { getTopicLessons } from '@/constants/curriculum';
import foundationPlans from '@/data/puzzle-foundations.json';
import easyFractionPairs from '@/data/easy-fraction-pairs.json';
import mediumFractionTransition from '@/data/medium-fraction-transition.json';
import hardFractionTransition from '@/data/hard-fraction-transition.json';
export type ReviewQuestion = { models?: Record<AppLocale, import('@/types/everyday').EverydayModel>; localizedChoices?: Record<AppLocale, string[]>; diagram?: {parts:number;colored:number}; prompt: Record<AppLocale,string>; choices: string[]; correctIndex: number; explanation: Record<AppLocale,string> };
function numericChoices(answer: number, key: string, maximum = Infinity) {
  return numericReview({ en: '', lv: '', ru: '' }, answer, '', key, [], 0, maximum).choices;
}
/** Fresh, self-contained checks. No previous teaching step supplies the answer. */
export function getLearningReview(lesson: LearningLesson, day: number): ReviewQuestion {
  const everyday = getEverydayReview(lesson.id, day); if (everyday) return everyday;
  const bridge = getBridgeReview(lesson, day); if (bridge) return bridge;
  const seed = reviewHash(`${lesson.id}/${day}/values`), v = seed % 11;
  const stage = getTopicLessons(lesson.difficulty, lesson.topicId).findIndex(item => item.id === lesson.id);
  const aligned = getModelReview(lesson, day) ?? getTopicReview(lesson, day, stage);
  if (aligned) return aligned;
  let a = (lesson.difficulty === 'easy' ? 3 : lesson.difficulty === 'medium' ? 23 : 103) + v, b = (lesson.difficulty === 'easy' ? 2 : 8) + v % 4;
  if (lesson.difficulty === 'easy' && ['addition', 'subtraction'].includes(lesson.topicId) && stage < 2) {
    a = 3 + v % 5; b = 1 + v % 3;
  }
  if (lesson.difficulty === 'easy' && lesson.topicId === 'addition' && stage === 3) { a = 6 + v % 4; b = 11 - a + v % 3; }
  if (lesson.difficulty === 'easy' && lesson.topicId === 'subtraction') {
    if (stage === 2) { a = 10; b = 1 + v % 9; }
    if (stage === 3) { a = 7 + v % 3; b = 11 + v % 8 - a; }
  }
  if (lesson.difficulty !== 'hard' && ['multiplication', 'division'].includes(lesson.topicId)) {
    const tables = (lesson.difficulty === 'easy' ? foundationPlans.easyTables : foundationPlans.mediumTables)[stage];
    if (lesson.topicId === 'multiplication') { a = tables[v % tables.length]; b = 2 + v % (lesson.difficulty === 'easy' ? 5 : 9); }
    else { a = 2 + v % 9; b = tables[v % tables.length]; }
  }
  if (lesson.difficulty === 'easy' && lesson.topicId === 'numbers') a = stage === 0 ? 1 + v % 8 : 5 + v % 14;
  if (lesson.difficulty === 'easy' && lesson.topicId === 'patterns') {
    a = 1 + v % 5; b = stage < 2 ? 1 + v % 2 : stage < 5 ? 2 + v % 2 : stage < 8 ? [2, 5][v % 2] : [5, 10][v % 2];
  }
  if (lesson.difficulty === 'medium' && lesson.topicId === 'operations' && stage < 3) { a = 7 + v % 8; b = 2 + v % 4; }
  if (lesson.difficulty === 'medium' && lesson.topicId === 'addition') {
    a = stage < 4 ? 23 + v : 55 + v * 3; b = stage < 4 ? 12 + v % 12 : 25 + v % 15;
  }
  if (lesson.difficulty === 'medium' && lesson.topicId === 'subtraction') { a = 20 + v * 2; b = 15 + stage + v % 17; }
  const key = `${lesson.id}/${day}`;
  if(lesson.topicId === 'fractions') {
    if (lesson.difficulty === 'hard') {
      const [n, d, taughtTotal] = hardFractionTransition.amounts[stage][v % 3];
      const maximum = stage < 4 ? [20, 25, 32, 40][stage] : 64;
      const each = Math.min(Math.floor(maximum / d), Math.max(2, taughtTotal / d - 1 + Math.floor(v / 3) % 3));
      const total = each * d, answer = each * n;
      const choices = numericChoices(answer, key, total);
      const detail = `${total} ÷ ${d} = ${each}${n === 1 ? '.' : `; ${each} × ${n} = ${answer}.`}`;
      return { prompt: {
        en: `There are ${total} seeds. ${n}/${d} of them are flower seeds. How many flower seeds?`,
        lv: `Ir ${total} sēklas. Puķu sēklas veido ${n}/${d}. Cik puķu sēklu?`,
        ru: `Всего ${total} семян. Семена цветов составляют ${n}/${d}. Сколько семян цветов?`,
      }, choices, correctIndex: choices.indexOf(String(answer)), explanation: { en: detail, lv: detail, ru: detail } };
    }
    if (lesson.difficulty === 'medium' && stage === 9) {
      const [n, d, a, b] = hardFractionTransition.mediumFinaleEquivalents[v % 4];
      const wrong = Array.from({ length: b + 1 }, (_, i) => i).filter(i => i !== a)
        .sort((x, y) => Math.abs(x - a) - Math.abs(y - a)).slice(0, 2);
      const choices = wrong.map(i => `${i}/${b}`), correctIndex = seed % 3;
      choices.splice(correctIndex, 0, `${a}/${b}`);
      const detail = `${n}/${d} = ${a}/${b}.`;
      return { prompt: { en: `Which fraction equals ${n}/${d}?`, lv: `Kura daļa ir vienāda ar ${n}/${d}?`, ru: `Какая дробь равна ${n}/${d}?` },
        choices, correctIndex, explanation: { en: detail, lv: detail, ru: detail } };
    }
    if (lesson.difficulty === 'easy' && stage >= 4 || lesson.difficulty === 'medium' && stage >= 0 && stage < mediumFractionTransition.length) {
      const equivalent = lesson.difficulty === 'medium' || [5, 7, 9].includes(stage);
      const pairs = lesson.difficulty === 'medium' ? mediumFractionTransition[stage].equivalents : easyFractionPairs[String(stage) as keyof typeof easyFractionPairs];
      const d = [3, 4, 6, 8][v % 4], n = 1 + v % (d - 1);
      const [sourceN, sourceD, answerN, answerD] = equivalent ? pairs[v % pairs.length] : [n, d, n, d];
      const wrong = Array.from({ length: answerD + 1 }, (_, i) => i).filter(i => i !== answerN)
        .sort((a, b) => Math.abs(a - answerN) - Math.abs(b - answerN)).slice(0, 2);
      const choices = wrong.map(i => `${i}/${answerD}`), correctIndex = seed % 3;
      choices.splice(correctIndex, 0, `${answerN}/${answerD}`);
      const detail = `${sourceN}/${sourceD} = ${answerN}/${answerD}.`;
      return { diagram: { parts: sourceD, colored: sourceN }, prompt: equivalent
        ? { en: 'Which fraction shows the same shaded amount?', lv: 'Kura daļa rāda to pašu iekrāsoto daudzumu?', ru: 'Какая дробь показывает такую же закрашенную часть?' }
        : { en: 'Which fraction of this whole is colored?', lv: 'Kāda šī veselā daļa ir iekrāsota?', ru: 'Какая часть целого закрашена?' },
        choices, correctIndex, explanation: { en: detail, lv: detail, ru: detail } };
    }
    const equivalent=lesson.difficulty==='medium'||['equivalence','equivalent','review'].some(key=>lesson.skillId?.endsWith('.'+key));
    const d=lesson.skillId?.endsWith('.equal-parts')?2:lesson.skillId?.endsWith('.quarters')?4:3+v%4, n=1+v%(d-1);
    if (equivalent) {
      const factor = stage < 2 || lesson.difficulty === 'easy' && stage === 5 ? 2
        : lesson.difficulty === 'easy' && stage === 6 ? 3
          : lesson.difficulty === 'medium' && stage < 4 ? 2 + v % 2 : 2 + v % 3;
      const simplify = lesson.difficulty === 'medium' && stage >= 3 && v % 2 === 0;
      const sourceN = simplify ? n * factor : n, sourceD = simplify ? d * factor : d;
      const answerN = simplify ? n : n * factor, answerD = simplify ? d : d * factor;
      const answer = `${answerN}/${answerD}`;
      const options = [answer, `${sourceN}/${answerD}`, `${answerN}/${sourceD}`];
      const shift = seed % 3, choices = [...options.slice(shift), ...options.slice(0, shift)];
      const detail = `${sourceN}/${sourceD} = ${answer}.`;
      return { prompt: { en: `Which fraction equals ${sourceN}/${sourceD}?`, lv: `Kura daļa ir vienāda ar ${sourceN}/${sourceD}?`, ru: `Какая дробь равна ${sourceN}/${sourceD}?` },
        choices, correctIndex: choices.indexOf(answer), explanation: { en: detail, lv: detail, ru: detail } };
    }
    const options=[`${n}/${d}`,`${d}/${n}`,`${n+1}/${d}`];
    const shift=seed%3,choices=[...options.slice(shift),...options.slice(0,shift)];
    return {
      prompt: { en: 'Which fraction of this whole is colored?', lv: 'Kāda šī veselā daļa ir iekrāsota?', ru: 'Какая часть целого закрашена?' },
      choices, correctIndex: choices.indexOf(options[0]),
      explanation: {
        en: `${n} of ${d} equal parts: ${n}/${d}.`,
        lv: `${n} no ${d} vienādām daļām: ${n}/${d}.`,
        ru: `${n} из ${d} равных частей: ${n}/${d}.`,
      },
      diagram: { parts: d, colored: n },
    };
  }
  let en: string, lv: string, answer: number, detail: string;
  const russianPrompts: Record<string, string> = {
    addition: `Было ${a} карандашей. Добавили ещё ${b}. Сколько стало?`,
    subtraction: `Было ${a+b} карандашей. Отдали ${b}. Сколько осталось?`,
    multiplication: `Есть ${b} мешочков, в каждом по ${a} пуговиц. Сколько пуговиц всего?`,
    division: `Раздели ${a*b} пуговиц поровну между ${b} мешочками. Сколько в каждом?`,
    patterns: `Продолжи с одинаковым шагом: ${a}, ${a+b}, ${a+2*b}, ?`,
    operations: `Начни с ${a}. Прибавь ${b}, затем вычти 2. Какое число получится?`,
    percentages: `Сколько будет 25% от ${a*4}?`,
    measurement: `В прямоугольнике ${a} рядов по ${b} единичных квадратов. Чему равна его площадь?`,
  };
  let ru = russianPrompts[lesson.topicId] ?? `Выбери чётное число строго между ${2*a} и ${2*a+4}.`;
  switch (lesson.topicId) {
    case 'numbers': en=`Which number comes just after ${a}?`;lv=`Kurš skaitlis seko uzreiz pēc ${a}?`;ru=`Какое число идёт сразу после ${a}?`;answer=a+1;detail=`${a} + 1 = ${answer}.`;break;
    case 'addition': en=`There are ${a} pencils. Add ${b} more. How many altogether?`;lv=`Ir ${a} zīmuļi. Pievieno vēl ${b}. Cik kopā?`;answer=a+b;detail=`${a} + ${b} = ${answer}.`;break;
    case 'subtraction': en=`There are ${a+b} pencils. Give away ${b}. How many remain?`;lv=`Ir ${a+b} zīmuļi. Atdod ${b}. Cik paliek?`;answer=a;detail=`${a+b} − ${b} = ${a}.`;break;
    case 'multiplication': en=`There are ${b} bags with ${a} buttons each. How many buttons?`;lv=`Ir ${b} maisiņi, katrā ${a} pogas. Cik pogu kopā?`;answer=a*b;detail=`${b} × ${a} = ${answer}.`;break;
    case 'division': en=`Share ${a*b} buttons equally among ${b} bags. How many in each?`;lv=`Sadali ${a*b} pogas vienādi ${b} maisiņos. Cik katrā?`;answer=a;detail=`${a*b} ÷ ${b} = ${a}.`;break;
    case 'patterns': en=`Continue the equal jumps: ${a}, ${a+b}, ${a+2*b}, ?`;lv=`Turpini vienādus soļus: ${a}, ${a+b}, ${a+2*b}, ?`;answer=a+3*b;detail=`${a+2*b} + ${b} = ${answer}.`;break;
    case 'operations': {
      if (lesson.difficulty === 'medium' && stage >= 3) {
        const factor = 2 + v % 4, value = 4 + v % 7, extra = 3 + v % 5;
        const expression = stage < 5 ? `${value} × ${factor} + ${extra}` : stage === 5 ? `${value * factor} ÷ ${factor} + ${extra}` : `${extra} + ${factor} × ${value}`;
        answer = stage === 5 ? value + extra : value * factor + extra;
        en=`What is the value of ${expression}?`;lv=`Kāda ir izteiksmes ${expression} vērtība?`;ru=`Чему равно выражение ${expression}?`;detail=`${expression} = ${answer}.`;
      } else { en=`Start at ${a}. Add ${b}, then take away 2. Where do you finish?`;lv=`Sāc ar ${a}. Pieskaiti ${b}, tad atņem 2. Kur nonāc?`;answer=a+b-2;detail=`${a} + ${b} − 2 = ${answer}.`; }
      break;
    }
    case 'percentages': en=`What is 25% of ${a*4}?`;lv=`Cik ir 25% no ${a*4}?`;answer=a;detail=`${a*4} ÷ 4 = ${a}.`;break;
    case 'measurement': en=`A rectangle has ${a} rows of ${b} unit squares. How many square units cover it?`;lv=`Taisnstūrī ir ${a} rindas, katrā ${b} vienības kvadrāti. Cik kvadrātvienību to pārklāj?`;answer=a*b;detail=`${a} × ${b} = ${answer}.`;break;
    default: en=`Choose the even number strictly between ${2*a} and ${2*a+4}.`;lv=`Izvēlies pāra skaitli stingri starp ${2*a} un ${2*a+4}.`;answer=2*a+2;detail=`${2*a} < ${answer} < ${2*a+4}.`;
  }
  if(lesson.topicId==='addition' && ['missing-part','pairs'].some(key=>lesson.skillId?.endsWith('.'+key))) {
    en=`What is the missing part? ${a} + ? = ${a+b}`;lv=`Kāda ir trūkstošā daļa? ${a} + ? = ${a+b}`;answer=b;detail=`${a} + ${b} = ${a+b}.`;
    ru=`Какое слагаемое пропущено? ${a} + ? = ${a+b}`;
  }
  if (lesson.difficulty === 'easy' && lesson.topicId === 'subtraction' && stage === 4) {
    en=`How many were taken away? ${a+b} − ? = ${a}`;lv=`Cik tika atņemts? ${a+b} − ? = ${a}`;
    ru=`Сколько вычли? ${a+b} − ? = ${a}`;
    answer=b;detail=`${a+b} − ${b} = ${a}.`;
  }
  const variant = (day + reviewHash(lesson.id)) % 3;
  if (lesson.topicId === 'addition' && (lesson.difficulty === 'medium' && stage >= 4 || lesson.difficulty === 'easy' && stage >= 4) && variant !== 0) {
    const expression = variant === 1 ? `? + ${b} = ${a + b}` : `${a} + ? = ${a + b}`;
    answer = variant === 1 ? a : b;
    en = `Find the missing addend: ${expression}.`; lv = `Atrodi trūkstošo saskaitāmo: ${expression}.`; ru = `Найди пропущенное слагаемое: ${expression}.`;
    detail = `${a} + ${b} = ${a + b}.`;
  }
  if (lesson.topicId === 'subtraction' && (stage >= 4 && variant === 1 || lesson.difficulty === 'easy' && stage === 5)) {
    en = `How many more is ${a + b} than ${b}?`; lv = `Par cik ${a + b} ir lielāks nekā ${b}?`; ru = `На сколько ${a + b} больше ${b}?`;
    answer = a; detail = `${a + b} − ${b} = ${a}.`;
  }
  const choices = numericChoices(answer, key, lesson.topicId === 'numbers' && lesson.difficulty === 'easy' ? stage === 0 ? 10 : 20 : Infinity);
  return {prompt:{en,lv,ru},choices,correctIndex:choices.indexOf(String(answer)),explanation:{en:detail,lv:detail,ru:detail}};
}
