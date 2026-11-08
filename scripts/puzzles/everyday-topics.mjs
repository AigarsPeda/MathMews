/** Five additive topic tracks. Integer minutes, cents and millilitres are canonical. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const shopNames = Object.fromEntries(['en','lv','ru'].map(locale => [locale, JSON.parse(fs.readFileSync(new URL(`../../locales/${locale}.json`, import.meta.url))).everyday.shopItems]));
const T = (en, lv, ru) => ({ en, lv, ru });
const tiers = ['easy', 'medium', 'hard'];
const sum = xs => xs.reduce((a, b) => a + b, 0);
const clock = n => `${Math.floor(((n % 1440) + 1440) % 1440 / 60)}`.padStart(2, '0') + ':' + `${((n % 60) + 60) % 60}`.padStart(2, '0');
const number = (n, locale) => String(n).replace('.', locale === 'en' ? '.' : ',');
const definitions = [
  ['time', T('Time and schedules', 'Laiks un dienas plāns', 'Время и расписание'), 'clock-real-time', T('Read clocks and plan when things happen.', 'Lasi pulksteni un plāno notikumus.', 'Определяй время и планируй события.')],
  ['data', T('Data and graphs', 'Dati un diagrammas', 'Данные и диаграммы'), 'stats', T('Read, compare and reason with data.', 'Lasi, salīdzini un izpēti datus.', 'Читай, сравнивай и исследуй данные.')],
  ['spatial', T('Shapes and spatial reasoning', 'Figūras un telpiskā domāšana', 'Фигуры и пространственное мышление'), 'rotate', T('Explore shapes, reflections and turns.', 'Izpēti figūras, atspulgus un pagriezienus.', 'Исследуй фигуры, отражения и повороты.')],
  ['money', T('Money and shopping', 'Nauda un iepirkšanās', 'Деньги и покупки'), 'store', T('Count money and plan pretend purchases.', 'Skaiti naudu un plāno izdomātus pirkumus.', 'Считай деньги и планируй учебные покупки.')],
  ['capacity', T('Capacity and volume', 'Ietilpība un tilpums', 'Вместимость и объём'), 'cooking-pot', T('Measure liquids and explore volume.', 'Mēri šķidrumus un izpēti tilpumu.', 'Измеряй жидкости и исследуй объём.')],
];
export const EVERYDAY_TOPIC_IDS = definitions.map(([id]) => id);
const titles = {
  time: [
    [T('Whole hours', 'Pilnas stundas', 'Полные часы'), T('Half past', 'Pusstundas', 'Половина часа'), T('Quarter hours', 'Ceturtdaļstundas', 'Четверти часа'), T('Hours between events', 'Stundas starp notikumiem', 'Часы между событиями'), T('Later on the clock', 'Vēlāk pulkstenī', 'Время позже')],
    [T('Five-minute steps', 'Piecu minūšu soļi', 'Шаги по пять минут'), T('Elapsed minutes', 'Pagājušās minūtes', 'Прошедшие минуты'), T('Find the finish time', 'Atrodi beigu laiku', 'Найди время окончания'), T('Work back to the start', 'Atrodi sākuma laiku', 'Найди время начала'), T('Time between activities', 'Laiks starp nodarbēm', 'Время между занятиями')],
    [T('Across midnight', 'Pāri pusnaktij', 'Через полночь'), T('Late journeys', 'Vēli braucieni', 'Поздние поездки'), T('Plan the departure', 'Plāno izbraukšanu', 'Планируй отправление'), T('Travel and waiting', 'Ceļš un gaidīšana', 'Поездка и ожидание'), T('Hours into minutes', 'Stundas minūtēs', 'Часы в минутах')],
  ],
  data: [
    [T('Read a bar', 'Nolasi stabiņu', 'Прочитай столбец'), T('Find the largest group', 'Atrodi lielāko grupu', 'Найди самую большую группу'), T('Find the smallest group', 'Atrodi mazāko grupu', 'Найди самую маленькую группу'), T('Add the groups', 'Saskaiti grupas', 'Сложи группы'), T('Compare two groups', 'Salīdzini divas grupas', 'Сравни две группы')],
    [T('Scales of two', 'Skala pa divi', 'Шкала с шагом два'), T('Scales of five', 'Skala pa pieci', 'Шкала с шагом пять'), T('Totals on a chart', 'Kopsummas diagrammā', 'Суммы на диаграмме'), T('Find the difference', 'Atrodi starpību', 'Найди разность'), T('A missing bar', 'Trūkstošs stabiņš', 'Пропущенный столбец')],
    [T('Read larger scales', 'Lielākas skalas', 'Крупные шкалы'), T('Compare the spread', 'Salīdzini izkliedi', 'Сравни разброс'), T('Find the mean', 'Atrodi vidējo vērtību', 'Найди среднее значение'), T('Recover missing data', 'Atjauno trūkstošos datus', 'Восстанови данные'), T('Explain a chart', 'Izskaidro diagrammu', 'Объясни диаграмму')],
  ],
  spatial: [
    [T('Straight sides', 'Taisnas malas', 'Прямые стороны'), T('Corners of shapes', 'Figūru stūri', 'Углы фигур'), T('Sides in a collection', 'Figūru malu kopsumma', 'Стороны нескольких фигур'), T('Mirror positions', 'Spoguļa pozīcijas', 'Зеркальные положения'), T('Move one square', 'Pārvieto par lauciņu', 'Сдвинь на клетку')],
    [T('Lines of symmetry', 'Simetrijas asis', 'Оси симметрии'), T('Reflect on a grid', 'Atspoguļo režģī', 'Отрази на сетке'), T('Quarter turns', 'Ceturtdaļpagriezieni', 'Повороты на четверть'), T('Move across a grid', 'Pārvieto režģī', 'Перемещай по сетке'), T('Half turns', 'Puspagriezieni', 'Повороты на пол-оборота')],
    [T('Reflections on larger grids', 'Atspulgi lielākā režģī', 'Отражения на большой сетке'), T('Three-quarter turns', 'Trīs ceturtdaļu pagriezieni', 'Повороты на три четверти'), T('Two-direction moves', 'Pārvietojumi divos virzienos', 'Перемещения в двух направлениях'), T('Symmetry of regular shapes', 'Regulāru figūru simetrija', 'Симметрия правильных фигур'), T('Plan a transformation', 'Plāno pārveidojumu', 'Планируй преобразование')],
  ],
  money: [
    [T('Count cents', 'Skaiti centus', 'Считай центы'), T('Count euros', 'Skaiti eiro', 'Считай евро'), T('Two price tags', 'Divas cenu zīmes', 'Два ценника'), T('Change in euros', 'Atlikums eiro', 'Сдача в евро'), T('A small shopping budget', 'Neliels pirkumu budžets', 'Небольшой бюджет')],
    [T('Euros and cents', 'Eiro un centi', 'Евро и центы'), T('Add prices', 'Saskaiti cenas', 'Сложи цены'), T('Change with cents', 'Atlikums ar centiem', 'Сдача с центами'), T('Price of one item', 'Viena priekšmeta cena', 'Цена одного предмета'), T('Buy equal packs', 'Pērc vienādus komplektus', 'Покупай одинаковые наборы')],
    [T('Sale prices', 'Cenas ar atlaidi', 'Цены со скидкой'), T('Work out unit prices', 'Aprēķini vienības cenu', 'Вычисли цену за единицу'), T('Budget after a discount', 'Budžets pēc atlaides', 'Бюджет после скидки'), T('How many can you buy?', 'Cik vari nopirkt?', 'Сколько можно купить?'), T('Plan a larger purchase', 'Plāno lielāku pirkumu', 'Планируй крупную покупку')],
  ],
  capacity: [
    [T('Read a measuring jug', 'Nolasi mērtrauku', 'Прочитай мерный кувшин'), T('Combine two amounts', 'Apvieno divus daudzumus', 'Соедини два объёма'), T('Space left in a jug', 'Brīvā vieta traukā', 'Свободное место в кувшине'), T('Fill equal cups', 'Piepildi vienādas krūzes', 'Наполни одинаковые чашки'), T('Measure and combine', 'Mēri un apvieno', 'Измеряй и соединяй')],
    [T('Litres and millilitres', 'Litri un mililitri', 'Литры и миллилитры'), T('Add measured amounts', 'Saskaiti izmērītos daudzumus', 'Сложи измеренные объёмы'), T('Top up a container', 'Papildini trauku', 'Долей в ёмкость'), T('Equal servings', 'Vienādas porcijas', 'Равные порции'), T('Choose enough containers', 'Izvēlies pietiekami daudz trauku', 'Выбери достаточно ёмкостей')],
    [T('Volume of a box', 'Kastes tilpums', 'Объём коробки'), T('Decimal litres', 'Litri ar decimāldaļām', 'Литры с десятичными дробями'), T('Plan equal portions', 'Plāno vienādas porcijas', 'Планируй равные порции'), T('Containers and leftovers', 'Trauki un atlikums', 'Ёмкости и остаток'), T('Match box volumes', 'Atrodi kastes tilpumu', 'Найди объём коробки')],
  ],
};

function result(model, question, answer, hint, explanation, options) {
  return { model, question, answer, hint, explanation, options };
}
function timeTask(tier, focus, n) {
  const h = 1 + n % 11, minute = tier === 0 ? focus === 1 ? 30 : focus === 2 ? [15, 45][n % 2] : 0 : (1 + n % 11) * 5;
  let start = h * 60 + minute, duration = tier === 0 ? (1 + n % 3) * 60 : 15 + n % 12 * 5;
  const model = { kind: 'clock', task: 'read', minutes: start, analog: true };
  let answer = clock(start), question = T('What time does the clock show?', 'Cik rāda pulkstenis?', 'Какое время показывают часы?');
  let explanation = T(`The hour hand and minute hand show ${answer}.`, `Stundu un minūšu rādītāji rāda ${answer}.`, `Часовая и минутная стрелки показывают ${answer}.`);
  if (tier === 0 && focus === 3 || tier === 1 && [1, 4].includes(focus) || tier === 2 && [0, 4].includes(focus)) {
    if (tier === 2) { start = focus === 0 ? 22 * 60 + minute : 7 * 60 + minute; duration = 90 + n % 9 * 15; }
    Object.assign(model, { task: 'elapsed', minutes: start, end: (start + duration) % 1440, analog: false });
    answer = tier === 0 ? duration / 60 : duration;
    question = tier === 0 ? T('How many hours pass between these times?', 'Cik stundu paiet starp šiem laikiem?', 'Сколько часов проходит между этими моментами?')
      : T(`How many minutes pass${start + duration >= 1440 ? ', going into the next day' : ' on the same day'}?`, `Cik minūšu paiet${start + duration >= 1440 ? ', pārejot nākamajā dienā' : ' tajā pašā dienā'}?`, `Сколько минут проходит${start + duration >= 1440 ? ' до следующего дня' : ' в тот же день'}?`);
    explanation = T(`Elapsed time: ${clock(start)} → ${clock(start + duration)}: ${duration} min${tier === 0 ? ` = ${answer} h` : ''}.`, `Pagājušais laiks: ${clock(start)} → ${clock(start + duration)}: ${duration} min${tier === 0 ? ` = ${answer} h` : ''}.`, `${clock(start)} → ${clock(start + duration)}: ${duration} мин${tier === 0 ? ` = ${answer} ч` : ''}.`);
  } else if (tier === 0 && focus === 4 || tier === 1 && [2, 3].includes(focus) || tier === 2 && [1, 2, 3].includes(focus)) {
    if (tier === 2) { start = 22 * 60 + minute; duration = 70 + n % 12 * 10; }
    const backwards = focus === (tier === 1 ? 3 : 2);
    Object.assign(model, { task: backwards ? 'start' : 'finish', minutes: backwards ? (start + duration) % 1440 : start, duration, analog: false });
    answer = clock(backwards ? start : start + duration);
    question = backwards ? T(`The activity ends at the shown time and lasts ${duration} minutes. When did it start?`, `Nodarbe beidzas norādītajā laikā un ilgst ${duration} minūtes. Kad tā sākās?`, `Занятие заканчивается в указанное время и длится ${duration} минут. Когда оно началось?`)
      : tier === 2 && focus === 3 ? T(`Wait ${duration - 40} minutes, then travel for 40 minutes. What time will you arrive?`, `Gaidi ${duration - 40} minūtes, tad brauc 40 minūtes. Cikos ieradīsies?`, `Подожди ${duration - 40} минут, затем потрать 40 минут на дорогу. Во сколько прибудешь?`)
        : T(`Start at the shown time. The activity lasts ${duration} minutes. When does it finish?`, `Sāc norādītajā laikā. Nodarbe ilgst ${duration} minūtes. Kad tā beidzas?`, `Начни в указанное время. Занятие длится ${duration} минут. Когда оно закончится?`);
    explanation = T(`Finish time: ${clock(start)} + ${duration} min → ${clock(start + duration)}.`, `Beigu laiks: ${clock(start)} + ${duration} min → ${clock(start + duration)}.`, `${clock(start)} + ${duration} мин → ${clock(start + duration)}.`);
  }
  model.label = model.analog
    ? T(`Short hand: ${h}${minute ? ` toward ${h % 12 + 1}` : ''}. Long hand: ${minute / 5 || 12}.`, `Īsais rādītājs: ${h}${minute ? ` virzienā uz ${h % 12 + 1}` : ''}. Garais rādītājs: ${minute / 5 || 12}.`, `Короткая стрелка: ${h}${minute ? ` в сторону ${h % 12 + 1}` : ''}. Длинная стрелка: ${minute / 5 || 12}.`)
    : T(`${clock(model.minutes)}${model.end === undefined ? '' : ` → ${clock(model.end)}`}`, `${clock(model.minutes)}${model.end === undefined ? '' : ` → ${clock(model.end)}`}`, `${clock(model.minutes)}${model.end === undefined ? '' : ` → ${clock(model.end)}`}`);
  const hint = T('The short hand tracks hours; the long hand tracks minutes. One hour is 60 minutes. Count forward or backward from the given time.', 'Īsais rādītājs rāda stundas, garais — minūtes. Vienā stundā ir 60 minūtes. Skaiti uz priekšu vai atpakaļ no dotā laika.', 'Короткая стрелка показывает часы, длинная — минуты. В часе 60 минут. Отсчитывай вперёд или назад от заданного времени.');
  const options = typeof answer === 'string' ? [answer, clock((model.task === 'start' ? start : model.task === 'finish' ? start + duration : start) + (tier === 0 ? 60 : 5)), clock((model.task === 'start' ? start : model.task === 'finish' ? start + duration : start) - (tier === 0 ? 60 : 15))] : undefined;
  return result(model, question, answer, hint, explanation, options);
}

function dataTask(tier, focus, n) {
  const step = tier === 0 ? 1 : tier === 1 ? focus === 0 ? 2 : 5 : [10, 20, 25][n % 3];
  const base = 1 + n % 4, values = [base, base + 1 + n % 2, base + 3 + n % 3].map(v => v * step);
  if (n % 2) values.reverse();
  const task = tier === 0 ? ['read', 'most', 'least', 'total', 'difference'][focus]
    : tier === 1 ? ['read', 'read', 'total', 'difference', 'missing'][focus] : ['read', 'range', 'mean', 'missing', 'difference'][focus];
  if (task === 'mean') values[2] += ((3 - sum(values) / step % 3) % 3) * step;
  const index = n % 3, total = sum(values);
  const model = { kind: 'bars', task, values, step, index, ...(task === 'missing' ? { total } : {}) };
  const names = ['A', 'B', 'C'];
  const questions = {
    read: T(`How many toys are in group ${names[index]}?`, `Cik rotaļlietu ir grupā ${names[index]}?`, `Сколько игрушек в группе ${names[index]}?`),
    most: T('Which group has the most toys?', 'Kurā grupā ir visvairāk rotaļlietu?', 'В какой группе больше всего игрушек?'),
    least: T('Which group has the fewest toys?', 'Kurā grupā ir vismazāk rotaļlietu?', 'В какой группе меньше всего игрушек?'),
    total: T('How many toys are there altogether?', 'Cik rotaļlietu ir pavisam?', 'Сколько всего игрушек?'),
    difference: T('How many more toys are in the larger of groups A and B?', 'Par cik vairāk rotaļlietu ir lielākajā no grupām A un B?', 'На сколько больше игрушек в большей из групп A и B?'),
    range: T('What is the difference between the largest and smallest groups?', 'Kāda ir starpība starp lielāko un mazāko grupu?', 'Какова разность между самой большой и самой маленькой группами?'),
    mean: T('What is the mean number of toys per group?', 'Kāds ir vidējais rotaļlietu skaits grupā?', 'Каково среднее число игрушек в группе?'),
    missing: T(`There are ${total} toys altogether. How many are in the missing group ${names[index]}?`, `Pavisam ir ${total} rotaļlietu. Cik ir trūkstošajā grupā ${names[index]}?`, `Всего ${total} игрушек. Сколько в пропущенной группе ${names[index]}?`),
  };
  const answer = task === 'most' ? names[values.indexOf(Math.max(...values))] : task === 'least' ? names[values.indexOf(Math.min(...values))]
    : task === 'total' ? total : task === 'difference' ? Math.abs(values[0] - values[1]) : task === 'range' ? Math.max(...values) - Math.min(...values) : task === 'mean' ? total / 3 : values[index];
  const visible = names.map((name, i) => `${name}: ${task === 'missing' && index === i ? '?' : values[i]}`).join(', ');
  model.label = T(`Toys. ${visible}. Scale step: ${step}.`, `Rotaļlietas. ${visible}. Skalas solis: ${step}.`, `Игрушки. ${visible}. Шаг шкалы: ${step}.`);
  const hint = T('Read the scale first. For a total, add the groups; for a difference, subtract. A mean shares the total equally among the groups.', 'Vispirms nolasi skalu. Kopsummai saskaiti grupas, starpībai atņem. Vidējo vērtību iegūst, kopsummu sadalot vienādi starp grupām.', 'Сначала прочитай шкалу. Для суммы сложи группы, для разности вычти. Для среднего раздели сумму поровну между группами.');
  const detail = task === 'mean' ? `${values.join(' + ')} = ${total}; ${total} ÷ 3 = ${answer}.` : task === 'total' ? `${values.join(' + ')} = ${answer}.`
    : task === 'difference' ? `${Math.max(values[0], values[1])} − ${Math.min(values[0], values[1])} = ${answer}.`
      : task === 'range' ? `${Math.max(...values)} − ${Math.min(...values)} = ${answer}.` : task === 'missing' ? `${total} − ${values.filter((_, i) => i !== index).join(' − ')} = ${answer}.` : `${visible}. ${answer}.`;
  return result(model, questions[task], answer, hint, T(detail, detail, detail), typeof answer === 'string' ? names : undefined);
}

function spatialTask(tier, focus, n) {
  const polygon = tier === 0 && focus < 3 || tier === 1 && focus === 0 || tier === 2 && focus === 3;
  const hint = T('Trace each straight side or corner once. For a grid move, keep the same distance from the mirror or the centre of the turn.', 'Katru taisno malu vai stūri skaiti vienreiz. Režģī saglabā attālumu līdz spogulim vai pagrieziena centram.', 'Посчитай каждую прямую сторону или вершину один раз. На сетке сохраняй расстояние до зеркала или центра поворота.');
  if (polygon) {
    const sides = tier === 2 ? [5 + n % 6] : tier === 1 ? [3 + n % 4] : focus === 2 ? [3 + n % 4, 3 + Math.floor(n / 4) % 4] : [3 + n % 6];
    const rectangle = tier === 1 && n % 3 === 0;
    if (rectangle) sides[0] = 4;
    const task = tier > 0 ? 'symmetry' : focus === 1 ? 'corners' : 'sides';
    const model = { kind: 'shapes', task, sides, rectangle, label: T(`${rectangle ? 'Rectangle with unequal adjacent sides' : 'Regular shapes'}, sides: ${sides.join(', ')}.`, `${rectangle ? 'Taisnstūris ar nevienādām blakusmalām' : 'Regulāras figūras'}, malas: ${sides.join(', ')}.`, `${rectangle ? 'Прямоугольник с неравными соседними сторонами' : 'Правильные фигуры'}, стороны: ${sides.join(', ')}.`) };
    const answer = task === 'symmetry' ? rectangle ? 2 : sides[0] : sum(sides);
    const question = task === 'symmetry' ? T('How many lines of symmetry does this shape have?', 'Cik simetrijas asu ir šai figūrai?', 'Сколько осей симметрии у этой фигуры?')
      : task === 'corners' ? T('How many corners does this shape have?', 'Cik stūru ir šai figūrai?', 'Сколько вершин у этой фигуры?')
        : T('How many straight sides do these shapes have altogether?', 'Cik taisnu malu ir šīm figūrām kopā?', 'Сколько всего прямых сторон у этих фигур?');
    const explanation = task === 'symmetry' ? T(`There are ${answer} mirror lines that split the shape into matching halves.`, `Ir ${answer} simetrijas asis, kas sadala figūru vienādās spoguļpusēs.`, `Есть ${answer} осей симметрии, делящих фигуру на зеркально равные половины.`)
      : T(`Count once around each shape: ${sides.join(' + ')} = ${answer}.`, `Skaiti vienreiz apkārt katrai figūrai: ${sides.join(' + ')} = ${answer}.`, `Обойди каждую фигуру один раз: ${sides.join(' + ')} = ${answer}.`);
    return result(model, question, answer, hint, explanation);
  }
  const size = tier === 0 ? 3 : 5, row = n % size, col = Math.floor(n / size) % size;
  const task = tier === 0 ? focus === 3 ? 'reflect' : 'translate' : tier === 1 ? focus === 1 ? 'reflect' : [2, 4].includes(focus) ? 'rotate' : 'translate' : focus === 0 ? 'reflect' : [1, 4].includes(focus) ? 'rotate' : 'translate';
  const turns = tier === 1 ? focus === 4 ? 2 : 1 : 3;
  const dx = col < size - 1 ? tier === 2 ? size - 1 - col : 1 : -1;
  const dy = tier === 2 ? row < size - 1 ? 1 : -1 : 0;
  let x = col, y = row;
  if (task === 'reflect') x = size - 1 - x;
  if (task === 'translate') { x += dx; y += dy; }
  if (task === 'rotate') for (let i = 0; i < turns; i++) [x, y] = [size - 1 - y, x];
  const answer = y * size + x + 1, start = row * size + col + 1;
  const model = { kind: 'grid', task, size, start, turns, dx, dy, label: T(`${size} by ${size} grid, numbered left to right, top to bottom. Marked square: ${start}.`, `${size} reiz ${size} režģis, numurēts no kreisās uz labo un no augšas uz leju. Atzīmētais lauciņš: ${start}.`, `Сетка ${size} на ${size}, номера слева направо, сверху вниз. Отмечена клетка ${start}.`) };
  const question = task === 'reflect' ? T('Reflect the marked square across the vertical middle line. Which square does it reach?', 'Atspoguļo atzīmēto lauciņu pret vertikālo viduslīniju. Kurā lauciņā tas nonāk?', 'Отрази отмеченную клетку относительно вертикальной средней линии. В какую клетку она попадёт?')
    : task === 'rotate' ? T(`Turn the marked square ${turns} quarter-turn${turns === 1 ? '' : 's'} clockwise around the grid centre. Which square does it reach?`, `Pagriez atzīmēto lauciņu par ${turns} ceturtdaļpagriezieniem pulksteņa rādītāja virzienā ap režģa centru. Kur tas nonāk?`, `Поверни отмеченную клетку на ${turns} четверти оборота по часовой стрелке вокруг центра сетки. Куда она попадёт?`)
      : T(`Move ${Math.abs(dx)} square${Math.abs(dx) === 1 ? '' : 's'} ${dx > 0 ? 'right' : 'left'}${dy ? ` and 1 ${dy > 0 ? 'down' : 'up'}` : ''}. Which square does the mark reach?`, `Pārvieto par ${Math.abs(dx)} lauciņiem pa ${dx > 0 ? 'labi' : 'kreisi'}${dy ? ` un par 1 ${dy > 0 ? 'uz leju' : 'uz augšu'}` : ''}. Kurā lauciņā nonāk atzīme?`, `Передвинь на ${Math.abs(dx)} клеток ${dx > 0 ? 'вправо' : 'влево'}${dy ? ` и на 1 ${dy > 0 ? 'вниз' : 'вверх'}` : ''}. В какой клетке будет метка?`);
  const explanation = T(`The mark moves from square ${start} to square ${answer}, in row ${y + 1}, column ${x + 1}.`, `Atzīme pārvietojas no ${start}. uz ${answer}. lauciņu, ${y + 1}. rindā un ${x + 1}. kolonnā.`, `Метка перемещается из клетки ${start} в клетку ${answer}, строка ${y + 1}, столбец ${x + 1}.`);
  const options = [answer, ...Array.from({ length: size * size }, (_, i) => (answer + n + i) % (size * size) + 1).filter(v => v !== answer).slice(0, 2)];
  return result(model, question, answer, hint, explanation, options);
}

function moneyTask(tier, focus, n) {
  const cents = tier === 0 && focus === 0;
  let prices = tier === 0 ? cents ? [5, 10, 20].slice(0, 1 + n % 3).concat([1, 2, 5, 10][Math.floor(n / 3) % 4]) : [100 * (1 + n % 8), 100 * (1 + Math.floor(n / 8) % 5)]
    : [125 + n % 12 * 25, 50 + Math.floor(n / 3) % 8 * 25];
  let task = tier === 0 ? focus < 3 ? 'total' : 'change' : tier === 1 ? ['total', 'total', 'change', 'unit', 'total'][focus] : ['discount', 'unit', 'change', 'afford', 'change'][focus];
  let quantities = prices.map(() => 1), discount = 0, paid = tier === 0 ? 2000 : 2000 + n % 4 * 500;
  if (task === 'unit') { const count = 2 + n % 4; prices = [(tier === 2 ? 75 : 50) * (2 + n % 7) * count]; quantities = [count]; }
  if (tier === 1 && focus === 4) quantities = [2 + n % 3, 1];
  if (tier === 2 && [0, 2, 4].includes(focus)) { prices = [500 + n % 10 * 100]; quantities = [1]; discount = [10, 20, 25, 50][n % 4]; }
  if (task === 'afford') { prices = [125 + n % 7 * 25]; quantities = [1]; }
  const total = sum(prices.map((p, i) => p * quantities[i] * (100 - discount) / 100));
  const raw = task === 'change' ? paid - total : task === 'unit' ? prices[0] / quantities[0] : task === 'afford' ? Math.floor(paid / prices[0]) : total;
  const answer = cents || task === 'afford' ? raw : raw / 100;
  const items = ['apple', 'cookie', 'book'];
  const model = { kind: 'money', task, prices, quantities, paid, discount, unit: cents ? 'cents' : 'euros',
    ...(cents ? { coins: true } : { items: prices.map((_, i) => items[i]) }) };
  const question = task === 'total' ? cents ? T('How many cents are shown altogether?', 'Cik centu ir parādīts kopā?', 'Сколько всего центов показано?') : T('What is the total price in euros?', 'Kāda ir kopējā cena eiro?', 'Какова общая цена в евро?')
    : task === 'change' ? T(`Pay with €${paid / 100}. How many euros remain${discount ? ' after the discount' : ''}?`, `Samaksā ar €${paid / 100}. Cik eiro paliek${discount ? ' pēc atlaides' : ''}?`, `Заплати €${paid / 100}. Сколько евро останется${discount ? ' после скидки' : ''}?`)
      : task === 'unit' ? T(`The pack contains ${quantities[0]} equal items. What does one cost in euros?`, `Komplektā ir ${quantities[0]} vienādi priekšmeti. Cik eiro maksā viens?`, `В наборе ${quantities[0]} одинаковых предметов. Сколько евро стоит один?`)
        : task === 'afford' ? T(`With €${paid / 100}, how many whole items can you buy?`, `Cik veselus priekšmetus vari nopirkt par €${paid / 100}?`, `Сколько целых предметов можно купить за €${paid / 100}?`)
          : T('What is the sale price in euros?', 'Kāda ir cena ar atlaidi eiro?', 'Какова цена со скидкой в евро?');
  model.label = Object.fromEntries(['en','lv','ru'].map(locale => [locale, cents
    ? `${T('Coins in cents', 'Monētas centos', 'Монеты в центах')[locale]}: ${prices.join(', ')}.`
    : prices.map((price, i) => `${shopNames[locale][items[i]]}: ${quantities[i]} ${task === 'unit' ? T('in the pack; whole pack', 'komplektā; viss komplekts', 'в наборе; весь набор')[locale] : T('× each', '× katrs', '× за штуку')[locale]} €${number(price / 100, locale)}.`).join(' ')
      + (discount ? ` ${T('Discount', 'Atlaide', 'Скидка')[locale]}: ${discount}%.` : '')]));
  const hint = task === 'unit' ? T('The shown price is for the whole pack. Divide it by the number of items in the pack.', 'Parādīta visa komplekta cena. Izdali to ar priekšmetu skaitu komplektā.', 'Показана цена всего набора. Раздели её на число предметов в наборе.')
    : task === 'afford' ? T('Divide your budget by the price of one item. Count only whole items.', 'Izdali budžetu ar viena priekšmeta cenu. Skaiti tikai veselus priekšmetus.', 'Раздели бюджет на цену одного предмета. Считай только целые предметы.')
    : task === 'change' ? T('Find the total cost, applying any discount first. Subtract it from the amount paid.', 'Aprēķini kopējo cenu, vispirms piemērojot atlaidi, ja tāda ir. Atņem cenu no samaksātās summas.', 'Найди общую стоимость с учётом скидки, если она есть. Вычти её из уплаченной суммы.')
    : task === 'discount' ? T('Work out the discount amount, then subtract it from the original price.', 'Aprēķini atlaides summu un atņem to no sākotnējās cenas.', 'Найди сумму скидки и вычти её из первоначальной цены.')
    : cents ? T('Add the value of every coin shown.', 'Saskaiti visu parādīto monētu vērtības.', 'Сложи значения всех показанных монет.')
    : T('Multiply each price by its quantity, then add the costs. 100 cents make €1.', 'Reizini katru cenu ar daudzumu un saskaiti izmaksas. 100 centi ir €1.', 'Умножь каждую цену на количество, затем сложи стоимости. 100 центов составляют €1.');
  const detail = task === 'unit' ? `${prices[0]} ÷ ${quantities[0]} = ${raw}` : task === 'change' ? `${paid} − ${total} = ${raw}` : task === 'afford' ? `${raw} × ${prices[0]} ≤ ${paid}; ${raw + 1} × ${prices[0]} > ${paid}` : `${total}`;
  const explanation = T(`${detail} cents${task === 'afford' ? `. You can buy ${answer} items.` : `; answer: ${answer}${cents ? ' cents' : ' euros'}.`}`, `${detail} centi${task === 'afford' ? `. Vari nopirkt ${answer} priekšmetus.` : `; atbilde: ${number(answer, 'lv')}${cents ? ' centi' : ' eiro'}.`}`, `${detail} центов${task === 'afford' ? `. Можно купить ${answer} предметов.` : `; ответ: ${number(answer, 'ru')}${cents ? ' центов' : ' евро'}.`}`);
  return result(model, question, answer, hint, explanation);
}

function capacityTask(tier, focus, n) {
  const volumeHint = T('A box volume is length × width × height. Think of equal layers of unit cubes.', 'Kastes tilpums ir garums × platums × augstums. Iedomājies vienādus vienības kubu slāņus.', 'Объём коробки равен длине × ширине × высоте. Представь одинаковые слои единичных кубиков.');
  if (tier === 2 && [0, 4].includes(focus)) {
    const width = 2 + n % 7, height = 2 + Math.floor(n / 7) % 5, depth = 2 + Math.floor(n / 3) % 4;
    const model = { kind: 'solid', width, height, depth, label: T(`Box: ${width} cm × ${height} cm × ${depth} cm.`, `Kaste: ${width} cm × ${height} cm × ${depth} cm.`, `Коробка: ${width} см × ${height} см × ${depth} см.`) };
    const answer = width * height * depth;
    const question = focus === 0 ? T('What is the volume of this box in cm³?', 'Kāds ir šīs kastes tilpums cm³?', 'Каков объём этой коробки в см³?')
      : T('A second box must hold the same volume. How many unit cubes must it hold?', 'Otrai kastei vajadzīgs tāds pats tilpums. Cik vienības kubu tai jāietilpina?', 'Вторая коробка должна иметь такой же объём. Сколько единичных кубиков она должна вмещать?');
    return result(model, question, answer, volumeHint, T(`${width} × ${height} × ${depth} = ${answer} cm³.`, `${width} × ${height} × ${depth} = ${answer} cm³.`, `${width} × ${height} × ${depth} = ${answer} см³.`));
  }
  const task = tier === 0 ? ['read', 'total', 'space', 'servings', 'total'][focus] : tier === 1 ? ['litres', 'total', 'space', 'servings', 'containers'][focus] : focus === 1 ? 'litres' : focus === 2 ? 'servings' : 'containers';
  const hint = {
    read: T('Read the scale from zero. Equal gaps stand for equal amounts; find the mark at the water level.', 'Lasi skalu no nulles. Vienādi atstatumi nozīmē vienādus daudzumus; atrodi iedaļu ūdens līmenī.', 'Читай шкалу от нуля. Равные промежутки обозначают равные объёмы; найди отметку на уровне воды.'),
    total: T('Add the amounts of liquid. A container’s capacity tells how much it could hold, not how much is inside.', 'Saskaiti šķidruma daudzumus. Trauka ietilpība rāda, cik tajā varētu ietilpt, nevis cik tajā ir.', 'Сложи объёмы жидкости. Вместимость показывает, сколько поместится в ёмкость, а не сколько в ней сейчас.'),
    space: T('Subtract the amount already inside from the full capacity to find the space left.', 'Atņem jau iepildīto daudzumu no pilnas ietilpības, lai atrastu brīvo vietu.', 'Вычти уже налитый объём из полной вместимости, чтобы найти свободное место.'),
    litres: T('One litre is 1000 millilitres. Divide millilitres by 1000 to express the same amount in litres.', 'Viens litrs ir 1000 mililitru. Dali mililitrus ar 1000, lai to pašu daudzumu izteiktu litros.', 'Один литр равен 1000 миллилитрам. Раздели миллилитры на 1000, чтобы выразить тот же объём в литрах.'),
    servings: T('Divide the liquid amount by one cup’s capacity. Count only full cups; a leftover amount does not fill another cup.', 'Izdali šķidruma daudzumu ar vienas krūzes ietilpību. Skaiti tikai pilnas krūzes; atlikums nepiepilda vēl vienu krūzi.', 'Раздели объём жидкости на вместимость чашки. Считай только полные чашки: остатка не хватит ещё на одну полную чашку.'),
    containers: T('Divide the liquid amount by one bottle’s capacity. If any liquid is left over, it needs one more bottle.', 'Izdali šķidruma daudzumu ar vienas pudeles ietilpību. Ja šķidrums paliek pāri, tam vajag vēl vienu pudeli.', 'Раздели объём жидкости на вместимость бутылки. Если жидкость осталась, для неё нужна ещё одна бутылка.'),
  }[task];
  const portion = tier === 0 ? 100 : [125, 200, 250][n % 3];
  let amounts = [(1 + n % 8) * (tier === 0 ? 100 : 125)];
  if (task === 'total') amounts.push((1 + Math.floor(n / 4) % 4) * (tier === 0 ? 100 : 250));
  if (task === 'servings') amounts = [portion * (2 + n % 7) + (tier === 2 ? 25 : 0)];
  if (task === 'containers') amounts = [1000 + n % 9 * 125];
  if (task === 'litres') amounts = [(tier === 1 ? 1 + n % 8 : 5 + n % 24) * 250];
  const capacities = amounts.map(v => Math.ceil((v + 100) / 500) * 500);
  const answer = task === 'total' ? sum(amounts) : task === 'space' ? capacities[0] - amounts[0] : task === 'servings' ? Math.floor(amounts[0] / portion)
    : task === 'containers' ? Math.ceil(amounts[0] / portion) : task === 'litres' ? amounts[0] / 1000 : amounts[0];
  const model = { kind: 'capacity', task, amounts, capacities, portion, unit: task === 'litres' ? 'l' : 'ml', label: T(`Liquid amounts: ${amounts.join(', ')} ml. Container capacities: ${capacities.join(', ')} ml.`, `Šķidruma daudzumi: ${amounts.join(', ')} ml. Trauku ietilpības: ${capacities.join(', ')} ml.`, `Объёмы жидкости: ${amounts.join(', ')} мл. Вместимость ёмкостей: ${capacities.join(', ')} мл.`) };
  if (task === 'servings' || task === 'containers') model.portionContainer = task === 'servings' ? 'cup' : 'bottle';
  const question = task === 'read' ? T('How many millilitres are in the jug?', 'Cik mililitru ir mērtraukā?', 'Сколько миллилитров в кувшине?')
    : task === 'total' ? T('How many millilitres are there altogether?', 'Cik mililitru ir kopā?', 'Сколько всего миллилитров?')
      : task === 'space' ? T('How many more millilitres will fill the container?', 'Cik mililitru vēl vajag, lai piepildītu trauku?', 'Сколько ещё миллилитров нужно до полного заполнения?')
        : task === 'servings' ? T(`How many full ${portion} ml cups can you pour?`, `Cik pilnas ${portion} ml krūzes vari pieliet?`, `Сколько полных чашек по ${portion} мл можно налить?`)
          : task === 'containers' ? T(`Each bottle holds ${portion} ml. How many bottles are needed for all the liquid? The last may be partly full.`, `Katrā pudelē ietilpst ${portion} ml. Cik pudeļu vajag visam šķidrumam? Pēdējā var būt daļēji pilna.`, `Каждая бутылка вмещает ${portion} мл. Сколько бутылок нужно для всей жидкости? Последняя может быть неполной.`)
            : T('How many litres does the shown amount equal?', 'Cik litru ir parādītajā daudzumā?', 'Скольким литрам равен показанный объём?');
  const detail = task === 'total' ? `${amounts.join(' + ')} = ${answer} ml.` : task === 'space' ? `${capacities[0]} − ${amounts[0]} = ${answer} ml.`
    : task === 'servings' || task === 'containers' ? `${amounts[0]} ml ÷ ${portion} ml; ${task === 'servings' ? 'full cups' : 'bottles needed'}: ${answer}.` : task === 'litres' ? `${amounts[0]} ml = ${answer} l.` : `${answer} ml.`;
  return result(model, question, answer, hint, T(detail, detail.replace('full cups', 'pilnas krūzes').replace('bottles needed', 'vajadzīgās pudeles').replace(/(\d)\.(?=\d)/g, '$1,'), detail.replace('full cups', 'полные чашки').replace('bottles needed', 'нужно бутылок').replaceAll('ml', 'мл').replace(/(\d)\.(?=\d)/g, '$1,')));
}
const factories = { time: timeTask, data: dataTask, spatial: spatialTask, money: moneyTask, capacity: capacityTask };
const localize = (value, locale) => Array.isArray(value) ? value.map(v => localize(v, locale)) : value && typeof value === 'object' ? 'en' in value ? value[locale] : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, locale)])) : value;
function choicesFor(spec, n, locale) {
  let options = spec.options;
  if (!options) {
    const answer = spec.answer, delta = Number.isInteger(answer) ? 1 : 0.25;
    const rank = Math.min(n % 3, Math.floor(answer / delta));
    options = Array.from({ length: 3 }, (_, i) => Math.round((answer + (i - rank) * delta) * 100) / 100);
  }
  const strings = options.map(x => typeof x === 'number' ? number(x, locale) : x);
  assert.equal(new Set(strings).size, 3, `Three distinct answers: ${JSON.stringify(spec)}`);
  const correct = typeof spec.answer === 'number' ? number(spec.answer, locale) : spec.answer;
  const shift = Math.floor(n / 3) % 3, choices = [...strings.slice(shift), ...strings.slice(0, shift)];
  return { choices, correctIndex: choices.indexOf(correct) };
}
export function appendEverydayTopics({ topics, lessons, puzzles, pathExtras }) {
  const daily = {};
  for (const [topicId, title, icon, description] of definitions) {
    topics.push({ id: topicId, title, icon, description });
    for (const [tier, difficulty] of tiers.entries()) for (let stage = 0; stage < 10; stage++) {
      const focus = Math.floor(stage / 2), baseTitle = titles[topicId][tier][focus];
      const id = `${difficulty}-${topicId}-lesson-${stage + 1}`, skillId = `${difficulty}.${topicId}.${stage + 1}`;
      const lessonTitle = stage % 2 ? T(`${baseTitle.en}: put it to use`, `${baseTitle.lv}: pielieto`, `${baseTitle.ru}: применяй`) : baseTitle;
      const prerequisites = stage ? [`${difficulty}.${topicId}.${stage}`] : [];
      const entry = { format: 'path', id, difficulty, topicId, title: lessonTitle, description, skillId, prerequisiteSkillIds: prerequisites, levels: [] };
      const generated = [];
      for (let slot = 0; slot < 10; slot++) {
        const n = stage * 17 + slot;
        const spec = factories[topicId](tier, focus, n), example = factories[topicId](tier, focus, n + 127);
        const puzzleId = `v2-${id}-${slot + 1}`;
        for (const locale of ['en', 'lv', 'ru']) {
          const p = { id: puzzleId, difficulty, type: 'multiple_choice', topic: topicId, ageRange: tier === 0 ? [5, 7] : tier === 1 ? [7, 10] : [10, 12],
            question: spec.question[locale], hint: spec.hint[locale], explanation: spec.explanation[locale], ...choicesFor(spec, n, locale),
            everyday: { model: localize(spec.model, locale), example: { model: localize(example.model, locale), question: example.question[locale], explanation: `${example.hint[locale]}\n\n${example.explanation[locale]}` } },
            learning: { skillId, prerequisiteSkillIds: prerequisites, role: slot >= 8 ? 'review' : slot >= 4 ? 'application' : 'practice', representation: spec.model.kind, reasoningSteps: tier === 2 ? 2 : 1 } };
          puzzles[locale][difficulty].push(p);
        }
        generated.push(puzzleId);
        if (slot < 8) entry.levels.push({ id: `${id}-step-${slot + 1}`, kind: slot === 7 ? 'challenge' : 'practice', title: lessonTitle, description, puzzleIds: [puzzleId], ...(slot === 7 ? { timeLimitSeconds: [180, 240, 300][tier] } : {}) });
      }
      pathExtras[id] = generated.slice(8);
      lessons.push(entry);
      daily[id] = Array.from({ length: 12 }, (_, i) => {
        const spec = factories[topicId](tier, focus, 301 + stage * 12 + i);
        const versions = Object.fromEntries(['en', 'lv', 'ru'].map(locale => [locale, choicesFor(spec, i, locale)]));
        return { prompt: spec.question, explanation: spec.explanation, choices: versions.en.choices.map((_, j) => T(versions.en.choices[j], versions.lv.choices[j], versions.ru.choices[j])), correctIndex: versions.en.correctIndex, model: spec.model };
      });
    }
  }
  return daily;
}
