/** Three practical cat plans, using the same ten-step paths and final timer as other lessons. */
import fs from 'node:fs';
const T = (en, lv, ru) => ({ en, lv, ru });
const locales = ['en', 'lv', 'ru'];
const itemNames = Object.fromEntries(locales.map(locale => [locale, JSON.parse(fs.readFileSync(new URL(`../../locales/${locale}.json`, import.meta.url))).everyday.shopItems]));
const tiers = ['easy', 'medium', 'hard'];
const clock = minutes => `${Math.floor(minutes / 60)}`.padStart(2, '0') + ':' + `${minutes % 60}`.padStart(2, '0');
const number = (value, locale) => String(value).replace('.', locale === 'en' ? '.' : ',');
const plans = [
  { id: 'picnic', title: T('Prepare a picnic', 'Sagatavo pikniku', 'Подготовь пикник'),
    description: T('Count the guests, pack supplies and choose a time for the cat picnic.', 'Saskaiti viesus, sagatavo krājumus un izvēlies kaķu piknika laiku.', 'Посчитай гостей, собери припасы и выбери время для кошачьего пикника.'),
    completion: T('The picnic is ready. There is a place and water for every cat.', 'Pikniks ir gatavs. Katram kaķim ir vieta un ūdens.', 'Пикник готов. Для каждого кота есть место и вода.'),
    items: ['apple', 'cookie'], purchase: T('Buy 1 apple and 1 cookie', 'Nopērc 1 ābolu un 1 cepumu', 'Купи 1 яблоко и 1 печенье'),
    buyMany: T('How many apples can you buy?', 'Cik ābolus vari nopirkt?', 'Сколько яблок можно купить?') },
  { id: 'reading-corner', title: T('Make a reading corner', 'Iekārto lasīšanas stūrīti', 'Устрой уголок для чтения'),
    description: T('Arrange places, choose books and plan a quiet reading time with the cats.', 'Iekārto vietas, izvēlies grāmatas un plāno mierīgu lasīšanas laiku ar kaķiem.', 'Подготовь места, выбери книги и запланируй тихое чтение с котами.'),
    completion: T('The reading corner is ready. The cats can settle beside the books.', 'Lasīšanas stūrītis ir gatavs. Kaķi var iekārtoties blakus grāmatām.', 'Уголок для чтения готов. Коты могут устроиться рядом с книгами.'),
    items: ['book', 'plant'], purchase: T('Buy 1 book and 1 plant', 'Nopērc 1 grāmatu un 1 augu', 'Купи 1 книгу и 1 растение'),
    buyMany: T('How many books can you buy?', 'Cik grāmatas vari nopirkt?', 'Сколько книг можно купить?') },
  { id: 'cat-party', title: T('Plan a cat party', 'Izplāno kaķu ballīti', 'Спланируй кошачью вечеринку'),
    description: T('Invite the cats, plan the decorations and get everything ready on time.', 'Ielūdz kaķus, plāno rotājumus un visu sagatavo laikus.', 'Пригласи котов, спланируй украшения и подготовь всё вовремя.'),
    completion: T('The party is ready. The cats have places, water and decorations.', 'Ballīte ir gatava. Kaķiem ir vietas, ūdens un rotājumi.', 'Вечеринка готова. Для котов подготовлены места, вода и украшения.'),
    items: ['balloon', 'cupcake'], purchase: T('Buy 1 balloon and 1 cupcake', 'Nopērc 1 balonu un 1 kēksiņu', 'Купи 1 шарик и 1 кекс'),
    buyMany: T('How many balloons can you buy?', 'Cik balonus vari nopirkt?', 'Сколько шариков можно купить?') },
];
const intro = (plan, text) => Object.fromEntries(locales.map(locale => [locale, `${plan.title[locale]}. ${text[locale]}`]));

