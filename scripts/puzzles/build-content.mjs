/** Authoring source. Run npm run puzzles:build after changing topics or lessons. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { bossStories } from './boss-stories.mjs';
const text = (en, lv) => ({ en, lv });
function writeGenerated(file, value) {
  const content = JSON.stringify(value, null, 2) + '\n';
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (process.argv.includes('--check')) assert.equal(existing, content, `${file}: run npm run puzzles:build`);
  else if (existing !== content) fs.writeFileSync(file, content);
}
const topics = [
  ['addition', 'Addition', 'Saskaitīšana', 'Join quantities and find missing parts.', 'Apvieno daudzumus un atrodi trūkstošās daļas.', 'addition'],
  ['subtraction', 'Subtraction', 'Atņemšana', 'Take away, compare and check what remains.', 'Atņem, salīdzini un pārbaudi atlikušo.', 'subtraction'],
  ['numbers', 'Numbers and order', 'Skaitļi un secība', 'Compare quantities and put numbers in order.', 'Salīdzini daudzumus un sakārto skaitļus.', 'scale'],
  ['patterns', 'Patterns', 'Virknes', 'Discover how numbers change.', 'Atklāj, kā mainās skaitļi.', 'patterns'],
  ['multiplication', 'Equal groups', 'Vienādas grupas', 'Build rows and explore multiplication.', 'Veido rindas un iepazīsti reizināšanu.', 'multiplication'],
  ['division', 'Sharing and division', 'Dalīšana', 'Share fairly and understand leftovers.', 'Sadali vienādi un izproti atlikumu.', 'division'],
  ['fractions', 'Fractions', 'Daļas', 'Explore equal parts of the same whole.', 'Iepazīsti viena veselā vienādās daļas.', 'fractions'],
  ['operations', 'Number routes', 'Skaitļu ceļi', 'Choose operations and plan your steps.', 'Izvēlies darbības un plāno soļus.', 'operations'],
  ['percentages', 'Percentages', 'Procenti', 'Connect percentages, fractions and prices.', 'Saisti procentus, daļas un cenas.', 'store'],
  ['measurement', 'Measure and estimate', 'Mērīšana un aptuvenie aprēķini', 'Use units, area and sensible estimates.', 'Izmanto mērvienības, laukumu un aptuvenus aprēķinus.', 'stats'],
  ['logic', 'Reasoning', 'Spriešana', 'Check clues and explain what must be true.', 'Pārbaudi norādes un pamato secinājumus.', 'brain'],
].map(([id, en, lv, descEn, descLv, icon]) => ({ id, title: text(en, lv), description: text(descEn, descLv), icon }));
const lessons = [], puzzles = { en: { easy: [], medium: [], hard: [] }, lv: { easy: [], medium: [], hard: [] } };
const task = (type, topic, question, payload, hint, explanation, extra = {}) => ({ type, topic, question, payload, hint, explanation, ...extra });
function choice(topic, question, answer, wrong, hint, explanation, helpTemplate, taskVisual) {
  return task('multiple_choice', topic, question, undefined, hint, explanation, { choices: [String(answer), ...wrong.map(String)], correctIndex: 0, ...(helpTemplate && { helpTemplate }), ...(taskVisual && { taskVisual }) });
}
const hint = {
  add: text('Can you make a full ten first?', 'Vai vari vispirms izveidot pilnu desmitu?'),
  subtract: text('Break the amount you take away into smaller steps.', 'Sadali atņemamo skaitli mazākos soļos.'),
  groups: text('Count the same number in every group.', 'Katrā grupā saskaiti vienādu skaitu.'),
  fractions: text('Check the total number of equal parts first.', 'Vispirms pārbaudi visu vienādo daļu skaitu.'),
  route: text('Try a step, then check where it takes you.', 'Izmēģini soli un pārbaudi, kur tas aizved.'),
};
function addSet(a, b) {
  const sum = a + b;
  return [
    choice('addition', text(`The cat packs ${a} red ribbons and ${b} blue ribbons. How many ribbons?`, `Kaķis saliek ${a} sarkanas un ${b} zilas lentes. Cik lenšu kopā?`), sum, [sum - 1, sum + 1], hint.add, text(`${a} + ${b} = ${sum} ribbons.`, `${a} + ${b} = ${sum} lentes.`), undefined, sum <= 20 ? { kind: "join", left: a, right: b, object: "ribbon" } : undefined),
    task('balance', 'equality', text('Fill the missing part of the sum.', 'Aizpildi trūkstošo summas daļu.'), { leftDisplay: `${a} + ?`, rightValue: sum, choices: [String(b), String(b + 1), String(b + 2)] }, text(`What must join ${a} to make ${sum}?`, `Kas jāpieskaita ${a}, lai iegūtu ${sum}?`), text(`${a} + ${b} = ${sum}.`, `${a} + ${b} = ${sum}.`), { correctIndex: 0 }),
    task('pair_sum', 'mental_math', text(`Choose two tiles that make ${sum}.`, `Izvēlies divas kartītes, kuru summa ir ${sum}.`), { numbers: [a, b, 1, sum - 1, 2, sum - 2], target: sum, correctIndices: [0, 1] }, text('Choose one number and find its missing partner.', 'Izvēlies skaitli un atrodi tā trūkstošo pārinieku.'), text(`Any two different tiles adding to ${sum} work.`, `Der jebkuras divas atšķirīgas kartītes, kuru summa ir ${sum}.`)),
    task('fix_mistake', 'addition', text('Minka tried adding. Which repair is right?', 'Minka mēģināja saskaitīt. Kurš labojums ir pareizs?'), { wrongWork: [`${a} + ${b} = ${sum - 1}`], choices: [`${a} + ${b} = ${sum}`, `${a} + ${b} = ${sum + 1}`, `${a} + ${b} = ${sum + 2}`] }, hint.add, text(`The total is ${sum}, not ${sum - 1}.`, `Summa ir ${sum}, nevis ${sum - 1}.`), { correctIndex: 0 }),
  ];
}
function subtractSet(a, b) {
  const result = a - b;
  return [
    choice('subtraction', text(`There are ${a} paper stars. Use ${b} on a card. How many stay in the box?`, `Ir ${a} papīra zvaigznes. ${b} pielīmē kartītei. Cik paliek kastē?`), result, [result + 1, a + b], hint.subtract, text(`${a} − ${b} = ${result} stay.`, `${a} − ${b} = ${result} paliek.`), undefined, a <= 20 ? { kind: "take_away", left: a, right: b, object: "star" } : undefined),
    task('number_line', 'subtraction', text('Move back on the number line.', 'Pārvietojies atpakaļ pa skaitļu taisni.'), { start: a, jump: -b, min: 0, max: a + 3, correctValue: result }, text('Count moves after the starting point.', 'Skaiti soļus pēc sākuma punkta.'), text(`${a} − ${b} = ${result}.`, `${a} − ${b} = ${result}.`)),
    task('true_false', 'subtraction', text('Check the cat’s subtraction.', 'Pārbaudi kaķa atņemšanu.'), { statement: `${a} − ${b} = ${result + 1}` }, hint.subtract, text(`False. ${a} − ${b} = ${result}.`, `Nepareizi. ${a} − ${b} = ${result}.`), { isTrue: false }),
    task('fix_mistake', 'subtraction', text('Which calculation repairs Minka’s work?', 'Kurš aprēķins izlabo Minkas darbu?'), { wrongWork: [`${a} − ${b} = ${result - 1}`], choices: [`${a} − ${b} = ${result}`, `${a} − ${b} = ${result + 2}`, `${a} + ${b} = ${a + b}`] }, hint.subtract, text(`Take away ${b}, leaving ${result}.`, `Atņem ${b}, paliek ${result}.`), { correctIndex: 0 }),
  ];
}
function numberSet(values) {
  const sorted = [...values].sort((a,b) => a-b);
  return [
    task('order_numbers', 'comparison', text('Put the number tiles from smallest to largest.', 'Sakārto skaitļu kartītes no mazākā līdz lielākajam.'), { numbers: values, correctOrder: sorted }, text('Find the smallest tile first.', 'Vispirms atrodi mazāko kartīti.'), text(`The order is ${sorted.join(', ')}.`, `Secība ir ${sorted.join(', ')}.`)),
    task('compare', 'comparison', text('Which tray has more toy mice?', 'Kurā paplātē ir vairāk rotaļu peļu?'), { optionA: String(sorted[1]), optionB: String(sorted[3]), object: "mouse" }, text('Compare the amounts.', 'Salīdzini daudzumus.'), text(`${sorted[3]} > ${sorted[1]}.`, `${sorted[3]} > ${sorted[1]}.`), { correctIndex: 1 }),
    choice('comparison', text(`Which number is between ${sorted[0]} and ${sorted[2]}?`, `Kurš skaitlis ir starp ${sorted[0]} un ${sorted[2]}?`), sorted[1], [sorted[0], sorted[3]], text('The endpoints are not between themselves.', 'Robežskaitļi nav starp pašiem sevi.'), text(`${sorted[0]} < ${sorted[1]} < ${sorted[2]}.`, `${sorted[0]} < ${sorted[1]} < ${sorted[2]}.`), 'number_range'),
    task('number_line', 'addition', text('Make a forward jump.', 'Veic lēcienu uz priekšu.'), { start: sorted[0], jump: sorted[1], min: 0, max: sorted[3] + sorted[1], correctValue: sorted[0] + sorted[1] }, text('Start at the marked number and count forward.', 'Sāc pie atzīmētā skaitļa un skaiti uz priekšu.'), text(`${sorted[0]} + ${sorted[1]} = ${sorted[0] + sorted[1]}.`, `${sorted[0]} + ${sorted[1]} = ${sorted[0] + sorted[1]}.`)),
  ];
}
// Each activity has its own example. Sharing an example would let an earlier answer
// solve a later task without doing any new mathematics.
function practiceSet(makeTasks, examples) {
  assert.equal(examples.length, 4, 'A practice set needs four independently authored examples');
  return examples.map((args, index) => makeTasks(...args)[index]);
}
function patternSet(examples) {
  assert.equal(examples.length, 4);
  return examples.map(([start, operator, operand], index) => {
    const apply = value => operator === '×' ? value * operand : operator === '÷' ? value / operand : operator === '+' ? value + operand : value - operand;
    const sequence = [start];
    for (let i = 0; i < (index === 1 ? 1 : 4); i++) sequence.push(apply(sequence.at(-1)));
    assert.ok(sequence.every(value => Number.isInteger(value) && value >= 0));
    const rule = `${operator}${operand}`;
    const patternHint = text('Compare each number with the one before it.', 'Salīdzini katru skaitli ar iepriekšējo.');
    if (index === 1) {
      const wrong = operator === '÷' ? [`−${operand}`, `÷${operand + 1}`] : operator === '−' ? [`+${operand}`, `−${operand + 1}`] : [`${operator}${operand + 1}`, `${operator}${operand + 2}`];
      return task('function_machine', 'patterns', text('Choose the rule that works for this machine.', 'Izvēlies šai mašīnai derīgu likumu.'), { input: start, output: apply(start), choices: [rule, ...wrong] }, text('Test each offered rule on the input.', 'Pārbaudi katru piedāvāto likumu ar ievades skaitli.'), text(`The rule is ${rule}.`, `Likums ir ${rule}.`), { correctIndex: 0 });
    }
    const missing = index === 2;
    const value = sequence[missing ? 2 : 4];
    const explanation = text(`Each step uses ${rule}. The missing number is ${value}.`, `Katrā solī izmanto ${rule}. Trūkstošais skaitlis ir ${value}.`);
    if (missing) return choice('patterns', text(`Which number belongs in the gap? ${sequence.map((n, i) => i === 2 ? '?' : n).join(', ')}.`, `Kurš skaitlis iederas tukšajā vietā? ${sequence.map((n, i) => i === 2 ? '?' : n).join(', ')}.`), value, [value + 1, value + 2], patternHint, explanation);
    return task('pattern_next', 'patterns', text('What comes next?', 'Kas būs tālāk?'), { sequence: sequence.slice(0, 4), choices: [String(value), String(value + 1), String(value + 2)] }, patternHint, explanation, { correctIndex: 0 });
  });
}
function multiplySet(groups, size, claimCorrect = true) {
  const total = groups * size;
  return [
    choice('multiplication', text(`Make ${groups} rows with ${size} toy mice in each. How many mice?`, `Izveido ${groups} rindas, katrā pa ${size} rotaļu pelēm. Cik peļu kopā?`), total, [groups + size, total + size], hint.groups, text(`${groups} × ${size} = ${total}.`, `${groups} × ${size} = ${total}.`), undefined, { kind: "array", rows: groups, columns: size, object: "mouse" }),
    task('function_machine', 'multiplication', text('Which rule makes the right number of toys?', 'Kurš likums dod pareizo rotaļlietu skaitu?'), { input: groups, output: total, choices: [`×${size}`, `+${size}`, `×${size + 1}`] }, hint.groups, text(`Multiply by ${size}.`, `Reizini ar ${size}.`), { correctIndex: 0 }),
    task('true_false', 'multiplication', text('Check the equal-group claim.', 'Pārbaudi apgalvojumu par vienādām grupām.'), { statement: `${groups} × ${size} = ${total + (claimCorrect ? 0 : 1)}` }, hint.groups, text(`${claimCorrect ? "True" : "False"}. ${groups} groups of ${size} make ${total}.`, `${claimCorrect ? "Pareizi" : "Nepareizi"}. ${groups} grupas pa ${size} ir ${total}.`), { isTrue: claimCorrect }),
    task('balance', 'equality', text('How many toys are in each equal row?', 'Cik rotaļlietu ir katrā vienādajā rindā?'), { leftDisplay: `${groups} × ?`, rightValue: total, choices: [String(size), String(size + 1), String(size + 2)] }, hint.groups, text(`${groups} × ${size} = ${total}.`, `${groups} × ${size} = ${total}.`), { correctIndex: 0, helpTemplate: 'multiplication' }),
  ];
}
function divideSet(total, people, object = "cookie") {
  const each = Math.floor(total / people), left = total % people;
  const payload = locale => ({ items: total, people, object, emoji: object === 'parcel' ? '📦' : '🍪', choices: locale === 'en' ? [`${each} each, ${left} left`, `${each + 1} each, none left`, `${each} each, ${left + 1} left`] : [`Katram ${each}, atlikums ${left}`, `Katram ${each + 1}, bez atlikuma`, `Katram ${each}, atlikums ${left + 1}`] });
  return [
    task('fair_share', 'division', text('Share whole cookies equally. How many each, and how many remain?', 'Sadali veselus cepumus vienādi. Cik katram un cik paliek pāri?'), { en: payload('en'), lv: payload('lv') }, text('Give each friend one cookie per round.', 'Katrā aplī iedod katram draugam vienu cepumu.'), text(`${total} = ${people} × ${each} + ${left}.`, `${total} = ${people} × ${each} + ${left}.`), { correctIndex: 0 }),
    choice('division', text(`Pack ${people * each} bells into ${people} equal boxes. How many per box?`, `Saliec ${people * each} zvaniņus ${people} vienādās kastēs. Cik katrā?`), each, [each + 1, each + 2], text('Think of the matching multiplication fact.', 'Atceries atbilstošo reizināšanas vienādību.'), text(`${people * each} ÷ ${people} = ${each}.`, `${people * each} ÷ ${people} = ${each}.`)),
    task('function_machine', 'division', text('Which division rule fits?', 'Kurš dalīšanas likums der?'), { input: people * each, output: each, choices: [`÷${people}`, `÷${people + 1}`, `−${people}`] }, text('Test the number of equal groups.', 'Pārbaudi vienādo grupu skaitu.'), text(`The rule is ÷${people}.`, `Likums ir ÷${people}.`), { correctIndex: 0 }),
    task('fix_mistake', 'division', text('Repair the sharing calculation.', 'Izlabo dalīšanas aprēķinu.'), { wrongWork: [`${people * each} ÷ ${people} = ${each + 1}`], choices: [`${people * each} ÷ ${people} = ${each}`, `${people * each} ÷ ${people} = ${each + 2}`, `${people * each} ÷ ${people} = ${each + 3}`] }, text('Multiply the proposed answer by the number of groups.', 'Reizini piedāvāto atbildi ar grupu skaitu.'), text(`${people} × ${each} = ${people * each}.`, `${people} × ${each} = ${people * each}.`), { correctIndex: 0, helpTemplate: 'division' }),
  ];
}
function fractionSet(n, d, advanced = false) {
  if (advanced) return [
    choice('fractions', text(`A tray has ${d * 4} seedlings. ${n}/${d} are flowers. How many flowers?`, `Paplātē ir ${d * 4} stādi. ${n}/${d} ir puķes. Cik puķu?`), n * 4, [n * 4 + 1, d * 4 - n], hint.fractions, text(`One part is 4 seedlings. ${n} parts make ${n * 4}.`, `Viena daļa ir 4 stādi. ${n} daļas ir ${n * 4}.`), 'fraction_of_set'),
    task('fraction_equivalent', 'fractions', text('Choose the fraction with the same value.', 'Izvēlies tikpat lielu daļu.'), { numerator: n, denominator: d, choices: [`${n * 2}/${d * 2}`, `${n}/${d * 2}`, `${n * 2}/${d}`] }, text('Split every part into two equal smaller parts.', 'Sadali katru daļu divās vienādās mazākās daļās.'), text(`${n}/${d} = ${2*n}/${2*d}.`, `${n}/${d} = ${2*n}/${2*d}.`), { correctIndex: 0 }),
    task('compare', 'fractions', text('The ribbons have the same length. Which colored amount is larger?', 'Lentes ir vienāda garuma. Kurš iekrāsotais daudzums ir lielāks?'), { optionA: `${n}/${d}`, optionB: `${n + 1}/${d}` }, hint.fractions, text(`${n+1}/${d} > ${n}/${d}.`, `${n+1}/${d} > ${n}/${d}.`), { correctIndex: 1, helpTemplate: 'fraction_equivalent' }),
    task('fraction_match', 'fractions', text('Match the fractions to equal-part models.', 'Savieno daļas ar vienādo daļu attēliem.'), { pairs: [{numerator:n,denominator:d,visual:'pie'},{numerator:n+1,denominator:d,visual:'grid'}] }, hint.fractions, text('The shaded count is the numerator; all equal parts give the denominator.', 'Iekrāsoto daļu skaits ir skaitītājs, visu vienādo daļu skaits ir saucējs.')),
  ];
  return [
    task('fraction_build', 'fractions', text(`Color ${n}/${d} of this whole.`, `Iekrāso ${n}/${d} no šī veselā.`), { numerator: n, denominator: d }, hint.fractions, text(`Color ${n} out of ${d} equal parts.`, `Iekrāso ${n} no ${d} vienādām daļām.`)),
    task('compare', 'fractions', text('The wholes are the same size. Which fraction is larger?', 'Veselie ir vienāda lieluma. Kura daļa ir lielāka?'), { optionA: `${n+1}/${d}`, optionB: `${n}/${d}` }, hint.fractions, text(`${n+1}/${d} > ${n}/${d}.`, `${n+1}/${d} > ${n}/${d}.`), { correctIndex: 0 }),
    task('fraction_match', 'fractions', text('Match each fraction to its picture.', 'Savieno katru daļu ar tās attēlu.'), { pairs: [{numerator:1,denominator:d,visual:'pie'},{numerator:n+1,denominator:d,visual:'grid'}] }, hint.fractions, text('Count the shaded parts and all equal parts.', 'Saskaiti iekrāsotās daļas un visas vienādās daļas.')),
    task('fraction_equivalent', 'fractions', text('Which fraction covers the same amount of the same-size whole?', 'Kura daļa aizņem tikpat daudz no vienāda lieluma veselā?'), { numerator: n, denominator: d, choices: [`${n * 2}/${d * 2}`, `${n}/${d * 2}`, `${n + 1}/${d}`] }, text('Split every equal part in two.', 'Sadali katru vienādo daļu divās.'), text(`${n}/${d} = ${2*n}/${2*d}.`, `${n}/${d} = ${2*n}/${2*d}.`), { correctIndex: 0 }),
  ];
}
function operationSet(start, divisor, extra, guided = true) {
  const mid = start / divisor, target = mid + extra;
  return [
    task('operation_path', 'operations', text('Choose two operations to finish this delivery route.', 'Izvēlies divas darbības, lai pabeigtu piegādes ceļu.'), { start, target, steps: [{operand:divisor,operator:'÷'},{operand:extra,operator:'+'}] }, hint.route, text(`${start} ÷ ${divisor} = ${mid}; ${mid} + ${extra} = ${target}.`, `${start} ÷ ${divisor} = ${mid}; ${mid} + ${extra} = ${target}.`)),
    task('target_build', 'operations', guided ? text('Keep the numbers in order. Multiply and divide before adding or subtracting.', 'Saglabā skaitļu secību. Reizini un dali pirms saskaitīšanas vai atņemšanas.') : text('Which operations make the target? Keep the numbers in order.', 'Kuras darbības ļauj iegūt mērķa skaitli? Saglabā skaitļu secību.'), { numbers: [extra, divisor, mid], target: extra + start, solution: ['+', '×'] }, text('Try multiplying the last two numbers first.', 'Vispirms mēģini sareizināt pēdējos divus skaitļus.'), text(`${extra} + ${divisor} × ${mid} = ${extra + start}.`, `${extra} + ${divisor} × ${mid} = ${extra + start}.`)),
    task('function_machine', 'operations', text('Select the rule that turns input into output.', 'Izvēlies likumu, kas ievadi pārvērš izvadē.'), { input: mid, output: mid * divisor + extra, choices: [`×${divisor}+${extra}`, `×${divisor}`, `+${divisor}`] }, text('Test the whole rule, in the order shown.', 'Pārbaudi visu likumu norādītajā secībā.'), text(`${mid} × ${divisor} + ${extra} = ${mid * divisor + extra}.`, `${mid} × ${divisor} + ${extra} = ${mid * divisor + extra}.`), { correctIndex: 0 }),
    task('compare', 'comparison', text('Which expression has the greater value?', 'Kurai izteiksmei ir lielāka vērtība?'), { optionA: `${start} ÷ ${divisor} + ${extra}`, optionB: `${start} + ${extra}` }, hint.route, text(`${target} < ${start + extra}.`, `${target} < ${start + extra}.`), { correctIndex: 1 }),
  ];
}
function percentSet(price, percent) {
  const discount = price * percent / 100, sale = price - discount;
  const amountHelp = { 10: "percent_tenth", 20: "percent_fifth", 25: "percent_of", 50: "percent_half" }[percent];
  const discountHelp = { 10: "percent_tenth_discount", 20: "percent_fifth_discount", 25: "percent_discount", 50: "percent_half_discount" }[percent];
  return [
    choice('fractions', text(`What is ${percent}% of ${price} coins?`, `Cik ir ${percent}% no ${price} monētām?`), discount, [discount + 5, price - discount], text('Find the fraction represented by the percent.', 'Atrodi procentiem atbilstošo daļu.'), text(`${price} × ${percent}/100 = ${discount}.`, `${price} × ${percent}/100 = ${discount}.`), amountHelp),
    choice('fractions', text(`A ${price}-coin toy has a ${percent}% discount. What is the new price?`, `${price} monētu rotaļlietai ir ${percent}% atlaide. Kāda ir jaunā cena?`), sale, [price + discount, sale + 1], text('Find the discount amount, then take it away.', 'Atrodi atlaides summu un tad to atņem.'), text(`${price} − ${discount} = ${sale} coins.`, `${price} − ${discount} = ${sale} monētas.`), discountHelp),
    task('true_false', 'fractions', text('Check the percentage claim.', 'Pārbaudi apgalvojumu par procentiem.'), { statement: `${percent}% × ${price} = ${discount}` }, text('Use one hundred as the whole percentage.', 'Visu procentu daudzumu attēlo ar simtu.'), text(`True. ${percent}% of ${price} is ${discount}.`, `Pareizi. ${percent}% no ${price} ir ${discount}.`), { isTrue: true, helpTemplate: amountHelp }),
    task('fix_mistake', 'fractions', text(`A toy costs ${price} coins and has a ${percent}% discount. Which sale price is correct?`, `${price} monētu rotaļlietai ir ${percent}% atlaide. Kura cena ar atlaidi ir pareiza?`), { wrongWork: [`${price} + ${discount} = ${price + discount}`], choices: [String(sale), String(price + discount), String(sale + 2)] }, text('A discount reduces the original price.', 'Atlaide samazina sākotnējo cenu.'), text(`${price} − ${discount} = ${sale}.`, `${price} − ${discount} = ${sale}.`), { correctIndex: 0, helpTemplate: discountHelp }),
  ];
}
function measureSet(length, width) {
  const area = length * width;
  return [
    choice('multiplication', text(`A garden has ${length} rows of ${width} square planting spaces. How many square spaces?`, `Dārzā ir ${length} rindas, katrā ${width} kvadrātveida stādvietas. Cik stādvietu kopā?`), area, [length + width, 2 * (length + width)], hint.groups, text(`${length} × ${width} = ${area} square spaces.`, `${length} × ${width} = ${area} kvadrātveida stādvietas.`), undefined, { kind: "array", rows: length, columns: width, object: "planting_tile" }),
    choice('operations', text(`${area} grams of clay fill ${width} equal bags. How many grams for ${width + 2} bags?`, `${area} grami māla piepilda ${width} vienādus maisiņus. Cik gramu vajag ${width+2} maisiņiem?`), length * (width + 2), [area + 2, area * 2], text('Find the amount for one bag first.', 'Vispirms atrodi daudzumu vienam maisiņam.'), text(`${area} ÷ ${width} × ${width+2} = ${length * (width+2)} grams.`, `${area} ÷ ${width} × ${width+2} = ${length * (width+2)} grami.`), 'rate'),
    task('estimate', 'estimation', text('What is the total to the nearest ten?', 'Kāda ir summa, noapaļojot līdz tuvākajam desmitam?'), { en: { expression: `${area + 1} + ${area + 2}`, choices: [`About ${Math.round((area * 2 + 3)/10)*10}`, `About ${area*3}`, `About ${area*4}`] }, lv: { expression: `${area+1} + ${area+2}`, choices: [`Aptuveni ${Math.round((area*2+3)/10)*10}`, `Aptuveni ${area*3}`, `Aptuveni ${area*4}`] } }, text('Keep track of the size of the whole answer.', 'Pievērs uzmanību visas atbildes lielumam.'), text(`The total is ${area * 2 + 3}, which rounds to ${Math.round((area * 2 + 3)/10)*10}.`, `Summa ir ${area * 2 + 3}, noapaļojot iegūst ${Math.round((area * 2 + 3)/10)*10}.`), { correctIndex: 0 }),
    task('balance', 'equality', text('Find the missing number of equal rows.', 'Atrodi trūkstošo vienādo rindu skaitu.'), { leftDisplay: `? × ${width}`, rightValue: area, choices: [String(length), String(length+1), String(length+2)] }, hint.groups, text(`${length} × ${width} = ${area}.`, `${length} × ${width} = ${area}.`), { correctIndex: 0, helpTemplate: 'multiplication' }),
  ];
}
function logicSet(base, claim = "multiply") {
  return [
    choice('logic', text(`A number is greater than ${base}, less than ${base+4}, and even. Choose the number.`, `Skaitlis ir lielāks par ${base}, mazāks par ${base+4} un pāra. Izvēlies skaitli.`), base+2, [base+1, base+4], text('Check every clue, including the endpoints.', 'Pārbaudi visas norādes, arī robežas.'), text(`${base+2} is even and lies strictly between the endpoints.`, `${base+2} ir pāra skaitlis un atrodas stingri starp robežām.`), 'number_range'),
    claim === 'subtract' ? task('true_false', 'subtraction', text('Subtracting a positive whole number always gives a smaller result. Is that true?', 'Atņemot pozitīvu veselu skaitli, rezultāts vienmēr ir mazāks. Vai tā ir?'), { statement: `${base} > ${base} − 7`, hideStatement: true }, text('Consider what changes when a positive amount is taken away.', 'Padomā, kas mainās, atņemot pozitīvu daudzumu.'), text(`True. For example, ${base} − 7 = ${base-7}, which is smaller than ${base}.`, `Pareizi. Piemēram, ${base} − 7 = ${base-7}, kas ir mazāks par ${base}.`), { isTrue: true }) :
    task('true_false', 'multiplication', text('Multiplying two positive whole numbers always gives a result larger than either number. Is that true?', 'Divu pozitīvu veselu skaitļu reizinājums vienmēr ir lielāks par abiem skaitļiem. Vai tā ir?'), { statement: `${base} × 1 > ${base}`, hideStatement: true }, text('What happens when you multiply by one?', 'Kas notiek, reizinot ar vienu?'), text(`False. ${base} × 1 = ${base}, so it stays equal.`, `Nepareizi. ${base} × 1 = ${base}, tātad tas nemainās.`), { isTrue: false }),
    task('order_numbers', 'comparison', text('Arrange the clues from smallest to largest.', 'Sakārto norādes no mazākās līdz lielākajai.'), { numbers: [base+8,base+2,base+6,base], correctOrder:[base,base+2,base+6,base+8] }, text('Compare the numbers before moving them.', 'Pirms pārvietošanas salīdzini skaitļus.'), text(`${base} < ${base+2} < ${base+6} < ${base+8}.`, `${base} < ${base+2} < ${base+6} < ${base+8}.`)),
    choice('logic', text(`A box holds fewer than ${base} balls. Which amount is impossible?`, `Kastē ir mazāk nekā ${base} bumbiņas. Kurš daudzums nav iespējams?`), base+1, [base-1,base-2], text('Test each amount against “fewer than”.', 'Pārbaudi katru daudzumu pret nosacījumu “mazāk nekā”.'), text(`${base+1} is greater than ${base}.`, `${base+1} ir lielāks par ${base}.`), 'number_range'),
  ];
}
function register(difficulty, lessonId, tasks) {
  return tasks.map((spec, index) => {
    const id = `v2-${difficulty}-${lessonId}-${index+1}`;
    for (const locale of ['en', 'lv']) {
      const { question, hint: h, explanation, payload, ...rest } = spec;
      puzzles[locale][difficulty].push({ id, difficulty, ageRange: difficulty==='easy'?[6,8]:difficulty==='medium'?[8,10]:[10,12], ...rest, question: question[locale], hint: h[locale], explanation: explanation[locale], ...(payload && { payload: payload.en ? payload[locale] : payload }) });
    }
    return id;
  });
}
function lesson(difficulty, topicId, slug, title, description, tasks) {
  const id = `${difficulty}-${topicId}-${slug}`;
  const ids = register(difficulty, `${topicId}-${slug}`, tasks);
  lessons.push({ id, difficulty, topicId, title, description, levels: ids.map((puzzleId,index) => ({ id:puzzleId, kind:'practice', title:text(`Puzzle ${index+1}`, `Uzdevums ${index+1}`), description:text('Practise this lesson’s idea.', 'Vingrinies šīs nodarbības prasmē.'), puzzleIds:[puzzleId] })) });
  return id;
}
const intro = text('Start with a model, then try the idea in different ways.', 'Sāc ar modeli un tad izmēģini ideju dažādos veidos.');
const apply = text('Use what you learned with a new goal and different numbers.', 'Izmanto apgūto jaunam mērķim un citiem skaitļiem.');
lesson('easy','numbers','small',text('Small numbers in order','Mazi skaitļi secībā'),intro,practiceSet(numberSet, [[[8,1,6,3]], [[10,2,9,5]], [[2,6,8,11]], [[4,3,9,7]]]));
lesson('easy','numbers','tens',text('Across the first ten','Pāri pirmajam desmitam'),apply,practiceSet(numberSet, [[[19,4,12,7]], [[18,3,14,6]], [[5,9,16,20]], [[7,4,13,10]]]));
lesson('easy','addition','join',text('Put quantities together','Apvieno daudzumus'),intro,practiceSet(addSet, [[4,3], [5,6], [6,9], [7,5]]));
const easyAdd = lesson('easy','addition','ten',text('Make ten and keep going','Izveido desmitu un turpini'),apply,practiceSet(addSet, [[8,5], [9,7], [7,11], [6,8]]));
lesson('easy','subtraction','take',text('Take some away','Atņem daļu'),intro,practiceSet(subtractSet, [[9,3], [12,5], [15,6], [18,8]]));
lesson('easy','subtraction','back',text('Count back across ten','Skaiti atpakaļ pāri desmitam'),apply,practiceSet(subtractSet, [[14,6], [17,8], [20,7], [16,4]]));
lesson('easy','patterns','jumps',text('Discover different patterns','Atklāj dažādas virknes'),intro,patternSet([[2,'+',2], [7,'+',3], [18,'−',3], [15,'−',2]]));
lesson('easy','patterns','fives',text('Patterns in both directions','Virknes abos virzienos'),apply,patternSet([[5,'+',5], [12,'−',4], [1,'+',4], [3,'+',3]]));
lesson('easy','multiplication','rows',text('Rows of toys','Rotaļlietu rindas'),intro,practiceSet(multiplySet, [[3,4], [5,2], [4,4,false], [2,7]]));
const easyGroups = lesson('easy','multiplication','groups',text('More equal groups','Vairāk vienādu grupu'),apply,practiceSet(multiplySet, [[4,5], [3,6], [5,5], [7,4]]));
lesson('easy','fractions','parts',text('Equal pieces of one whole','Viena veselā vienādās daļas'),intro,practiceSet(fractionSet, [[1,4], [1,3], [2,6], [1,2]]));
lesson('easy','fractions','pictures',text('Read fraction pictures','Nolasi daļu attēlus'),apply,practiceSet(fractionSet, [[1,6], [2,5], [3,8], [2,3]]));
lesson('medium','addition','tens',text('Join tens and ones','Apvieno desmitus un vienus'),intro,practiceSet(addSet, [[27,16], [38,25], [19,35], [46,28]]));
const mediumAdd = lesson('medium','addition','regroup',text('Build a new ten','Izveido jaunu desmitu'),apply,practiceSet(addSet, [[46,27], [58,16], [29,36], [47,35]]));
lesson('medium','subtraction','parts',text('Subtract in useful parts','Atņem pa ērtām daļām'),intro,practiceSet(subtractSet, [[42,17], [51,24], [64,38], [73,45]]));
lesson('medium','subtraction','check',text('Check the difference','Pārbaudi starpību'),apply,practiceSet(subtractSet, [[63,28], [72,46], [81,37], [95,58]]));
lesson('medium','multiplication','arrays',text('Arrays and multiplication','Rindas un reizināšana'),intro,practiceSet(multiplySet, [[6,7], [4,8], [9,5], [7,7]]));
lesson('medium','multiplication','facts',text('Connect multiplication facts','Saisti reizināšanas vienādības'),apply,practiceSet(multiplySet, [[8,9], [7,6], [8,8,false], [9,4]]));
lesson('medium','division','equal',text('Share into equal groups','Sadali vienādās grupās'),intro,practiceSet(divideSet, [[24,4], [35,5], [54,6], [56,8]]));
const mediumShare = lesson('medium','division','leftovers',text('Whole groups and leftovers','Veselas grupas un atlikums'),apply,practiceSet(divideSet, [[23,5], [42,7], [64,8], [81,9]]));
lesson('medium','fractions','value',text('Same whole and same value','Tas pats veselais un tā pati vērtība'),intro,practiceSet(fractionSet, [[2,6], [3,8], [2,5], [3,4]]));
lesson('medium','fractions','equivalent',text('Match equivalent fractions','Savieno vienādas daļas'),apply,practiceSet(fractionSet, [[3,8], [2,7], [3,10], [4,5]]));
lesson('medium','operations','routes',text('Plan a number route','Plāno skaitļu ceļu'),intro,practiceSet(operationSet, [[18,3,4], [28,4,6], [40,5,3], [54,6,7]]));
const mediumRoutes = lesson('medium','operations','order',text('Which operation comes first?','Kura darbība ir pirmā?'),apply,practiceSet(operationSet, [[32,4,5], [45,5,8], [56,7,6], [63,9,4]]));
lesson('hard','operations','connected',text('Connect several operations','Saisti vairākas darbības'),intro,practiceSet(operationSet, [[72,8,7,false], [84,7,11,false], [96,6,5,false], [105,5,13,false]]));
lesson('hard','operations','strategies',text('Choose a useful strategy','Izvēlies noderīgu paņēmienu'),apply,practiceSet(operationSet, [[96,6,9,false], [108,9,14,false], [144,12,7,false], [132,11,8,false]]));
lesson('hard','fractions','amounts',text('Fractions of quantities','Daļas no daudzuma'),intro,practiceSet(fractionSet, [[3,5,true], [5,6,true], [3,7,true], [2,9,true]]));
const hardFractions = lesson('hard','fractions','apply',text('Use fractions in a plan','Izmanto daļas plānā'),apply,practiceSet(fractionSet, [[5,8,true], [4,7,true], [5,12,true], [3,10,true]]));
lesson('hard','patterns','multiply',text('Mixed number patterns','Dažādas skaitļu virknes'),intro,patternSet([[2,'×',3], [56,'÷',4], [243,'÷',3], [65,'−',7]]));
lesson('hard','patterns','scale',text('More pattern discoveries','Jauni atklājumi virknēs'),apply,patternSet([[3,'×',4], [17,'+',8], [6,'×',2], [11,'+',9]]));
lesson('hard','percentages','quarters',text('Percentages of quantities','Procenti no daudzumiem'),intro,practiceSet(percentSet, [[80,25], [150,20], [90,10], [200,50]]));
const hardPercent = lesson('hard','percentages','discounts',text('Discounts and final prices','Atlaides un gala cenas'),apply,practiceSet(percentSet, [[120,20], [160,25], [70,50], [250,10]]));
lesson('hard','measurement','area',text('Area and equal units','Laukums un vienādas mērvienības'),intro,practiceSet(measureSet, [[8,6], [15,4], [7,9], [11,5]]));
lesson('hard','measurement','rates',text('Find one, then scale','Atrodi vienu un mērogo'),apply,practiceSet(measureSet, [[12,5], [18,3], [8,11], [9,7]]));
lesson('hard','logic','clues',text('Check every clue','Pārbaudi katru norādi'),intro,practiceSet(logicSet, [[20], [20], [31], [48]]));
const hardLogic = lesson('hard','logic','claims',text('Test a mathematical claim','Pārbaudi matemātisku apgalvojumu'),apply,practiceSet(logicSet, [[40], [57,'subtract'], [65], [83]]));
function special(lessonId, slug, kind, title, description, tasks) {
  const target = lessons.find(l => l.id === lessonId);
  if (kind === 'boss') {
    assert.ok(bossStories[slug], `${slug}: author a boss story before adding its level`);
    assert.equal(tasks.length, 3, `${slug}: a boss has three connected tasks`);
    assert.equal(bossStories[slug].stages.length, 3);
  }
  target.levels.push({ id: `${target.id}-${slug}`, kind, title, description, ...(kind === 'boss' && { story: bossStories[slug] }), puzzleIds: register(target.difficulty, `${target.topicId}-${slug}`, tasks) });
}
const bossHint = text('Use the part you have already worked out. Finished stages stay saved.', 'Izmanto jau aprēķināto. Pabeigtie posmi tiek saglabāti.');
special(easyAdd,'picnic','boss',text('The cat picnic','Kaķa pikniks'),text('Pack ribbons, finish the places and open the picnic. Three saved stages.', 'Saliec lentes, sagatavo vietas un atklāj pikniku. Trīs saglabājami posmi.'),[
  choice('addition',text('Pack 8 red ribbons and 5 blue ribbons for the picnic. How many ribbons?', 'Piknikam saliec 8 sarkanas un 5 zilas lentes. Cik lenšu kopā?'),13,[12,14],hint.add,text('13 ribbons are packed. The first stage is ready.', 'Saliktas 13 lentes. Pirmais posms ir gatavs.')),
  task('balance','equality',text('Each of our 13 ribbons belongs to one guest. Five places are ready. How many more places do we need?', 'Katra no 13 lentēm ir vienam viesim. Piecas vietas ir gatavas. Cik vēl vietu vajag?'),{leftDisplay:'5 + ?',rightValue:13,choices:['8','7','9']},hint.add,text('5 + 8 = 13. Every guest has a place.', '5 + 8 = 13. Katram viesim ir vieta.'),{correctIndex:0,helpTemplate:'addition'}),
  choice('addition',text('Seven flags are up. How many more make thirteen flags?', 'Septiņi karodziņi ir izlikti. Cik vēl vajag, lai būtu trīspadsmit?'),6,[5,7],bossHint,text('7 + 6 = 13. The picnic is open!', '7 + 6 = 13. Pikniks ir atklāts!')),
]);
special(easyGroups,'shelves','boss',text('The toy workshop','Rotaļlietu darbnīca'),text('Fill three displays with equal rows. Finish one display at a time.', 'Piepildi trīs stendus ar vienādām rindām. Pabeidz pa vienam.'),[
  choice('multiplication',text('The first display needs 2 rows of 5 toys. How many toys?', 'Pirmajam stendam vajag 2 rindas pa 5 rotaļlietām. Cik rotaļlietu?'),10,[7,11],hint.groups,text('2 × 5 = 10. The first display is ready.', '2 × 5 = 10. Pirmais stends ir gatavs.')),
  task('balance','equality',text('The middle display has 12 toys in 3 equal rows. How many toys in each row?', 'Vidējā stendā ir 12 rotaļlietas 3 vienādās rindās. Cik rotaļlietu katrā rindā?'),{leftDisplay:'3 × ?',rightValue:12,choices:['4','5','6']},hint.groups,text('3 × 4 = 12. The middle display is ready.', '3 × 4 = 12. Vidējais stends ir gatavs.'),{correctIndex:0,helpTemplate:'multiplication'}),
  task('fix_mistake','multiplication',text('The last display needs 4 rows of 6 toys. Repair its label.', 'Pēdējam stendam vajag 4 rindas pa 6 rotaļlietām. Izlabo tā etiķeti.'),{wrongWork:['4 × 6 = 20'],choices:['4 × 6 = 24','4 × 6 = 22','4 × 6 = 26']},hint.groups,text('4 × 6 = 24. The workshop is open!', '4 × 6 = 24. Darbnīca ir atvērta!'),{correctIndex:0,helpTemplate:'multiplication'}),
]);
special(mediumShare,'parcels','boss',text('The parcel station','Sūtījumu stacija'),text('Count the arriving parcels, load the carts and deal with a late delivery.', 'Saskaiti pienākušos sūtījumus, piepildi ratiņus un sadali vēlo piegādi.'),[
  choice('multiplication',text('Four crates arrive with 7 parcels in each. How many parcels arrive?', 'Pienāk četras kastes, katrā 7 sūtījumi. Cik sūtījumu pienāk?'),28,[11,32],hint.groups,text('4 × 7 = 28 parcels are ready for delivery.', '4 × 7 = 28 sūtījumi ir gatavi piegādei.')),
  {...divideSet(28,4,"parcel")[0], question:text('Load the 28 parcels equally onto 4 carts. How many on each cart?', 'Saliec 28 sūtījumus vienādi 4 ratiņos. Cik katros?')},
  {...divideSet(31,4,"parcel")[0], question:text('Three late parcels arrive. Share all 31 whole parcels among 4 carts again. How many per cart and left at the station?', 'Pienāk vēl trīs sūtījumi. Pārdali visus 31 veselo sūtījumu starp 4 ratiņiem. Cik katros un cik paliek stacijā?')},
]);
special(mediumRoutes,'lanterns','boss',text('Light the lantern trail','Iededz laternu taku'),text('Carry power from one lantern to the next. Each repaired route lights another part of the trail.', 'Pārnes enerģiju no vienas laternas uz nākamo. Katrs salabotais ceļš iededz vēl vienu takas daļu.'),[
  task('operation_path','operations',text('The first lantern starts at 12. Use 4, then 4, to reach 20.', 'Pirmā laterna sāk ar 12. Izmanto 4 un tad 4, lai sasniegtu 20.'),{start:12,target:20,steps:[{operand:4,operator:'+'},{operand:4,operator:'+'}]},hint.route,text('12 + 4 + 4 = 20. The first lantern is lit.', '12 + 4 + 4 = 20. Pirmā laterna deg.')),
  task('function_machine','operations',text('The second lantern changes 20 into 13. Which rule fits?', 'Otrā laterna pārvērš 20 par 13. Kurš likums der?'),{input:20,output:13,choices:['÷2+3','−2+3','÷2−3']},hint.route,text('20 ÷ 2 + 3 = 13. The second lantern is lit.', '20 ÷ 2 + 3 = 13. Otrā laterna deg.'),{correctIndex:0}),
  task('target_build','operations',text('Use 4, 13 and 2 in that order to light the final lantern at 30.', 'Izmanto 4, 13 un 2 šādā secībā, lai iedegtu pēdējo laternu pie 30.'),{numbers:[4,13,2],target:30,solution:['+','×']},hint.route,text('4 + 13 × 2 = 30. The whole trail is lit!', '4 + 13 × 2 = 30. Visa taka ir izgaismota!')),
]);
special(hardFractions,'garden','boss',text('The garden plan','Dārza plāns'),text('Choose the flower area, finish the border and prepare the supplies.', 'Izvēlies puķu laukumu, pabeidz apmali un sagatavo krājumus.'),[
  choice('fractions',text('The garden has 24 equal spaces. Three quarters need flowers. How many flower spaces?', 'Dārzā ir 24 vienādas vietas. Trīs ceturtdaļās vajag puķes. Cik puķu vietu?'),18,[6,20],hint.fractions,text('24 ÷ 4 × 3 = 18 flower spaces.', '24 ÷ 4 × 3 = 18 puķu vietas.'),'fraction_of_set'),
  task('fraction_build','fractions',text('Three quarters of the garden are for flowers. Shade the part left for the path.', 'Trīs ceturtdaļas dārza paredzētas puķēm. Iekrāso takai atlikušo daļu.'),{numerator:1,denominator:4,hideTarget:true},hint.fractions,text('One of four equal parts is reserved for the path.', 'Viena no četrām vienādajām daļām ir atstāta takai.')),
  choice('multiplication',text('Each of the 18 flower spaces needs 3 seeds. How many seeds?', 'Katrai no 18 puķu vietām vajag 3 sēklas. Cik sēklu kopā?'),54,[21,48],hint.groups,text('18 × 3 = 54 seeds. The garden is ready!', '18 × 3 = 54 sēklas. Dārzs ir gatavs!')),
]);
special(hardPercent,'shop','boss',text('Open the toy shop','Atver rotaļlietu veikalu'),text('Calculate the discount, set the price and check a customer’s change.', 'Aprēķini atlaidi, nosaki cenu un pārbaudi pircēja atlikumu.'),[
  choice('fractions',text('A toy costs 80 coins. The discount is 25%. How many coins are taken off?', 'Rotaļlieta maksā 80 monētas. Atlaide ir 25%. Cik monētu atņem?'),20,[25,60],hint.fractions,text('80 ÷ 4 = 20 coins off.', '80 ÷ 4 = 20 monētu atlaide.'),'percent_of'),
  task('fix_mistake','subtraction',text('A toy costs 80 coins and has a 20-coin discount. Which sale price is correct?', 'Rotaļlieta maksā 80 monētas, un tai ir 20 monētu atlaide. Kura cena ar atlaidi ir pareiza?'),{wrongWork:['80 + 20 = 100'],choices:['60','100','70']},hint.subtract,text('80 − 20 = 60 coins.', '80 − 20 = 60 monētas.'),{correctIndex:0,helpTemplate:'percent_discount'}),
  choice('operations',text('Two toys cost 60 coins each. A customer pays 150. How much change?', 'Divas rotaļlietas maksā 60 monētas katra. Pircējs dod 150. Cik jāizdod?'),30,[90,120],text('Calculate both toys first, then find the change.', 'Vispirms aprēķini abu rotaļlietu cenu, tad atlikumu.'),text('150 − 2 × 60 = 30 coins. The shop is open!', '150 − 2 × 60 = 30 monētas. Veikals ir atvērts!'),'multiply_subtract'),
]);
// Every difficulty/topic has its own finale in its last lesson. Keep existing IDs stable.
function finale(difficulty, topicId, slug, title, description, stages) {
  const last = lessons.filter(l => l.difficulty === difficulty && l.topicId === topicId).at(-1);
  assert.ok(last, `Missing topic: ${difficulty}/${topicId}`);
  special(last.id, slug, 'boss', title, description, stages);
}
finale('easy','numbers','train',text('The midnight train','Pusnakts vilciens'),text('Order the platforms, choose the longest train and find the waiting carriage.', 'Sakārto peronus, izvēlies garāko vilcienu un atrodi gaidošo vagonu.'),[
  task('order_numbers','comparison',text('The train visits platforms in number order. Arrange its stops.', 'Vilciens apmeklē peronus skaitļu secībā. Sakārto pieturas.'),{numbers:[12,5,18,9],correctOrder:[5,9,12,18]},text('Start at the smallest platform number.', 'Sāc ar mazāko perona numuru.'),text('The stops are 5, 9, 12, 18.', 'Pieturas ir 5, 9, 12, 18.')),
  task('compare','comparison',text('Two trains have 12 and 18 carriages. Choose the longer train.', 'Diviem vilcieniem ir 12 un 18 vagoni. Izvēlies garāko vilcienu.'),{optionA:'12',optionB:'18',object:'carriage'},text('More carriages make a longer train.', 'Vairāk vagonu veido garāku vilcienu.'),text('18 > 12. The longer train is ready.', '18 > 12. Garākais vilciens ir gatavs.'),{correctIndex:1}),
  choice('comparison',text('The last passenger waits at a platform between 9 and 18. Which platform?', 'Pēdējais pasažieris gaida peronā starp 9 un 18. Kurā peronā?'),12,[5,18],text('Check both ends of the interval.', 'Pārbaudi abas intervāla robežas.'),text('9 < 12 < 18. Everyone is aboard!', '9 < 12 < 18. Visi ir vilcienā!'),'number_range'),
]);
finale('easy','subtraction','boats',text('Rescue the paper boats','Izglāb papīra laiviņas'),text('Launch the boats, follow them downstream and bring the last boats home.', 'Palaid laiviņas, seko tām lejup pa straumi un nogādā pēdējās mājās.'),[
  choice('subtraction',text('There are 14 paper boats. Launch 6. How many wait on the bank?', 'Ir 14 papīra laiviņas. Palaid 6. Cik gaida krastā?'),8,[7,20],hint.subtract,text('14 − 6 = 8 boats wait on the bank.', '14 − 6 = 8 laiviņas gaida krastā.')),
  task('number_line','subtraction',text('Three of the 8 waiting boats float away. Move back to find how many remain.', 'Trīs no 8 gaidošajām laiviņām aizpeld. Pārvietojies atpakaļ, lai atrastu atlikumu.'),{start:8,jump:-3,min:0,max:10,correctValue:5},hint.subtract,text('8 − 3 = 5 boats remain.', '8 − 3 = 5 laiviņas paliek.')),
  task('fix_mistake','subtraction',text('Two of the last 5 boats reach home. Repair the count of boats still coming.', 'Divas no pēdējām 5 laiviņām sasniedz mājas. Izlabo vēl gaidāmo laiviņu skaitu.'),{wrongWork:['5 − 2 = 4'],choices:['5 − 2 = 3','5 − 2 = 4','5 − 2 = 7']},hint.subtract,text('5 − 2 = 3. Guide the last three home!', '5 − 2 = 3. Aizved pēdējās trīs mājās!'),{correctIndex:0}),
]);
finale('easy','patterns','music',text('Wake the music box','Iedarbini mūzikas lādīti'),text('Find the beat, repair the winding rule and finish the tune.', 'Atrodi ritmu, salabo uzvilkšanas likumu un pabeidz melodiju.'),[
  task('pattern_next','patterns',text('The music box plays 3, 6, 9, 12 beats. How many come next?', 'Mūzikas lādīte spēlē 3, 6, 9, 12 sitienus. Cik būs tālāk?'),{sequence:[3,6,9,12],choices:['15','14','16']},text('Find the same increase each time.', 'Atrodi vienādo pieaugumu katrā solī.'),text('12 + 3 = 15. The beat is restored.', '12 + 3 = 15. Ritms ir atjaunots.'),{correctIndex:0}),
  task('function_machine','patterns',text('The winding gear turns 15 beats into 20. Choose its rule.', 'Uzvilkšanas zobrats pārvērš 15 sitienus par 20. Izvēlies tā likumu.'),{input:15,output:20,choices:['+5','+3','×2']},text('Test the change from input to output.', 'Pārbaudi izmaiņu no ievades līdz izvadei.'),text('15 + 5 = 20. The gears turn again.', '15 + 5 = 20. Zobrati atkal griežas.'),{correctIndex:0}),
  choice('patterns',text('Finish the tune. Which beat is missing? 20, 18, ?, 14, 12.', 'Pabeidz melodiju. Kurš sitiens trūkst? 20, 18, ?, 14, 12.'),16,[15,17],text('Check how the beats change in this part of the tune.', 'Pārbaudi, kā mainās sitieni šajā melodijas daļā.'),text('20, 18, 16, 14, 12. Each step takes away 2. The tune is complete!', '20, 18, 16, 14, 12. Katrā solī atņem 2. Melodija ir gatava!')),
]);
finale('easy','fractions','kite',text('Mend the festival kite','Salabo svētku pūķi'),text('Color the sail, check equal patches and match the repair pieces.', 'Iekrāso buru, pārbaudi vienādus ielāpus un savieno remonta gabalus.'),[
  task('fraction_build','fractions',text('The kite sail has 6 equal panels. Color 2 panels for its red patch.', 'Pūķa burai ir 6 vienādi laukumi. Iekrāso 2 laukumus sarkanajam ielāpam.'),{numerator:2,denominator:6},hint.fractions,text('2 of 6 equal panels make 2/6 of the sail.', '2 no 6 vienādiem laukumiem veido 2/6 buras.')),
  task('fraction_equivalent','fractions',text('The repair sheet has 12 equal pieces. Choose the same fraction as the 2/6 patch.', 'Remonta loksnei ir 12 vienādi gabali. Izvēlies tādu pašu daļu kā 2/6 ielāps.'),{numerator:2,denominator:6,choices:['4/12','2/12','6/12']},hint.fractions,text('2/6 = 4/12. The patch has the same size.', '2/6 = 4/12. Ielāps ir tikpat liels.'),{correctIndex:0}),
  task('fraction_match','fractions',text('Match the 2/6 patch and the remaining 4/6 sail to their pictures.', 'Savieno 2/6 ielāpu un atlikušās 4/6 buras ar attēliem.'),{pairs:[{numerator:2,denominator:6,visual:'pie'},{numerator:4,denominator:6,visual:'grid'}]},hint.fractions,text('2/6 and 4/6 cover the whole sail. The kite can fly!', '2/6 un 4/6 pārklāj visu buru. Pūķis var lidot!')),
]);
finale('medium','addition','tickets',text('The festival ticket desk','Svētku biļešu kase'),text('Count the guests, fill the guest list and welcome the late arrivals.', 'Saskaiti viesus, aizpildi viesu sarakstu un sagaidi nokavējušos.'),[
  choice('addition',text('37 guests arrive by bus and 28 walk in. How many guests have arrived?', '37 viesi atbrauc ar autobusu un 28 atnāk kājām. Cik viesu ieradušies?'),65,[55,66],hint.add,text('37 + 28 = 65 guests have arrived.', '37 + 28 = 65 viesi ir ieradušies.')),
  task('balance','equality',text('65 guests are here. How many more fill the list of 100?', '65 viesi ir klāt. Cik vēl vajag pilnam 100 viesu sarakstam?'),{leftDisplay:'65 + ?',rightValue:100,choices:['35','45','25']},hint.add,text('65 + 35 = 100. The guest list is full.', '65 + 35 = 100. Viesu saraksts ir pilns.'),{correctIndex:0,helpTemplate:'addition'}),
  task('fix_mistake','addition',text('46 extra guests join the 100. Repair the final ticket count.', '100 viesiem pievienojas vēl 46. Izlabo gala biļešu skaitu.'),{wrongWork:['100 + 46 = 140'],choices:['100 + 46 = 146','100 + 46 = 145','100 + 46 = 156']},hint.add,text('100 + 46 = 146. Every guest has a ticket!', '100 + 46 = 146. Katram viesim ir biļete!'),{correctIndex:0}),
]);
finale('medium','subtraction','lift',text('The mountain supply lift','Kalnu krājumu pacēlājs'),text('Send supplies uphill, count the second load and check the reserve.', 'Nosūti krājumus kalnā, saskaiti otro kravu un pārbaudi rezervi.'),[
  choice('subtraction',text('The base has 92 supply bags. Send 37 uphill. How many stay at the base?', 'Pakājē ir 92 krājumu maisi. Nosūti 37 kalnā. Cik paliek pakājē?'),55,[65,54],hint.subtract,text('92 − 37 = 55 bags stay at the base.', '92 − 37 = 55 maisi paliek pakājē.')),
  task('balance','equality',text('After the next load, 28 of the 55 bags remain. How many went uphill?', 'Pēc nākamās kravas no 55 maisiem paliek 28. Cik nosūtīja kalnā?'),{leftDisplay:'55 − ?',rightValue:28,choices:['27','23','37']},hint.subtract,text('55 − 27 = 28. The second load has 27 bags.', '55 − 27 = 28. Otrajā kravā ir 27 maisi.'),{correctIndex:0,helpTemplate:'subtraction'}),
  task('fix_mistake','subtraction',text('Use 19 of the last 28 bags for the rescue team. Repair the reserve count.', 'Glābējiem izmanto 19 no pēdējiem 28 maisiem. Izlabo rezerves skaitu.'),{wrongWork:['28 − 19 = 11'],choices:['28 − 19 = 9','28 − 19 = 11','28 − 19 = 19']},hint.subtract,text('28 − 19 = 9. The reserve is safe!', '28 − 19 = 9. Rezerve ir drošībā!'),{correctIndex:0}),
]);
finale('medium','multiplication','theatre',text('The firefly theatre','Jāņtārpiņu teātris'),text('Arrange the audience, extend the rows and prepare the final performance.', 'Sakārto skatītāju vietas, pagarini rindas un sagatavo izrādi.'),[
  choice('multiplication',text('The theatre has 7 rows of 8 seats. How many fireflies can sit?', 'Teātrī ir 7 rindas pa 8 vietām. Cik jāņtārpiņu var apsēsties?'),56,[54,15],hint.groups,text('7 × 8 = 56 seats are ready.', '7 × 8 = 56 vietas ir gatavas.')),
  task('balance','equality',text('Keep 7 equal rows but make 63 seats. How many seats go in each row?', 'Saglabā 7 vienādas rindas, bet izveido 63 vietas. Cik vietu katrā rindā?'),{leftDisplay:'7 × ?',rightValue:63,choices:['9','8','10']},hint.groups,text('7 × 9 = 63. Each row now has 9 seats.', '7 × 9 = 63. Katrā rindā tagad ir 9 vietas.'),{correctIndex:0,helpTemplate:'multiplication'}),
  task('function_machine','multiplication',text('Add an eighth row of 9. Which rule turns 9 into the total number of seats?', 'Pievieno astoto rindu ar 9 vietām. Kurš likums pārvērš 9 par visu vietu skaitu?'),{input:9,output:72,choices:['×8','+8','×7']},hint.groups,text('9 × 8 = 72. The theatre is ready!', '9 × 8 = 72. Teātris ir gatavs!'),{correctIndex:0}),
]);
finale('medium','fractions','fountain',text('Restore the mosaic fountain','Atjauno mozaīkas strūklaku'),text('Lay the blue mosaic, replace its tiles and finish the matching border.', 'Ieklāj zilo mozaīku, nomaini flīzes un pabeidz atbilstošu apmali.'),[
  task('fraction_build','fractions',text('The fountain has 8 equal mosaic sections. Color 3/8 blue.', 'Strūklakai ir 8 vienādi mozaīkas laukumi. Iekrāso 3/8 zilus.'),{numerator:3,denominator:8},hint.fractions,text('3 of 8 equal sections are blue.', '3 no 8 vienādiem laukumiem ir zili.')),
  task('fraction_equivalent','fractions',text('Split every section in two. Which fraction still shows the blue 3/8?', 'Sadali katru laukumu divās daļās. Kura daļa joprojām attēlo zilās 3/8?'),{numerator:3,denominator:8,choices:['6/16','3/16','6/8']},hint.fractions,text('3/8 = 6/16. The blue area stays the same.', '3/8 = 6/16. Zilais laukums nemainās.'),{correctIndex:0}),
  task('fraction_match','fractions',text('Match the blue 3/8 and the remaining 5/8 to their models.', 'Savieno zilās 3/8 un atlikušās 5/8 ar to modeļiem.'),{pairs:[{numerator:3,denominator:8,visual:'grid'},{numerator:5,denominator:8,visual:'pie'}]},hint.fractions,text('3/8 and 5/8 make the whole mosaic. The fountain flows!', '3/8 un 5/8 veido visu mozaīku. Strūklaka plūst!')),
]);
finale('hard','operations','observatory',text('Restart the observatory','Iedarbini observatoriju'),text('Route the power, align the telescope and tune the star tracker.', 'Novadi enerģiju, noregulē teleskopu un noskaņo zvaigžņu sekotāju.'),[
  task('operation_path','operations',text('The power starts at 84. Use 7, then 9, to reach 21.', 'Enerģija sākas ar 84. Izmanto 7 un tad 9, lai sasniegtu 21.'),{start:84,target:21,steps:[{operand:7,operator:'÷'},{operand:9,operator:'+'}]},hint.route,text('84 ÷ 7 + 9 = 21. The power is connected.', '84 ÷ 7 + 9 = 21. Enerģija ir pieslēgta.')),
  task('target_build','operations',text('Align the telescope at 27. Keep 21, 3, 2 in order and choose the operations.', 'Noregulē teleskopu pie 27. Saglabā 21, 3, 2 secību un izvēlies darbības.'),{numbers:[21,3,2],target:27,solution:['+','×']},text('Multiplication happens before addition.', 'Reizināšanu veic pirms saskaitīšanas.'),text('21 + 3 × 2 = 27. The telescope is aligned.', '21 + 3 × 2 = 27. Teleskops ir noregulēts.')),
  task('function_machine','operations',text('The tracker turns 27 into 79. Which rule fits?', 'Sekotājs pārvērš 27 par 79. Kurš likums der?'),{input:27,output:79,choices:['×3−2','×3+2','+3']},hint.route,text('27 × 3 − 2 = 79. The stars are in view!', '27 × 3 − 2 = 79. Zvaigznes ir redzamas!'),{correctIndex:0}),
]);
finale('hard','patterns','signal',text('The distant signal tower','Tālais signālu tornis'),text('Decode the signal, tune the amplifier and send the final transmission.', 'Atšifrē signālu, noskaņo pastiprinātāju un nosūti pēdējo pārraidi.'),[
  task('pattern_next','patterns',text('The signal pulses 3, 6, 12, 24. Find the next pulse.', 'Signāls pulsē 3, 6, 12, 24. Atrodi nākamo impulsu.'),{sequence:[3,6,12,24],choices:['48','36','25']},text('Look for a multiplication rule between neighboring pulses.', 'Meklē reizināšanas likumu starp blakus impulsiem.'),text('24 × 2 = 48. The signal is decoded.', '24 × 2 = 48. Signāls ir atšifrēts.'),{correctIndex:0}),
  task('function_machine','patterns',text('The amplifier changes 48 into 80. Which rule fits?', 'Pastiprinātājs pārvērš 48 par 80. Kurš likums der?'),{input:48,output:80,choices:['+32','×2','+24']},hint.route,text('48 + 32 = 80. The amplifier works.', '48 + 32 = 80. Pastiprinātājs darbojas.'),{correctIndex:0}),
  choice('patterns',text('Complete the transmission code. Which value is missing? 80, 40, ?, 10, 5.', 'Pabeidz pārraides kodu. Kurš skaitlis trūkst? 80, 40, ?, 10, 5.'),20,[30,40],text('Look for a rule that fits all the code values.', 'Meklē likumu, kas der visiem koda skaitļiem.'),text('80, 40, 20, 10, 5. Each value is half the one before. The message is ready!', '80, 40, 20, 10, 5. Katrs skaitlis ir puse no iepriekšējā. Ziņa ir gatava!')),
]);
finale('hard','measurement','shelter',text('Build the rooftop shelter','Uzbūvē jumta patvērumu'),text('Measure the roof, scale the delivery and estimate the spare supplies.', 'Izmēri jumtu, pārrēķini piegādi un aptuveni novērtē rezerves krājumus.'),[
  choice('multiplication',text('The shelter roof is 9 tiles long and 7 tiles wide. How many square tiles cover it?', 'Patvēruma jumts ir 9 flīzes garš un 7 flīzes plats. Cik kvadrātveida flīžu to nosedz?'),63,[32,16],hint.groups,text('9 × 7 = 63 square tiles cover the roof.', '9 × 7 = 63 kvadrātveida flīzes nosedz jumtu.')),
  choice('operations',text('7 equal crates hold 63 tiles. How many tiles will 9 crates hold?', '7 vienādās kastēs ir 63 flīzes. Cik flīžu būs 9 kastēs?'),81,[65,126],text('Find tiles per crate, then scale to nine crates.', 'Atrodi flīžu skaitu vienā kastē un pārrēķini deviņām.'),text('63 ÷ 7 × 9 = 81 tiles arrive.', '63 ÷ 7 × 9 = 81 flīze pienāk.'),'rate'),
  task('estimate','estimation',text('81 tiles arrive, along with 27 spares. What is the total to the nearest ten?', 'Pienāk 81 flīze un 27 rezerves flīzes. Kāds ir kopskaits, noapaļojot līdz tuvākajam desmitam?'),{en:{expression:'81 + 27',choices:['About 110','About 90','About 150']},lv:{expression:'81 + 27',choices:['Aptuveni 110','Aptuveni 90','Aptuveni 150']}},text('Round each delivery separately before adding.', 'Pirms saskaitīšanas noapaļo katru piegādi atsevišķi.'),text('80 + 30 = 110. The shelter has enough supplies!', '80 + 30 = 110. Patvērumam pietiek krājumu!'),{correctIndex:0}),
]);
finale('hard','logic','vault',text('The archive vault','Arhīva glabātava'),text('Solve the door clues, check the drawer labels and arrange the final code.', 'Atrisini durvju norādes, pārbaudi atvilktņu etiķetes un sakārto gala kodu.'),[
  choice('logic',text('The door number is even, greater than 40, less than 46 and divisible by 3. Which is it?', 'Durvju numurs ir pāra, lielāks par 40, mazāks par 46 un dalās ar 3. Kurš tas ir?'),42,[44,46],text('A number must satisfy every clue.', 'Skaitlim jāatbilst visām norādēm.'),text('42 is even, lies between 40 and 46, and 42 ÷ 3 = 14.', '42 ir pāra, atrodas starp 40 un 46, un 42 ÷ 3 = 14.'),'number_range'),
  task('true_false','division',text('There are 42 records in 6 equal drawers. Check the claim of 7 records per drawer.', '42 ieraksti sadalīti 6 vienādās atvilktnēs. Pārbaudi apgalvojumu par 7 ierakstiem katrā.'),{statement:'42 ÷ 6 = 7'},text('Multiply the claimed amount by the number of drawers.', 'Reizini piedāvāto daudzumu ar atvilktņu skaitu.'),text('True. 6 × 7 = 42. The drawer labels are correct.', 'Pareizi. 6 × 7 = 42. Atvilktņu etiķetes ir pareizas.'),{isTrue:true,helpTemplate:'division'}),
  task('order_numbers','comparison',text('The final code uses increasing multiples of 7. Arrange the code tiles.', 'Gala kods izmanto augošus skaitļa 7 daudzkārtņus. Sakārto koda kartītes.'),{numbers:[21,7,28,14],correctOrder:[7,14,21,28]},text('Start at the smallest multiple, then keep the same gap.', 'Sāc ar mazāko daudzkārtni un saglabā vienādu soli.'),text('7, 14, 21, 28. The archive opens!', '7, 14, 21, 28. Arhīvs atveras!')),
]);
for (const [lessonId,target,numbers,title] of [
  [easyAdd,10,[1,2,3,7,8,9],text('The ten treasure hunt','Desmita dārgumu medības')],
  [mediumAdd,24,[5,7,9,11,13,15,17,19],text('The workshop pair collection','Darbnīcas pāru kolekcija')],
  [hardLogic,50,[8,13,19,25,31,37,42,45,50,6],text('The vault pair search','Glabātavas pāru meklējumi')],
]) special(lessonId,'pair-hunt','challenge',title,text('One answer is not enough. Collect every different pair that reaches the target. This side activity is optional.', 'Ar vienu atbildi nepietiek. Savāc visus atšķirīgos pārus, kas sasniedz mērķi. Šī papildu nodarbe ir pēc izvēles.'),[
  task('find_all_pairs','mental_math',text(`Find every pair adding to ${target}. A tile may appear in different pairs.`, `Atrodi visus pārus, kuru summa ir ${target}. Kartīti drīkst izmantot dažādos pāros.`),{numbers,target},text('Work through one tile at a time and look for its partner.', 'Izskati kartītes pa vienai un meklē to pāriniekus.'),text('You found every pair. Reversing a pair does not make a new one.', 'Tu atradi visus pārus. Apgriezta secība neveido jaunu pāri.'),{helpTemplate:'all_pairs'}),
]);
function challenge(difficulty, topicId, slug, title, description, spec) {
  const last = lessons.filter(l => l.difficulty === difficulty && l.topicId === topicId).at(-1);
  special(last.id, slug, 'challenge', title, description, [spec]);
}
challenge('easy','numbers','number-baskets',text('The number baskets','Skaitļu grozi'),text('Sort every tile into a basket. You can move a tile again before checking.', 'Sašķiro visas kartītes grozos. Pirms pārbaudes vari tās pārvietot vēlreiz.'),
  task('sort_buckets','comparison',text('Pack numbers below 10 in one basket and numbers from 10 upward in the other.', 'Liec skaitļus zem 10 vienā grozā, bet skaitļus no 10 uz augšu otrā.'),{rule:'range',numbers:[12,3,10,8,19,6],boundary:10},text('Compare each number with ten. Ten belongs with the bigger numbers.', 'Salīdzini katru skaitli ar desmit. Desmit pieder pie lielākajiem skaitļiem.'),text('3, 8 and 6 are below 10. 12, 10 and 19 are at least 10.', '3, 8 un 6 ir zem 10. 12, 10 un 19 ir vismaz 10.')));
challenge('medium','fractions','fraction-post',text('The fraction post office','Daļu pasts'),text('Deliver six fraction letters to the addresses with the same value.', 'Nogādā sešas daļu vēstules adresēs ar tādu pašu vērtību.'),
  task('sort_buckets','fractions',text('Sort every fraction by value: one half or three quarters.', 'Sašķiro katru daļu pēc vērtības: viena puse vai trīs ceturtdaļas.'),{rule:'fractions',fractions:[[2,4],[6,8],[3,6],[9,12],[5,10],[12,16]],targets:[[1,2],[3,4]]},text('Reduce the fraction, or split the target into smaller equal pieces.', 'Saīsini daļu vai sadali mērķa daļu sīkākās vienādās daļās.'),text('2/4, 3/6 and 5/10 equal 1/2. 6/8, 9/12 and 12/16 equal 3/4.', '2/4, 3/6 un 5/10 ir 1/2. 6/8, 9/12 un 12/16 ir 3/4.'),{helpTemplate:'fraction_sort'}));
for (const [difficulty,topicId,slug,title,sequence,tiles,solution,description,explanation] of [
  ['easy','patterns','stepping-stones',text('Mend the stepping stones','Salabo lēcienu akmeņus'),[5,null,15,null,25],[20,12,10,30],[10,20],text('Two stepping stones are missing. Repair the whole path and leave the spare tiles.', 'Trūkst divu lēcienu akmeņu. Salabo visu ceļu un atstāj liekās kartītes.'),text('5, 10, 15, 20, 25. Each step adds 5.', '5, 10, 15, 20, 25. Katrā solī pieskaita 5.')],
  ['medium','multiplication','seat-labels',text('The missing seat labels','Trūkstošās vietu etiķetes'),[7,null,21,null,35],[28,20,14,42],[14,28],text('Label the ends of five rows of seven seats. Two labels need replacing.', 'Atzīmē piecu rindu galus, katrā pa septiņām vietām. Divas etiķetes jānomaina.'),text('7, 14, 21, 28, 35 are the totals after each row of seven.', '7, 14, 21, 28, 35 ir kopējais vietu skaits pēc katras septiņu vietu rindas.')],
  ['hard','patterns','signal-gaps',text('The broken signal strip','Pārrautā signālu virkne'),[3,null,27,null,243],[54,81,9,108],[9,81],text('Two signals are missing. Restore the pattern and ignore the decoys.', 'Trūkst divu signālu. Atjauno virkni un ignorē mānekļus.'),text('3, 9, 27, 81, 243. Every step multiplies by 3.', '3, 9, 27, 81, 243. Katrā solī reizina ar 3.')],
]) challenge(difficulty,topicId,slug,title,description,task('repair_pattern',topicId==='multiplication'?'multiplication':'patterns',text('Fill both gaps. Use each tile at most once; some tiles stay unused.', 'Aizpildi abas vietas. Katru kartīti izmanto ne vairāk kā vienreiz; dažas paliek neizmantotas.'),{sequence,tiles,solution},text('Find one rule that fits every neighboring step, including the filled gaps.', 'Atrodi vienu likumu, kas der visiem blakus soļiem, arī aizpildītajām vietām.'),explanation));
challenge('medium','operations','courier-maze',text('The courier maze','Kurjera labirints'),text('Choose your own route through a grid. Every visited square changes your number.', 'Izvēlies savu ceļu pa režģi. Katrs apmeklētais lauciņš maina tavu skaitli.'),
  task('route_grid','operations',text('Start with 6. Reach the bottom-right exit with 8 in exactly 4 moves.', 'Sāc ar 6. Sasniedz apakšējo labo izeju ar 8 tieši 4 soļos.'),{columns:3,start:6,target:8,moves:4,cells:[null,{operator:'+',operand:4},{operator:'×',operand:2},{operator:'÷',operand:2},{operator:'-',operand:3},{operator:'÷',operand:4},{operator:'+',operand:5},{operator:'-',operand:1},{operator:'+',operand:3}]},text('Try the top edge first. Undo a step if the route cannot reach the goal.', 'Vispirms izmēģini augšējo malu. Atsauc soli, ja ceļš nevar sasniegt mērķi.'),text('One route is 6 → 10 → 20 → 5 → 8. Apply each square when you enter it.', 'Viens ceļš ir 6 → 10 → 20 → 5 → 8. Izpildi katra lauciņa darbību, tajā ieejot.')));
challenge('hard','operations','power-detour',text('The power-grid detour','Enerģijas režģa līkums'),text('Find a six-move route through the power grid without reusing squares.', 'Atrodi sešu soļu ceļu pa enerģijas režģi, neatkārtojot lauciņus.'),
  task('route_grid','operations',text('Start with 24. Reach the bottom-right exit with 18 in exactly 6 moves.', 'Sāc ar 24. Sasniedz apakšējo labo izeju ar 18 tieši 6 soļos.'),{columns:3,start:24,target:18,moves:6,cells:[null,{operator:'÷',operand:3},{operator:'×',operand:4},{operator:'-',operand:6},{operator:'+',operand:5},{operator:'-',operand:7},{operator:'÷',operand:2},{operator:'×',operand:3},{operator:'÷',operand:5}]},text('Work backward from the exit: before dividing by 5, you need 90.', 'Domā atpakaļ no izejas: pirms dalīšanas ar 5 vajag 90.'),text('24 → 8 → 32 → 25 → 30 → 90 → 18 uses six moves and no square twice.', '24 → 8 → 32 → 25 → 30 → 90 → 18 izmanto sešus soļus un neatkārto lauciņus.')));
challenge('hard','percentages','camp-budget',text('Plan the camp supplies','Izplāno nometnes krājumus'),text('Compare discounts and choose a shopping plan. More than one plan can work.', 'Salīdzini atlaides un izvēlies iepirkumu plānu. Var derēt vairāki plāni.'),
  task('budget_plan','fractions',text('Use a pretend budget of 100. Choose exactly two supplies and leave 20 after discounts.', 'Izmanto izdomātu 100 monētu budžetu. Izvēlies tieši divus krājumus un pēc atlaidēm atstāj 20.'),{en:{budget:100,remaining:20,pickCount:2,items:[{label:'Lantern',price:40,discountPercent:25},{label:'Blanket',price:50,discountPercent:0},{label:'Tent',price:80,discountPercent:25},{label:'Rope',price:25,discountPercent:20}]},lv:{budget:100,remaining:20,pickCount:2,items:[{label:'Laterna',price:40,discountPercent:25},{label:'Sega',price:50,discountPercent:0},{label:'Telts',price:80,discountPercent:25},{label:'Virve',price:25,discountPercent:20}]}},text('Find each discounted price first. Your two items must cost 80 together.', 'Vispirms atrodi katru cenu pēc atlaides. Abiem priekšmetiem kopā jāmaksā 80.'),text('The lantern costs 30 and the blanket 50. The tent costs 60 and the rope 20. Either pair leaves 20.', 'Laterna maksā 30 un sega 50. Telts maksā 60 un virve 20. Abi pāri atstāj 20.')));
// Optional side activities come before the finale, which always ends the topic.
for (const difficulty of ['easy','medium','hard']) for (const topic of topics) {
  const topicLessons = lessons.filter(l => l.difficulty === difficulty && l.topicId === topic.id);
  if (!topicLessons.length) continue;
  const bosses = topicLessons.flatMap(l => l.levels.filter(level => level.kind === 'boss'));
  assert.equal(bosses.length, 1, `${difficulty}/${topic.id} needs one unique boss`);
  const last = topicLessons.at(-1);
  assert.ok(last.levels.includes(bosses[0]), `${difficulty}/${topic.id} boss must be in its final lesson`);
  last.levels = [...last.levels.filter(level => level.kind !== 'boss'), bosses[0]];
}
assert.equal(new Set(lessons.map(lesson => lesson.id)).size, lessons.length, "Lesson IDs must be unique");
for (const locale of ['en','lv']) for (const difficulty of ['easy','medium','hard']) {
  const list=puzzles[locale][difficulty];
  const file=`assets/puzzles/${locale==='lv'?'lv/':''}${difficulty}.json`;
  writeGenerated(file, list);
}
writeGenerated('data/puzzle-curriculum.json', {version:2,topics,lessons});
console.log(`${process.argv.includes('--check') ? 'Verified generated' : 'Authored'} ${lessons.length} lessons and ${Object.values(puzzles.en).flat().length} puzzles per language.`);
