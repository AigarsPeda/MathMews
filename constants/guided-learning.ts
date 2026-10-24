import type { AppLocale } from '@/types/locale';
import type { LearningLesson } from '@/types/curriculum';

type Words = Record<AppLocale, string>;
export type GuidedStep = {
  prompt: Words; hint: Words; explanation: Words;
} & ({ kind: 'counters'; groupSize?: number; initial: number; total: number; target: number }
  | { kind: 'parts'; denominator: number; target: number }
  | { kind: 'choice'; choices: Words[]; correct: number; diagram?: number[] });
export type GuidedLesson = { steps: GuidedStep[]; variant: string };
const words = (en: string, lv = en): Words => ({ en, lv });
const choose = (prompt: Words, choices: (number | string | Words)[], answer: number, hint: Words, explanation: Words, offset: number, diagram?: number[]): GuidedStep => {
  const items = choices.map((label, index) => ({ label: typeof label === 'object' ? label : words(String(label)), correct: index === answer }));
  const unique = items.filter((item, index) => items.findIndex(other => other.label.en === item.label.en) === index);
  const rotate = offset % unique.length;
  const ordered = [...unique.slice(rotate), ...unique.slice(0, rotate)];
  return { kind: 'choice', prompt, choices: ordered.map(i => i.label), correct: ordered.findIndex(i => i.correct), hint, explanation, diagram };
};
/** Independent teaching examples. Never receives the active puzzle or its solution. */
export function createGuidedLesson(lesson: Pick<LearningLesson, 'topicId' | 'skillId'>, variant = 0): GuidedLesson {
  const v = Math.abs(Math.floor(variant)) % 12, a = 6 + v % 3, b = 4 + v % 2, sum = a + b;
  const parts = (d: number, n: number): GuidedStep => ({ kind: 'parts', denominator: d, target: n,
    prompt: words(`Color ${n} of the ${d} equal pieces.`, `Iekrāso ${n} no ${d} vienādām daļām.`),
    hint: words(`Tap pieces until ${n} are colored. Tap again to clear a piece.`, `Pieskaries daļām, līdz iekrāsotas ${n}. Pieskaries vēlreiz, lai notīrītu.`),
    explanation: words(`${n}/${d} means ${n} out of ${d} equal pieces.`, `${n}/${d} ir ${n} no ${d} vienādām daļām.`) });
  const counters = (initial: number, total: number, target: number, prompt: Words, hint: Words, explanation: Words): GuidedStep => ({ kind: 'counters', initial, total, target, prompt, hint, explanation });
  let steps: GuidedStep[];
  switch (lesson.topicId) {
    case 'addition': {
      const early = lesson.skillId?.endsWith('.join') || lesson.skillId?.endsWith('.symbols');
      const start = early ? 2 + v % 3 : a, add = early ? 1 + v % 2 : b, total = start + add;
      steps = [counters(start,total,early?total:10, words(early?`Join ${add} more ${add === 1 ? 'ribbon' : 'ribbons'} to the ${start} already packed.`:`Move ribbons to fill the first ten. Start with ${start}.`,early?`Pievieno vēl ${add} ${add === 1 ? 'lenti' : 'lentes'} jau sapakotajām ${start}.`:`Pārvieto lentes, lai aizpildītu pirmo desmitu. Sāc ar ${start}.`),words('Tap a ribbon below to move it into a space.','Pieskaries lentei apakšā, lai to pārvietotu brīvajā vietā.'),words(early?`${start} + ${add} = ${total}.`:`${start} + ${10-start} = 10.`)),
        choose(words(early?'Which sum matches the joined ribbons?':`How many of the ${add} new ribbons remain after making ten?`,early?'Kura summa atbilst apvienotajām lentēm?':`Cik no ${add} jaunajām lentēm paliek pēc desmita izveidošanas?`),early?[`${start} + ${add} = ${total}`,`${start} + ${add} = ${total+1}`,`${start} + ${add} = ${total-1}`]:[total-10,total-9,total-11],0,words(early?'Count both groups together.':`You used ${10-start} of the ${add} new ribbons.`,early?'Saskaiti abas grupas kopā.':`Tu izmantoji ${10-start} no ${add} jaunajām lentēm.`),words(early?`${start} + ${add} = ${total}.`:`${add} − ${10-start} = ${total-10}.`),v),
        choose(words(`Try a new sum: ${start+1} + ${add}.`,`Izmēģini jaunu summu: ${start+1} + ${add}.`),[total,total+1,total+2],1,words('Count on, or fill ten and add the rest.','Skaiti tālāk vai izveido desmitu un pieskaiti pārējo.'),words(`${start+1} + ${add} = ${total+1}.`),v+1)]; break;
    }
    case 'subtraction':
      steps=[counters(sum,sum,a,words(`Take away ${b} of these ${sum} ribbons.`, `No šīm ${sum} lentēm noņem ${b}.`),words('Tap packed ribbons to take them out.','Pieskaries sapakotajām lentēm, lai tās izņemtu.'),words(`${sum} − ${b} = ${a}.`)),choose(words('Which addition checks your answer?','Kura saskaitīšana pārbauda atbildi?'),[`${a} + ${b} = ${sum}`,`${a} + ${b} = ${sum+1}`],0,words('Put back what you took away.','Pievieno atpakaļ to, ko noņēmi.'),words(`${a} + ${b} = ${sum}.`),v),choose(words(`${sum+2} − ${b} = ?`),[a+1,a+2,a+3],1,words(`Take away ${b} in small steps.`,`Atņem ${b} pa maziem soļiem.`),words(`${sum+2} − ${b} = ${a+2}.`),v+1)];break;
    case 'fractions':
      steps=[choose(words('The two pieces below are unequal. Is each piece one half?','Abas daļas zemāk nav vienādas. Vai katra ir puse?'),[words('No, halves must be equal','Nē, pusēm jābūt vienādām'),words('Yes, there are two pieces','Jā, ir divas daļas')],0,words('Compare the sizes, not only the number of pieces.','Salīdzini lielumu, ne tikai daļu skaitu.'),words('A half is one of two equal pieces of the same whole.','Puse ir viena no divām vienādām viena veselā daļām.'),v,[1,3]),parts(4,1+v%2),choose(words('Two of four equal pieces are colored. Which fraction names that amount?','Iekrāsotas divas no četrām vienādām daļām. Kura daļa to apraksta?'),['2/4','1/4','4/2'],0,words('Colored pieces go above the line; all pieces go below.','Virs svītras raksta iekrāsoto daļu skaitu, zem tās visu daļu skaitu.'),words('2/4: two of the four equal pieces.','2/4: divas no četrām vienādām daļām.'),v+1,[1,1,1,1])];break;
    case 'multiplication': case 'division': {
      const groups=2+v%3, each=3+v%2,total=groups*each;
      steps=[counters(0,total,total,words(`Pack ${groups} groups with ${each} ribbons in each.`,`Saliec ${groups} grupas, katrā pa ${each} lentēm.`),words(`Count in groups of ${each}.`,`Skaiti grupās pa ${each}.`),words(`${groups} × ${each} = ${total}.`)),choose(words(`Share ${total} ribbons among ${groups} cats. How many each?`,`Sadali ${total} lentes ${groups} kaķiem. Cik katram?`),[each,each+1,each-1],0,words(`Think: ${groups} × ? = ${total}.`,`Padomā: ${groups} × ? = ${total}.`),words(`${total} ÷ ${groups} = ${each}.`),v),choose(words(`What remains if ${total+1} ribbons are shared among ${groups} cats?`,`Kas paliek pāri, sadalot ${total+1} lentes ${groups} kaķiem?`),[0,1,groups],1,words(`Each cat still gets ${each} whole ribbons.`,`Katrs kaķis joprojām saņem ${each} veselas lentes.`),words(`${total+1} = ${groups} × ${each} + 1.`),v+1)];break;
    }
    case 'patterns': { const step=2+v%3,start=1+v;
      steps=[choose(words(`What is the change: ${start}, ${start+step}, ${start+2*step}?`,`Kāda ir izmaiņa: ${start}, ${start+step}, ${start+2*step}?`),[`+${step}`,`+${step+1}`,`×${step}`],0,words('Compare each pair of neighbors.','Salīdzini katrus divus blakus skaitļus.'),words(`+${step}`),v),choose(words(`Continue: ${start}, ${start+step}, ${start+2*step}, ?`,`Turpini: ${start}, ${start+step}, ${start+2*step}, ?`),[start+3*step,start+2*step+1,start+4*step],0,words(`Add ${step} once more.`,`Pieskaiti ${step} vēlreiz.`),words(`${start+2*step} + ${step} = ${start+3*step}.`),v+1),choose(words(`Try another start: ${start+3}, ${start+3+step}, ?`,`Izmēģini citu sākumu: ${start+3}, ${start+3+step}, ?`),[start+3+2*step+1,start+3+2*step,start+3+step],1,words('Use the same change.','Izmanto to pašu izmaiņu.'),words(`${start+3+step} + ${step} = ${start+3+2*step}.`),v+2)];break; }
    case 'operations':
      steps=[choose(words(`Start at ${a}. Add ${b}. Where are you?`,`Sāc ar ${a}. Pieskaiti ${b}. Kur tu nonāc?`),[sum-1,sum,sum+1],1,words('Work through one move at a time.','Izpildi vienu soli pēc otra.'),words(`${a} + ${b} = ${sum}.`),v),choose(words(`Now take away 3 from ${sum}.`,`Tagad no ${sum} atņem 3.`),[sum-3,sum+3,sum-2],0,words('Use the result of the previous move.','Izmanto iepriekšējā soļa rezultātu.'),words(`${sum} − 3 = ${sum-3}.`),v+1),choose(words(`Choose a route from ${a+1} to ${sum-2}.`,`Izvēlies ceļu no ${a+1} līdz ${sum-2}.`),[`+${b}, −3`,`−${b}, +3`,`+${b}, +3`],0,words('Predict the number after each move.','Nosaki skaitli pēc katra soļa.'),words(`${a+1} + ${b} − 3 = ${sum-2}.`),v+2)];break;
    case 'percentages': { const whole=40+v*20,quarter=whole/4;
      steps=[parts(4,1),choose(words(`25% is one quarter. What is 25% of ${whole}?`,`25% ir ceturtdaļa. Cik ir 25% no ${whole}?`),[quarter,quarter+5,whole-25],0,words('Share the whole into four equal groups.','Sadali veselo četrās vienādās grupās.'),words(`${whole} ÷ 4 = ${quarter}.`),v),choose(words(`A price of ${whole} is reduced by 25%. What is the new price?`,`Cena ${whole} samazināta par 25%. Kāda ir jaunā cena?`),[whole-quarter-1,whole-quarter,quarter],1,words(`Take ${quarter} away from ${whole}.`,`No ${whole} atņem ${quarter}.`),words(`${whole} − ${quarter} = ${whole-quarter}.`),v+1)];break; }
    case 'measurement': { const width=3+v%3,length=4+v%2;
      steps=[choose(words(`A rectangle has ${width} rows of ${length} unit squares. What is its area?`,`Taisnstūrī ir ${width} rindas, katrā ${length} vienības kvadrāti. Kāds ir laukums?`),[width*length,width+length,width*length+length],0,words('Count each equal row once.','Saskaiti katru vienādo rindu vienu reizi.'),words(`${width} × ${length} = ${width*length}.`),v),choose(words('Which unit describes area?','Kura mērvienība apraksta laukumu?'),[words('Square units','Kvadrātvienības'),words('Length units','Garuma vienības')],0,words('We cover a surface with squares.','Mēs pārklājam virsmu ar kvadrātiem.'),words('Area counts unit squares.','Laukums ir vienības kvadrātu skaits.'),v+1),choose(words(`One more row is added. What is the new area?`,`Pievieno vēl vienu rindu. Kāds ir jaunais laukums?`),[width*length+1,(width+1)*length,width*length],1,words(`Add ${length} squares.`,`Pievieno ${length} kvadrātus.`),words(`${width*length} + ${length} = ${(width+1)*length}.`),v+2)];break; }
    default: { const low=4+2*v;
      steps=[choose(words(`Which number is greater than ${low} and less than ${low+4}?`,`Kurš skaitlis ir lielāks par ${low} un mazāks par ${low+4}?`),[low,low+2,low+4],1,words('The boundary numbers are excluded.','Robežskaitļi neder.'),words(`${low} < ${low+2} < ${low+4}.`),v),choose(words(`Which of these is even?`,`Kurš no šiem skaitļiem ir pāra?`),[low+1,low+2,low+3],1,words('An even amount can be split into two equal whole groups.','Pāra daudzumu var sadalīt divās vienādās veselās grupās.'),words(`${low+2} = ${low/2+1} + ${low/2+1}.`),v+1),choose(words(`Find an even number between ${low+4} and ${low+8}.`,`Atrodi pāra skaitli starp ${low+4} un ${low+8}.`),[low+5,low+6,low+8],1,words('Check both the boundaries and the even-number rule.','Pārbaudi gan robežas, gan pāra skaitļa nosacījumu.'),words(`${low+4} < ${low+6} < ${low+8}.`),v+2)];
    }
  }
  if (lesson.topicId === 'multiplication' || lesson.topicId === 'division') {
    const first = steps[0];
    if (first.kind === 'counters') first.groupSize = 3 + v % 2;
  }
  return {steps,variant:`${lesson.topicId}-${v}`};
}
