import type { LearningLesson } from '@/types/curriculum';
import type { ReviewQuestion } from '@/constants/learning-review';
import { numericReview, reviewChoiceOrder, reviewHash } from '@/utils/review-question';

/** Reviews of the model lessons keep their units, prerequisites and inverse questions. */
export function getModelReview(lesson: LearningLesson, day: number): ReviewQuestion | null {
  const key = `${lesson.id}/${day}`, v = reviewHash(`${key}/values`), mode = (day + reviewHash(lesson.id)) % 3;
  const ask = (prompt: ReviewQuestion['prompt'], answer: number, detail: string | ReviewQuestion['explanation'], wrong: number[] = [], min = 0, max = Infinity) =>
    numericReview(prompt, answer, detail, key, wrong, min, max);
  if (['hard-measurement-area', 'hard-measurement-explore-3', 'hard-measurement-explore-6'].includes(lesson.id)) {
    const w = 2 + v % 5, h = 2 + Math.floor(v / 5) % 6, area = w * h, perimeter = 2 * (w + h);
    if (lesson.id === 'hard-measurement-explore-6') {
      if (mode === 0) return ask({
        en: `A rectangle has area ${area} square units and width ${w} units. What is its height?`,
        lv: `Taisnstūra laukums ir ${area} kvadrātvienības, platums ir ${w} vienības. Kāds ir augstums?`,
        ru: `Площадь прямоугольника равна ${area} квадратным единицам, ширина — ${w} единицам. Какова высота?`,
      }, h, `${area} ÷ ${w} = ${h}.`, [area - w, area / 2]);
      if (mode === 1) return ask({
        en: `A rectangle has perimeter ${perimeter} units and width ${w} units. What is its height?`,
        lv: `Taisnstūra perimetrs ir ${perimeter} vienības, platums ir ${w} vienības. Kāds ir augstums?`,
        ru: `Периметр прямоугольника равен ${perimeter} единицам, ширина — ${w} единицам. Какова высота?`,
      }, h, `${perimeter} ÷ 2 − ${w} = ${h}.`, [perimeter - w, w + h]);
      // Equal areas can have either perimeter ordering, including a tie.
      const a = 2 + v % 4, b = 2 + Math.floor(v / 4) % 4, swap = v % 2 === 0, tie = v % 5 === 0;
      const first = swap ? [1, a * b] : [a, b], second = tie ? [first[1], first[0]] : swap ? [a, b] : [1, a * b];
      const pa = 2 * (first[0] + first[1]), pb = 2 * (second[0] + second[1]);
      const answer = pa > pb ? 'A' : pa < pb ? 'B' : 'A = B', choices = reviewChoiceOrder(['A', 'B', 'A = B'], key);
      return { prompt: {
        en: `Rectangle A is ${first[0]} × ${first[1]} units. Rectangle B is ${second[0]} × ${second[1]} units. Which has the larger perimeter? Choose A = B if equal.`,
        lv: `Taisnstūris A ir ${first[0]} × ${first[1]} vienības. Taisnstūris B ir ${second[0]} × ${second[1]} vienības. Kuram perimetrs ir lielāks? Ja vienādi, izvēlies A = B.`,
        ru: `Стороны прямоугольника A: ${first[0]} × ${first[1]} единиц. Стороны B: ${second[0]} × ${second[1]} единиц. У какого периметр больше? Если равны, выбери A = B.`,
      }, choices, correctIndex: choices.indexOf(answer), explanation: { en: `A: ${pa}; B: ${pb}.`, lv: `A: ${pa}; B: ${pb}.`, ru: `A: ${pa}; B: ${pb}.` } };
    }
    if (lesson.id === 'hard-measurement-area' || mode === 2) return ask({
      en: `A rectangle has ${h} rows of ${w} unit squares. What is its area in square units?`,
      lv: `Taisnstūrī ir ${h} rindas, katrā ${w} vienības kvadrāti. Kāds ir laukums kvadrātvienībās?`,
      ru: `В прямоугольнике ${h} рядов по ${w} единичных квадратов. Чему равна площадь в квадратных единицах?`,
    }, area, `${h} × ${w} = ${area}.`, [perimeter, h + w]);
    return ask({
      en: `A rectangle is ${w} units wide and ${h} units high. What is its perimeter in units?`,
      lv: `Taisnstūra platums ir ${w} vienības, augstums ir ${h} vienības. Kāds ir perimetrs vienībās?`,
      ru: `Ширина прямоугольника — ${w} единиц, высота — ${h} единиц. Чему равен периметр в единицах?`,
    }, perimeter, `${w} + ${h} + ${w} + ${h} = ${perimeter}.`, [area, w + h]);
  }
  if (['medium-addition-tens', 'medium-subtraction-parts'].includes(lesson.id)) {
    const tens = 2 + v % 5, ones = 1 + Math.floor(v / 5) % 8, n = tens * 10 + ones;
    if (mode === 0) return ask({
      en: `Build ${n} using ${tens} tens. How many ones are also needed?`,
      lv: `Izveido ${n}, izmantojot ${tens} desmitus. Cik vienu vēl vajag?`,
      ru: `Составь ${n}, используя ${tens} десятков. Сколько ещё нужно единиц?`,
    }, ones, `${tens} × 10 + ${ones} = ${n}.`, [tens, ones + 10]);
    if (mode === 1 && lesson.topicId === 'subtraction') return ask({
      en: `There are ${tens} tens and ${ones} ones. Exchange one ten for ones. How many ones are there now?`,
      lv: `Ir ${tens} desmiti un ${ones} vieni. Samaini vienu desmitu pret vieniem. Cik vienu tagad ir?`,
      ru: `Есть ${tens} десятков и ${ones} единиц. Разменяй один десяток на единицы. Сколько теперь единиц?`,
    }, ones + 10, `${tens} × 10 + ${ones} = ${tens - 1} × 10 + ${ones + 10}.`, [ones, tens - 1]);
    if (mode === 1) return ask({
      en: `There are ${tens} tens and ${ones + 10} ones. Exchange ten ones for a ten. How many tens are there now?`,
      lv: `Ir ${tens} desmiti un ${ones + 10} vieni. Samaini desmit vienus pret desmitu. Cik desmitu tagad ir?`,
      ru: `Есть ${tens} десятков и ${ones + 10} единиц. Замени десять единиц одним десятком. Сколько теперь десятков?`,
    }, tens + 1, `${tens} × 10 + ${ones + 10} = ${tens + 1} × 10 + ${ones}.`, [tens, ones]);
    const subtract = lesson.topicId === 'subtraction', operand = 10 + (subtract ? ones + 1 : 10 - ones), result = subtract ? n - operand : n + operand;
    const expression = `${n} ${subtract ? '−' : '+'} ${operand}`;
    return ask({ en: `Exchange tens and ones to solve: ${expression} = ?`, lv: `Samaini desmitus un vienus un atrisini: ${expression} = ?`, ru: `Используй размен десятков и единиц: ${expression} = ?` }, result, `${expression} = ${result}.`, [result - 10, result + 10]);
  }
  if (['medium-fractions-explore-7', 'medium-fractions-explore-8', 'medium-fractions-explore-9'].includes(lesson.id)) {
    const tenths = lesson.id.endsWith('-7'), exchange = lesson.id.endsWith('-9');
    const n = tenths ? (1 + v % 9) * 10 : exchange ? 101 + v % 109 : 1 + v % 99;
    const value = (n / 100).toFixed(tenths ? 1 : 2), local = value.replace('.', ',');
    const t = Math.floor(n % 100 / 10), h = n % 10, whole = Math.floor(n / 100);
    if (exchange && mode === 1) {
      const amount = 1 + v % 8, loose = Math.floor(v / 8) % 10;
      return ask({
        en: `There are ${amount} tenths and ${loose} hundredths. Exchange one tenth for hundredths. How many hundredths are there now?`,
        lv: `Ir ${amount} desmitdaļas un ${loose} simtdaļas. Samaini vienu desmitdaļu pret simtdaļām. Cik simtdaļu tagad ir?`,
        ru: `Есть ${amount} десятых и ${loose} сотых. Разменяй одну десятую на сотые. Сколько теперь сотых?`,
      }, loose + 10, { en: `${amount} × 0.1 + ${loose} × 0.01 = ${amount - 1} × 0.1 + ${loose + 10} × 0.01.`, lv: `${amount} × 0,1 + ${loose} × 0,01 = ${amount - 1} × 0,1 + ${loose + 10} × 0,01.`, ru: `${amount} × 0,1 + ${loose} × 0,01 = ${amount - 1} × 0,1 + ${loose + 10} × 0,01.` }, [loose, amount - 1]);
    }
    if (exchange && mode === 2) return ask({
      en: `There are ${t} tenths and ${h + 10} hundredths. Exchange ten hundredths for a tenth. How many tenths are there now?`,
      lv: `Ir ${t} desmitdaļas un ${h + 10} simtdaļas. Samaini desmit simtdaļas pret desmitdaļu. Cik desmitdaļu tagad ir?`,
      ru: `Есть ${t} десятых и ${h + 10} сотых. Замени десять сотых одной десятой. Сколько теперь десятых?`,
    }, t + 1, { en: `${t} × 0.1 + ${h + 10} × 0.01 = ${t + 1} × 0.1 + ${h} × 0.01.`, lv: `${t} × 0,1 + ${h + 10} × 0,01 = ${t + 1} × 0,1 + ${h} × 0,01.`, ru: `${t} × 0,1 + ${h + 10} × 0,01 = ${t + 1} × 0,1 + ${h} × 0,01.` }, [t, h]);
    if (mode === 1) return ask({
      en: `In ${value}, which digit is in the tenths place?`, lv: `Kurš cipars skaitlī ${local} ir desmitdaļu vietā?`, ru: `Какая цифра в числе ${local} стоит в разряде десятых?`,
    }, t, { en: `${value} = ${whole} × 1 + ${t} × 0.1 + ${h} × 0.01.`, lv: `${local} = ${whole} × 1 + ${t} × 0,1 + ${h} × 0,01.`, ru: `${local} = ${whole} × 1 + ${t} × 0,1 + ${h} × 0,01.` }, [h, whole], 0, 9);
    if (exchange) return ask({
      en: `How many hundredths make ${value}?`, lv: `Cik simtdaļu veido ${local}?`, ru: `Сколько сотых составляет ${local}?`,
    }, n, { en: `${n}/100 = ${value}.`, lv: `${n}/100 = ${local}.`, ru: `${n}/100 = ${local}.` }, [t * 10 + h, n * 10]);
    const scale = tenths ? 10 : 100, answer = n * scale / 100;
    return ask({
      en: `A whole grid has ${scale} equal cells. How many cells must be shaded to show ${value}?`,
      lv: `Veselajā režģī ir ${scale} vienādas rūtiņas. Cik rūtiņu jāiekrāso, lai attēlotu ${local}?`,
      ru: `В целой сетке ${scale} равных клеток. Сколько клеток нужно закрасить, чтобы показать ${local}?`,
    }, answer, { en: `${answer}/${scale} = ${value}.`, lv: `${answer}/${scale} = ${local}.`, ru: `${answer}/${scale} = ${local}.` }, [tenths ? answer + 1 : t, h]);
  }
  if (['easy-fractions-explore-4', 'easy-fractions-explore-5'].includes(lesson.id) && mode !== 0) {
    const d = [3, 4, 6, 8][v % 4], n = 1 + Math.floor(v / 4) % (d - 1), m = 1 + Math.floor(v / 32) % (d - 1);
    const answer = n > m ? 'A' : n < m ? 'B' : 'A = B', choices = reviewChoiceOrder(['A', 'B', 'A = B'], key);
    const detail = `${n}/${d} ${n > m ? '>' : n < m ? '<' : '='} ${m}/${d}.`;
    return { diagram: { parts: d, colored: n }, prompt: {
      en: `Equal-sized strips each have ${d} equal parts. The picture shows A with ${n} shaded parts. B has ${m} shaded parts. Which has more shaded? Choose A = B if equal.`,
      lv: `Vienāda lieluma joslās katrā ir ${d} vienādas daļas. Attēlā ir A ar ${n} iekrāsotām daļām. B ir ${m} iekrāsotas daļas. Kurai iekrāsots vairāk? Ja vienādi, izvēlies A = B.`,
      ru: `Одинаковые полоски разделены на ${d} равных частей. На рисунке A закрашено ${n} частей. На B закрашено ${m} частей. Где закрашено больше? Если поровну, выбери A = B.`,
    }, choices, correctIndex: choices.indexOf(answer), explanation: { en: detail, lv: detail, ru: detail } };
  }
  // Keep the existing picture-supported equivalence checks on alternating days.
  if (['easy-fractions-pictures', 'easy-fractions-explore-3', 'easy-fractions-explore-6', 'medium-fractions-equivalent'].includes(lesson.id) && mode === 0) {
    const denominators = lesson.id === 'easy-fractions-pictures' ? [2, 4] : lesson.id === 'easy-fractions-explore-3' ? [3, 5, 6] : [2, 3, 4];
    const d = denominators[v % denominators.length], n = 1 + Math.floor(v / 3) % (d - 1), divisions = lesson.difficulty === 'medium' ? d * 2 : d, steps = n * divisions / d;
    return ask({
      en: `From 0 to 1, a number line has ${divisions} equal intervals. How many steps from 0 reach ${n}/${d}?`,
      lv: `Skaitļu taisne no 0 līdz 1 sadalīta ${divisions} vienādos intervālos. Cik soļu no 0 jāveic, lai nonāktu pie ${n}/${d}?`,
      ru: `Отрезок числовой прямой от 0 до 1 разделён на ${divisions} равных промежутков. Сколько шагов от 0 до ${n}/${d}?`,
    }, steps, `${steps}/${divisions} = ${n}/${d}.`, [steps + 1, divisions - steps], 0, divisions);
  }
  return null;
}