function task(plan, tier, slot, variant) {
  const n = variant + 1, scale = [1, 2, 5][tier];
  let model, question, answer, hint, explanation, options;
  if (slot === 0 || slot === 5) {
    const values = [n + 2, n + 4, n + 1].map(v => v * scale);
    const total = slot === 0;
    model = { kind: 'bars', task: total ? 'total' : 'difference', values, step: scale, index: 0, subject: 'cats',
      label: T(`Cats in groups A, B and C: ${values.join(', ')}.`, `Kaķi grupās A, B un C: ${values.join(', ')}.`, `Коты в группах A, B и C: ${values.join(', ')}.`) };
    answer = total ? values.reduce((a, b) => a + b) : values[1] - values[0];
    question = total ? T('Three groups of cats are coming. How many places do they need altogether?', 'Ieradīsies trīs kaķu grupas. Cik vietu kopā vajadzēs?', 'Придут три группы котов. Сколько мест им нужно всего?')
      : T('How many more places does group B need than group A?', 'Par cik vairāk vietu vajag B grupai nekā A grupai?', 'На сколько больше мест нужно группе B, чем группе A?');
    hint = total ? T('Add all three bars.', 'Saskaiti visus trīs stabiņus.', 'Сложи значения всех трёх столбцов.')
      : T('Subtract the smaller group from the larger group.', 'No lielākās grupas atņem mazāko.', 'Вычти меньшую группу из большей.');
    const work = total ? `${values.join(' + ')} = ${answer}` : `${values[1]} − ${values[0]} = ${answer}`;
    explanation = T(`${work} places.`, `${work} vietas.`, `${work} мест.`);
  } else if ([1, 6, 9].includes(slot)) {
    const price = (n + 1) * 100, second = (n + 2) * 100, paid = price * (tier + 3) + 100;
    const discount = tier === 2 && slot === 1 ? 20 : 0;
    model = { kind: 'money', task: slot === 9 ? 'afford' : slot === 6 ? 'change' : 'total',
      prices: slot === 9 ? [price] : [price, second], quantities: slot === 9 ? [1] : [1, 1], paid, discount, unit: 'euros', items: slot === 9 ? plan.items.slice(0, 1) : plan.items };
    model.label = Object.fromEntries(locales.map(locale => [locale,
      model.items.map((item, i) => `${itemNames[locale][item]}: €${model.prices[i] / 100}.`).join(' ')
      + (slot === 1 ? '' : ` ${T('Budget', 'Budžets', 'Бюджет')[locale]}: €${paid / 100}.`)
      + (discount ? ` ${T('Discount', 'Atlaide', 'Скидка')[locale]}: ${discount}%.` : '')]));
    answer = slot === 9 ? Math.floor(paid / price) : slot === 6 ? (paid - price - second) / 100 : (price + second) * (1 - discount / 100) / 100;
    question = slot === 9 ? T(`You have €${paid / 100}. ${plan.buyMany.en}`, `Tev ir €${paid / 100}. ${plan.buyMany.lv}`, `У тебя €${paid / 100}. ${plan.buyMany.ru}`)
      : slot === 6 ? T(`${plan.purchase.en} and pay €${paid / 100}. How many euros should you get back?`, `${plan.purchase.lv} un samaksā €${paid / 100}. Cik eiro saņemsi atlikumā?`, `${plan.purchase.ru} и заплати €${paid / 100}. Сколько евро сдачи ты получишь?`)
      : T(`${plan.purchase.en}${discount ? ` with ${discount}% off` : ''}. What is the total cost in euros?`, `${plan.purchase.lv}${discount ? ` ar ${discount}% atlaidi` : ''}. Cik eiro tie maksā kopā?`, `${plan.purchase.ru}${discount ? ` со скидкой ${discount}%` : ''}. Сколько евро они стоят вместе?`);
    hint = slot === 9 ? T('Count how many times the price fits into your budget.', 'Saskaiti, cik reizes cena ietilpst tavā budžetā.', 'Посчитай, сколько раз цена помещается в твой бюджет.')
      : slot === 6 ? T('Add the two prices. Subtract that total from the amount you pay.', 'Saskaiti abas cenas. Atņem kopējo cenu no samaksātās summas.', 'Сложи две цены. Вычти общую стоимость из суммы, которую ты платишь.')
      : discount ? T(`Add the two prices, then take ${discount}% off the total.`, `Saskaiti abas cenas, tad atņem ${discount}% no kopsummas.`, `Сложи две цены, затем вычти ${discount}% от общей суммы.`)
      : T('Add the price of the first item to the price of the second item.', 'Pieskaiti pirmā priekšmeta cenai otrā priekšmeta cenu.', 'Прибавь к цене первого предмета цену второго.');
    const work = slot === 9 ? `${paid / 100} ÷ ${price / 100}` : slot === 6 ? `${paid / 100} − (${price / 100} + ${second / 100})` : `(${price / 100} + ${second / 100})${discount ? ' × 0.8' : ''}`;
    explanation = T(`${work}: ${answer}${slot === 9 ? ' whole items fit in the budget' : ' euros'}.`, `${work.replace('0.8', '0,8')}: ${number(answer, 'lv')}${slot === 9 ? ' veseli priekšmeti ietilpst budžetā' : ' eiro'}.`, `${work.replace('0.8', '0,8')}: ${number(answer, 'ru')}${slot === 9 ? ' целых предметов можно купить' : ' евро'}.`);
  } else if (slot === 2 || slot === 7) {
    const start = 9 * 60 + n * 60, duration = [60, 35, 85][tier];
    const backward = slot === 7;
    model = { kind: 'clock', task: backward ? 'start' : 'finish', minutes: backward ? start + duration : start, duration, analog: true,
      label: T(`Clock: ${clock(backward ? start + duration : start)}. Preparation takes ${duration} minutes.`, `Pulkstenis: ${clock(backward ? start + duration : start)}. Sagatavošanās ilgst ${duration} minūtes.`, `На часах ${clock(backward ? start + duration : start)}. Подготовка занимает ${duration} минут.`) };
    answer = clock(backward ? start : start + duration);
    question = backward ? T(`The cats arrive at the time shown. Preparation takes ${duration} minutes. When should you start?`, `Kaķi ieradīsies parādītajā laikā. Sagatavošanās ilgst ${duration} minūtes. Cikos jāsāk?`, `Коты придут в указанное время. Подготовка занимает ${duration} минут. Когда нужно начать?`)
      : T(`Start preparing at the time shown. You need ${duration} minutes. At what time will everything be ready?`, `Sāc gatavoties parādītajā laikā. Tev vajag ${duration} minūtes. Cikos viss būs gatavs?`, `Начни подготовку в указанное время. Тебе нужно ${duration} минут. Когда всё будет готово?`);
    hint = backward ? T('Count backward by the preparation time.', 'Skaiti atpakaļ par sagatavošanās ilgumu.', 'Отсчитай время подготовки назад.')
      : T('Count forward by the preparation time.', 'Skaiti uz priekšu par sagatavošanās ilgumu.', 'Отсчитай время подготовки вперёд.');
    const work = `${clock(model.minutes)} ${backward ? '−' : '+'} ${duration}`;
    explanation = T(`${work} minutes gives ${answer}.`, `${work} minūtes dod ${answer}.`, `${work} минут даёт ${answer}.`);
    options = [answer, clock((backward ? start : start + duration) + 30), clock((backward ? start : start + duration) + 60)];
  } else if (slot === 3) {
    const sides = tier === 0 ? [4, 4] : tier === 1 ? [3, 4, 3] : [6, 4, 6];
    // A different number of mats gives the worked example its own givens.
    if (variant >= 3) sides.push(4);
    model = { kind: 'shapes', task: 'corners', sides, rectangle: false,
      label: T(`Mats for the cats. Sides on each mat: ${sides.join(', ')}.`, `Paklājiņi kaķiem. Malas katram paklājiņam: ${sides.join(', ')}.`, `Коврики для котов. Стороны каждого коврика: ${sides.join(', ')}.`) };
    answer = sides.reduce((a, b) => a + b);
    question = T('Put one ribbon at every corner of these mats. How many ribbons are needed?', 'Pie katra šo paklājiņu stūra pieliec lenti. Cik lenšu vajag?', 'Положи ленту у каждого угла этих ковриков. Сколько лент нужно?');
    hint = T('Count the corners of every mat, then add them.', 'Saskaiti katra paklājiņa stūrus un saskaiti tos kopā.', 'Посчитай углы каждого коврика, затем сложи их.');
    explanation = T(`${sides.join(' + ')} = ${answer} ribbons.`, `${sides.join(' + ')} = ${answer} lentes.`, `${sides.join(' + ')} = ${answer} лент.`);
  } else {
    const unit = 'ml', portion = tier === 0 ? 100 : 125;
    const amount = (n + 3) * portion;
    const total = slot === 4;
    model = { kind: 'capacity', task: total ? 'total' : 'servings', amounts: total ? [amount, portion * 2] : [amount],
      capacities: total ? [amount + portion, portion * 4] : [amount + portion], portion, unit,
      label: T(`Fresh water for the cats: ${total ? `${amount}, ${portion * 2}` : amount} ml.`, `Svaigs ūdens kaķiem: ${total ? `${amount}, ${portion * 2}` : amount} ml.`, `Свежая вода для котов: ${total ? `${amount}, ${portion * 2}` : amount} мл.`) };
    answer = total ? amount + portion * 2 : amount / portion;
    question = total ? T(`How much water is packed in both containers, in ${unit}?`, `Cik ūdens ir abos traukos kopā, ${unit}?`, `Сколько воды в обоих сосудах вместе, ${unit === 'l' ? 'л' : 'мл'}?`)
      : T(`Each water station needs ${portion} ${unit}. How many stations can you fill?`, `Katrai ūdens vietai vajag ${portion} ${unit}. Cik vietas vari piepildīt?`, `На каждое место с водой нужно ${portion} ${unit === 'l' ? 'л' : 'мл'}. Сколько мест можно наполнить?`);
    hint = total ? T('Add the amounts of water, not the container capacities.', 'Saskaiti ūdens daudzumus, nevis trauku ietilpības.', 'Сложи количество воды, а не вместимость сосудов.')
      : T('Count equal portions until the water is used up.', 'Skaiti vienādas porcijas, līdz ūdens izlietots.', 'Отсчитывай равные порции, пока вода не закончится.');
    const work = total ? `${amount} + ${portion * 2} = ${answer}` : `${amount} ÷ ${portion} = ${answer}`;
    explanation = T(`${work}${total ? ` ${unit} of water` : ' water stations'}.`, `${work}${total ? ` ${unit} ūdens` : ' ūdens vietas'}.`, `${work}${total ? ` ${unit === 'l' ? 'л' : 'мл'} воды` : ' мест с водой'}.`);
  }
  return { model, question: intro(plan, question), answer, hint, explanation, options };
}
const localizeModel = (model, locale) => ({ ...model, label: model.label[locale] });
function choices(spec, slot, locale) {
  const raw = spec.options ?? [spec.answer, spec.answer + 1, spec.answer + 2];
  const offset = slot % 3, rotated = [...raw.slice(offset), ...raw.slice(0, offset)];
  return { choices: rotated.map(value => typeof value === 'number' ? number(value, locale) : value), correctIndex: rotated.indexOf(spec.answer) };
}
export function appendCatPlans({ topics, lessons, puzzles, pathExtras }) {
  const description = T('Use maths to prepare something for the cats.', 'Izmanto matemātiku, lai kaut ko sagatavotu kaķiem.', 'Используй математику, чтобы подготовить что-нибудь для котов.');
  topics.push({ id: 'cat-plans', title: T('Cat plans', 'Kaķu plāni', 'Планы для котов'), description, icon: 'cat' });
  const reviews = {};
  for (const [tier, difficulty] of tiers.entries()) for (const [index, plan] of plans.entries()) {
    const id = `${difficulty}-cat-plans-${plan.id}`, skillId = `${difficulty}.cat-plans.${plan.id}`;
    const prerequisites = index ? [`${difficulty}.cat-plans.${plans[index - 1].id}`] : [];
    const lesson = { format: 'path', id, difficulty, topicId: 'cat-plans', title: plan.title, description: plan.description,
      completion: plan.completion, skillId, prerequisiteSkillIds: prerequisites, levels: [] };
    const ids = [];
    for (let slot = 0; slot < 10; slot++) {
      const spec = task(plan, tier, slot, index), example = task(plan, tier, slot, index + 3);
      const puzzleId = `v2-${id}-${slot + 1}`;
      for (const locale of locales) puzzles[locale][difficulty].push({ id: puzzleId, difficulty, type: 'multiple_choice', topic: 'cat-plans',
        ageRange: [[5, 7], [7, 10], [10, 12]][tier], question: spec.question[locale], hint: spec.hint[locale], explanation: spec.explanation[locale], ...choices(spec, slot, locale),
        everyday: { model: localizeModel(spec.model, locale), example: { model: localizeModel(example.model, locale), question: example.question[locale], explanation: `${example.hint[locale]}\n\n${example.explanation[locale]}` } },
        learning: { skillId, prerequisiteSkillIds: prerequisites, role: slot >= 8 ? 'review' : slot >= 4 ? 'application' : 'practice', representation: spec.model.kind, reasoningSteps: tier === 2 ? 2 : 1 } });
      ids.push(puzzleId);
      if (slot < 8) lesson.levels.push({ id: `${id}-step-${slot + 1}`, kind: slot === 7 ? 'challenge' : 'practice', title: plan.title, description: plan.description,
        puzzleIds: [puzzleId], ...(slot === 7 ? { timeLimitSeconds: [180, 240, 300][tier] } : {}) });
    }
    pathExtras[id] = ids.slice(8); lessons.push(lesson);
    reviews[id] = Array.from({ length: 12 }, (_, day) => {
      const spec = task(plan, tier, day % 2 ? 6 : 8, index + 3 + day);
      const versions = Object.fromEntries(locales.map(locale => [locale, choices(spec, day, locale)]));
      return { prompt: spec.question, explanation: spec.explanation, choices: versions.en.choices.map((_, i) => T(...locales.map(locale => versions[locale].choices[i]))), correctIndex: versions.en.correctIndex, model: spec.model };
    });
  }
  return reviews;
}
