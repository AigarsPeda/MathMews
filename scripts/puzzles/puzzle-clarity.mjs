/** Presentation-only revisions. Never change IDs, operands, choices or answers. */
const T = (en, lv, ru) => ({ en, lv, ru });
const hints = {
  addition: T('To combine two amounts, add them. You can split an amount into tens and ones, or make a full ten first.', 'Lai apvienotu divus daudzumus, saskaiti tos. Vari sadalīt daudzumu desmitos un vienos vai vispirms izveidot pilnu desmitu.', 'Чтобы объединить два количества, сложи их. Можно разделить число на десятки и единицы или сначала дополнить до десятка.'),
  subtraction: T('Subtract to find what remains or how much two amounts differ. You can subtract in smaller steps or count up from the smaller amount.', 'Atņem, lai atrastu atlikumu vai divu daudzumu starpību. Vari atņemt pa daļām vai skaitīt uz priekšu no mazākā daudzuma.', 'Вычитай, чтобы найти остаток или разницу двух количеств. Можно вычитать по частям или считать вперёд от меньшего числа.'),
  share: T('Share objects one at a time into equal groups. Stop when another full round is impossible; any objects left over are the remainder.', 'Sadali priekšmetus pa vienam vienādās grupās. Apstājies, kad vairs nevar sadalīt pilnu apli; pāri palikušie priekšmeti ir atlikums.', 'Раскладывай предметы по одному в равные группы. Остановись, когда на полный круг уже не хватает; оставшиеся предметы составляют остаток.'),
  fraction: T('The denominator tells how many equal groups make the whole. Divide by it, then multiply by the numerator to take the required groups.', 'Saucējs rāda, cik vienādu grupu veido veselo. Dali ar saucēju, tad reizini ar skaitītāju, lai paņemtu vajadzīgās grupas.', 'Знаменатель показывает, сколько равных групп составляет целое. Раздели на него, затем умножь на числитель, чтобы взять нужные группы.'),
  equivalent: T('Multiply or divide both the numerator and denominator by the same number. The size of each piece changes, but the fraction keeps its value.', 'Reizini vai dali skaitītāju un saucēju ar vienu un to pašu skaitli. Daļiņu lielums mainās, bet daļas vērtība paliek tā pati.', 'Умножь или раздели числитель и знаменатель на одно и то же число. Размер частей изменится, но значение дроби сохранится.'),
  route: T('Work backwards from the target using inverse operations, or try a route forwards. Check the move limit and each intermediate result.', 'Domā atpakaļ no mērķa ar pretējām darbībām vai izmēģini ceļu uz priekšu. Pārbaudi soļu skaitu un katru starprezultātu.', 'Иди от цели назад с помощью обратных действий или проверь путь вперёд. Учитывай число ходов и каждый промежуточный результат.'),
  budget: T('Find each price after its discount. Add the prices of a possible pair, then subtract that cost from the budget to check the amount left.', 'Atrodi katru cenu pēc atlaides. Saskaiti iespējamā pāra cenas un atņem izmaksas no budžeta, lai pārbaudītu atlikumu.', 'Найди каждую цену после скидки. Сложи цены возможной пары и вычти стоимость из бюджета, чтобы проверить остаток.'),
};
const objectWords = [
  [/\bribbons?\b/i, 'ribbon'], [/\bstars?\b/i, 'star'], [/\b(toys?|mice)\b/i, 'mouse'],
  [/\bcookies?\b/i, 'cookie'], [/\bparcels?\b/i, 'parcel'], [/\bbooks?\b/i, 'book'],
  [/\bshells?\b/i, 'shell'], [/\bleaves\b/i, 'leaf'], [/\b(seats?|chairs?|places)\b/i, 'chair'],
  [/\bguests?\b/i, 'guest'], [/\b(seedlings?|flowers?|plants?)\b/i, 'plant'], [/\bcoins?\b/i, 'coin'],
  [/\bballs?\b/i, 'ball'], [/\b(box|boxes|crates?)\b/i, 'box'], [/\b(planting spaces|flower spaces|square tiles)\b/i, 'planting_tile'],
];
export function applyPuzzleClarity({ puzzles }) {
  for (const tier of ['easy', 'medium', 'hard']) for (let index = 0; index < puzzles.en[tier].length; index++) {
    const source = structuredClone(puzzles.en[tier][index]);
    let question, hint, explanation, contextObjects;
    if (source.type === 'equation_board') question = T('Get one x on its own.', 'Atstāj vienu x atsevišķi.', 'Оставь слева только x.');
    if (source.type === 'ratio_table') {
      const n = source.payload.targetA;
      question = T(`How many litres are in ${n} ${n === 1 ? 'bottle' : 'bottles'}?`, `Cik litru ir ${n} ${n === 1 ? 'pudelē' : 'pudelēs'}?`, `Сколько литров в ${n} ${n === 1 ? 'бутылке' : 'бутылках'}?`);
      hint = T('Use the known total to find how much water is in the requested bottles. Every bottle holds the same amount.', 'Izmanto zināmo kopējo daudzumu, lai atrastu ūdens daudzumu prasītajās pudelēs. Katrā pudelē ir vienāds daudzums.', 'Используй известный общий объём, чтобы найти объём воды в нужном числе бутылок. В каждой бутылке одинаковое количество.');
    }
    // Removed story scenes cannot supply visual information to these models.
    if (source.id === 'v2-easy-numbers-train-1') question = T('Arrange the numbered stops from smallest to largest.', 'Sakārto pieturu numurus no mazākā līdz lielākajam.', 'Расположи номера остановок от меньшего к большему.');
    if (source.type === 'function_machine' && /gear|lantern|tracker|amplifier/.test(source.question)) question = T('Which rule turns this machine’s input into its output?', 'Kurš likums pārveido šīs mašīnas ievadi izvadē?', 'Какое правило превращает входное число машины в выходное?');
    if (source.type === 'operation_path') question = T('Choose operations for the shown steps to reach the target from the starting number.', 'Izvēlies parādīto soļu darbības, lai no sākuma skaitļa sasniegtu mērķi.', 'Выбери действия для показанных шагов, чтобы из начального числа получить целевое.');
    if (source.type === 'target_build' && /lantern|telescope/.test(source.question)) question = T('Keep the numbers in order. Choose operations that make the shown target.', 'Saglabā skaitļu secību. Izvēlies darbības, kas dod parādīto mērķa skaitli.', 'Сохрани порядок чисел. Выбери действия, которые дают указанное целевое число.');
    if (source.type === 'pattern_next' && /music box|signal/.test(source.question)) question = T('Continue the number pattern. What comes next?', 'Turpini skaitļu virkni. Kurš skaitlis ir nākamais?', 'Продолжи числовую последовательность. Какое число следующее?');
    if (source.id === 'v2-easy-fractions-kite-1') question = T('The whole has 6 equal parts. Color 2 parts.', 'Veselajam ir 6 vienādas daļas. Iekrāso 2 daļas.', 'Целое состоит из 6 равных частей. Закрась 2 части.');
    if (source.id === 'v2-medium-fractions-fountain-1') question = T('The whole has 8 equal parts. Color 3/8.', 'Veselajam ir 8 vienādas daļas. Iekrāso 3/8.', 'Целое состоит из 8 равных частей. Закрась 3/8.');
    if (source.id === 'v2-easy-fractions-kite-3') question = T('Match 2/6 and 4/6 to their pictures.', 'Savieno 2/6 un 4/6 ar attēliem.', 'Соедини 2/6 и 4/6 с рисунками.');
    if (source.id === 'v2-hard-logic-vault-2') { question = T('Is this division equation correct?', 'Vai šī dalīšanas vienādība ir pareiza?', 'Верно ли это равенство с делением?'); hint = T('Check division by multiplying the proposed answer by the divisor.', 'Pārbaudi dalīšanu, reizinot piedāvāto atbildi ar dalītāju.', 'Проверь деление: умножь предложенный ответ на делитель.'); }
    if (source.id === 'v2-easy-addition-picnic-3') question = T('Seven ribbons are ready. How many more make thirteen ribbons?', 'Septiņas lentes ir gatavas. Cik vēl vajag, lai būtu trīspadsmit lentes?', 'Семь лент готовы. Сколько ещё нужно, чтобы стало тринадцать лент?');
    if (source.id === 'v2-medium-division-parcels-2') question = T('Share 28 parcels into 4 equal groups. How many in each group?', 'Sadali 28 paciņas 4 vienādās grupās. Cik katrā grupā?', 'Раздели 28 посылок на 4 равные группы. Сколько в каждой группе?');
    if (source.id === 'v2-medium-division-parcels-3') question = T('Share 31 whole parcels into 4 equal groups. How many in each group, and how many remain?', 'Sadali 31 veselu paciņu 4 vienādās grupās. Cik katrā grupā, un cik paliek pāri?', 'Раздели 31 целую посылку на 4 равные группы. Сколько в каждой группе и сколько останется?');
    if (source.id === 'v2-hard-fractions-garden-3') question = T('Each of the 18 planting spaces needs 3 plants. How many plants?', 'Katrā no 18 stādīšanas vietām vajag 3 augus. Cik augu vajag?', 'На каждом из 18 мест для посадки нужно 3 растения. Сколько растений нужно?');
    if (source.id === 'v2-medium-multiplication-theatre-1') question = T('There are 7 rows of 8 chairs. How many chairs altogether?', 'Ir 7 rindas ar 8 krēsliem katrā. Cik krēslu ir kopā?', 'Есть 7 рядов по 8 стульев. Сколько всего стульев?');
    if (source.id === 'v2-hard-measurement-rates-2') question = T('54 grams of clay fill 3 equal boxes. How many grams fill 5 such boxes?', '54 grami māla piepilda 3 vienādas kastes. Cik gramu piepilda 5 tādas kastes?', '54 грамма глины заполняют 3 одинаковые коробки. Сколько граммов заполнят 5 таких коробок?');
    if (source.type === 'fair_share') hint = hints.share;
    if (source.type === 'route_grid') hint = hints.route;
    if (source.type === 'fraction_equivalent') hint = hints.equivalent;
    if (/Start with \d|count on \d|takes \d to reach|Split \d|Take away \d|smaller amount \d|What must join \d/.test(source.hint)) hint = hints[source.topic];
    if (hint === hints.addition && source.difficulty === 'easy' && source.taskVisual?.kind === 'join') hint = T('Joining groups means adding. Count each object once, or start with one group and count on for the other.', 'Apvienot grupas nozīmē saskaitīt. Saskaiti katru priekšmetu vienreiz vai sāc ar vienas grupas skaitu un pieskaiti otru.', 'Объединить группы значит сложить. Посчитай каждый предмет один раз или начни с одной группы и досчитай другую.');
    if (/seedlings/.test(source.hint)) hint = hints.fraction;
    if (/Try multiplying the last two/.test(source.hint)) hint = T('Multiplication and division come before addition and subtraction. Test the whole expression in that order.', 'Reizināšanu un dalīšanu izpilda pirms saskaitīšanas un atņemšanas. Pārbaudi visu izteiksmi šajā secībā.', 'Умножение и деление выполняют до сложения и вычитания. Проверь всё выражение в этом порядке.');
    if (/\bbells\b/.test(source.question)) {
      const [items, groups] = source.question.match(/\d+/g);
      question = T(`Share ${items} cookies equally among ${groups} boxes. How many per box?`, `Sadali ${items} cepumus vienādi ${groups} kastēs. Cik katrā kastē?`, `Разложи ${items} печений поровну в ${groups} коробок. Сколько в каждой коробке?`);
    }
    if (source.id === 'v2-medium-subtraction-lift-1') {
      question = T('There are 92 parcels. Send 37 away. How many remain?', 'Ir 92 paciņas. Nosūti 37 paciņas. Cik paliek?', 'Есть 92 посылки. Отправь 37. Сколько останется?');
      explanation = T('92 − 37 = 55 parcels.', '92 − 37 = 55 paciņas.', '92 − 37 = 55 посылок.');
    }
    if (source.id === 'v2-medium-subtraction-lift-2') {
      question = T('Of 55 parcels, 28 remain. How many were sent away?', 'No 55 paciņām paliek 28. Cik paciņu nosūtīja?', 'Из 55 посылок осталось 28. Сколько отправили?');
      explanation = T('55 − 27 = 28. 27 parcels were sent.', '55 − 27 = 28. Nosūtīja 27 paciņas.', '55 − 27 = 28. Отправили 27 посылок.');
    }
    if (source.id === 'v2-medium-subtraction-lift-3') question = T('Use 19 of the remaining 28 parcels. Repair the number left.', 'Izmanto 19 no atlikušajām 28 paciņām. Izlabo atlikušo skaitu.', 'Используй 19 из оставшихся 28 посылок. Исправь число оставшихся.');
    if (source.id === 'v2-hard-fractions-garden-3') explanation = T('18 × 3 = 54 plants.', '18 × 3 = 54 augi.', '18 × 3 = 54 растения.');
    if (source.id === 'v2-hard-measurement-rates-2') hint = T('Find the amount for one equal container, then multiply by the number of containers needed.', 'Atrodi daudzumu vienam vienādam traukam un reizini ar vajadzīgo trauku skaitu.', 'Найди количество для одной одинаковой ёмкости, затем умножь на нужное число ёмкостей.');
    if (source.type === 'fraction_strip') hint = T('The bottom number counts all the equal parts of a whole. The top number counts the parts to shade.', 'Apakšējais skaitlis rāda visas vienādās veselā daļas. Augšējais skaitlis rāda iekrāsojamās daļas.', 'Нижнее число показывает все равные части целого. Верхнее число показывает, сколько частей нужно закрасить.');
    const displayedQuestion = question?.en ?? source.question;
    // Give arithmetic stories their stated starting amounts, never their solved total.
    if (!source.everyday && !source.taskVisual?.object && !source.payload?.object) {
      contextObjects = objectWords.filter(([pattern]) => pattern.test(displayedQuestion)).map(([, object]) => ({ object }));
      if (['addition', 'subtraction'].includes(source.topic) && source.type === 'multiple_choice' && contextObjects.length) {
        const arithmetic = source.explanation.match(/^(\d+)\s*([+−-])\s*(\d+)\s*=/);
        if (arithmetic) { const object = contextObjects[0].object; contextObjects = [{object, count:Number(arithmetic[1]), role:'start', primary:true}, {object, count:Number(arithmetic[3]), role:arithmetic[2] === '+' ? 'add' : 'remove'}]; }
      }
    }
    for (const locale of ['en', 'lv', 'ru']) {
      const p = puzzles[locale][tier][index];
      if (question) p.question = question[locale];
      if (hint) p.hint = hint[locale];
      if (explanation) p.explanation = explanation[locale];
      if (contextObjects?.length) p.contextObjects = structuredClone(contextObjects);
      if (p.taskVisual && !p.taskVisual.object && /seedlings/.test(source.question)) { p.taskVisual.object = 'plant'; delete p.contextObjects; }
      if (p.taskVisual && !p.taskVisual.object && /planting spaces/.test(source.question)) { p.taskVisual.object = 'planting_tile'; delete p.contextObjects; }
      if (p.type === 'budget_plan') {
        const objects = ['book', 'plant', 'chair', 'mouse'];
        const labels = T(['Book','Plant','Chair','Toy mouse'], ['Grāmata','Augs','Krēsls','Rotaļu pele'], ['Книга','Растение','Стул','Игрушечная мышь'])[locale];
        p.payload.items.forEach((item, i) => { item.object = objects[i]; item.label = labels[i]; });
        p.hint = hints.budget[locale];
        const prices = p.payload.items.map(item => item.price * (100 - item.discountPercent) / 100);
        const pairs = prices.flatMap((price, i) => prices.slice(i + 1).filter(other => price + other === p.payload.budget - p.payload.remaining).map(other => `${price} + ${other} = ${p.payload.budget - p.payload.remaining}.`));
        p.explanation = prices.map((price, i) => `${labels[i]}: ${price}.`).join(' ') + ' ' + pairs.join(' ');
      }
    }
  }
}
