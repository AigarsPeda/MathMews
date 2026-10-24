/** Eight additional lessons for each existing topic/difficulty track. Stable, deterministic IDs. */
const titles = {
  addition: [['More ways to make a total','Vairāk veidu, kā iegūt summu'],['Across the next ten','Pāri nākamajam desmitam'],['Missing addends','Trūkstošie saskaitāmie'],['Pairs and totals','Pāri un summas'],['Check the packing list','Pārbaudi sarakstu'],['Repair a sum','Izlabo summu'],['Numbers in a story','Skaitļi stāstā'],['Addition explorer','Saskaitīšanas pētnieks']],
  subtraction: [['What stays behind?','Kas paliek pāri?'],['Back along the trail','Atpakaļ pa taku'],['Compare what remains','Salīdzini atlikumus'],['Missing differences','Trūkstošās starpības'],['Check the supplies','Pārbaudi krājumus'],['Repair a difference','Izlabo starpību'],['Take away in stories','Atņemšana stāstos'],['Subtraction explorer','Atņemšanas pētnieks']],
  numbers: [['Between the markers','Starp atzīmēm'],['Compare the shelves','Salīdzini plauktus'],['Order the deliveries','Sakārto piegādes'],['Find a place on the line','Atrodi vietu uz taisnes'],['Numbers in the middle','Skaitļi pa vidu'],['A different order','Cita secība'],['Follow the number trail','Seko skaitļu takai'],['Number explorer','Skaitļu pētnieks']],
  patterns: [['New gaps to discover','Atklāj jaunas atstarpes'],['Patterns that shrink','Virknes, kas sarūk'],['Rules in machines','Likumi mašīnās'],['Repair the missing terms','Atjauno trūkstošos locekļus'],['Changes in both directions','Izmaiņas abos virzienos'],['Choose a different rule','Izvēlies citu likumu'],['Read the hidden rhythm','Atklāj slēpto ritmu'],['Pattern explorer','Virkņu pētnieks']],
  multiplication: [['Rows in the workshop','Rindas darbnīcā'],['More groups, new totals','Vairāk grupu, jaunas summas'],['The missing group size','Trūkstošais grupas lielums'],['Machines and groups','Mašīnas un grupas'],['Check the equal rows','Pārbaudi vienādās rindas'],['Arrange a bigger display','Izvieto lielāku izstādi'],['Connected group facts','Saistītas grupu vienādības'],['Equal-group explorer','Vienādu grupu pētnieks']],
  division: [['Another fair delivery','Vēl viena vienāda piegāde'],['How much in each group?','Cik katrā grupā?'],['Whole groups first','Vispirms veselas grupas'],['Plan for the leftovers','Ieplāno atlikumu'],['Check the sharing plan','Pārbaudi dalīšanas plānu'],['A different number of groups','Cits grupu skaits'],['Share and compare','Sadali un salīdzini'],['Division explorer','Dalīšanas pētnieks']],
  fractions: [['Read the same whole','Nolasi to pašu veselo'],['Parts in different pictures','Daļas dažādos attēlos'],['Compare colored amounts','Salīdzini iekrāsotos daudzumus'],['Smaller pieces, same value','Sīkākas daļas, tā pati vērtība'],['Match another model','Savieno citu modeli'],['Choose equivalent parts','Izvēlies vienādas daļas'],['Fractions in a collection','Daļas kolekcijā'],['Fraction explorer','Daļu pētnieks']],
  operations: [['Another delivery route','Vēl viens piegādes ceļš'],['Order matters','Secība ir svarīga'],['A target with several steps','Mērķis vairākos soļos'],['Connect the machines','Savieno mašīnas'],['Compare two routes','Salīdzini divus ceļus'],['Plan before you calculate','Plāno pirms rēķināšanas'],['Operations in a new order','Darbības jaunā secībā'],['Number-route explorer','Skaitļu ceļu pētnieks']],
  percentages: [['Parts out of a hundred','Daļas no simta'],['Another sale day','Vēl viena atlaižu diena'],['Compare price changes','Salīdzini cenu izmaiņas'],['Check the discount label','Pārbaudi atlaides etiķeti'],['A different original price','Cita sākotnējā cena'],['Repair the receipt','Izlabo čeku'],['Percentage connections','Procentu sakarības'],['Percentage explorer','Procentu pētnieks']],
  measurement: [['A new garden plan','Jauns dārza plāns'],['Scale the supplies','Pārrēķini krājumus'],['Estimate the whole order','Novērtē visu pasūtījumu'],['Find the missing dimension','Atrodi trūkstošo izmēru'],['Rows, bags and units','Rindas, maisi un mērvienības'],['Another building project','Vēl viens būvniecības darbs'],['Compare useful measurements','Salīdzini noderīgus mērījumus'],['Measurement explorer','Mērījumu pētnieks']],
  logic: [['Every clue matters','Katra norāde ir svarīga'],['Even and odd claims','Apgalvojumi par pāra un nepāra skaitļiem'],['Test a general rule','Pārbaudi vispārīgu likumu'],['Which amount is possible?','Kurš daudzums ir iespējams?'],['Look for a counterexample','Meklē pretpiemēru'],['Order the evidence','Sakārto pierādījumus'],['Check all the conditions','Pārbaudi visus nosacījumus'],['Reasoning explorer','Spriešanas pētnieks']],
};

export function expandLessons(api) {
  const { lessons, lesson, special, text, task, choice, practiceSet, addSet, subtractSet, numberSet, patternSet,
    multiplySet, divideSet, fractionSet, operationSet, percentSet, measureSet, logicSet } = api;
  const tracks = [...new Map(lessons.map(l => [`${l.difficulty}/${l.topicId}`, l])).values()];
  const note = text('Use new examples to connect the topic’s ideas. Check each answer before moving on.', 'Saisti tēmas prasmes jaunos piemēros. Pārbaudi katru atbildi pirms nākamā uzdevuma.');
  for (const track of tracks) for (let r = 0; r < 8; r++) {
    const { difficulty: d, topicId: topic } = track;
    const args = Array.from({length:4}, (_, j) => {
      const s = r*4+j+9;
      switch (topic) {
        case 'addition': return d === 'easy' ? [2+s*3%10, 2+s*7%9] : [15+s*13%64, 11+s*17%51];
        case 'subtraction': return d === 'easy' ? [10+s*7%15, 2+s*5%8] : [45+s*11%55, 12+s*7%29];
        case 'numbers': { const low=1+s*7%10, a=1+s%3, b=a+2+s%2; return [[low+b+3,low,low+b,low+a]]; }
        case 'multiplication': return d === 'easy' ? [2+s*3%5, 2+s*5%6, s%2===0] : [3+s*3%8, 3+s*5%9, s%2===0];
        case 'division': { const groups=3+s%(j===0?3:7), each=3+s*7%(j===0?4:9); return [groups*each+(s%3===0?0:1+s%(groups-1)),groups]; }
        case 'fractions': { const pairs=[]; for(let den=3;den<=(d==='hard'?16:12);den++) for(let num=1;num<den-1;num++) pairs.push([num,den,d==='hard']); return pairs[(s*7)%pairs.length]; }
        case 'operations': { const divisor=2+s*5%8, quotient=3+s*7%13; return [divisor*quotient,divisor,2+s*11%12,d!=='hard']; }
        case 'percentages': return [20*(3+s*3%19),[10,20,25,50][(r+j)%4],s%2===0];
        case 'measurement': return [5+s*3%14,3+s*5%9];
        case 'logic': return [2*(10+s),s%2?'multiply':'subtract'];
        default: return [];
      }
    });
    // Commutative facts must also differ: 2 + 9 cannot follow 9 + 2.
    if(topic==='addition' || topic==='multiplication') {
      const used=new Set();
      for(const example of args) {
        const key=()=>example.slice(0,2).sort((a,b)=>a-b).join(',');
        while(used.has(key())) example[1]++;
        used.add(key());
      }
    }
    const factories = {addition:addSet,subtraction:subtractSet,numbers:numberSet,multiplication:multiplySet,division:divideSet,fractions:fractionSet,operations:operationSet,percentages:percentSet,measurement:measureSet,logic:logicSet};
    let tasks;
    if(topic==='patterns') {
      const a=2+r%4,b=a+1;
      tasks=patternSet(d==='hard'
        ? [[2+r,'×',2+r%3],[13+r,'+',7+r],[Math.pow(2+r%3,4)*(r+2),'÷',2+r%3],[(r+3)*5+r,'−',r+3]]
        : [[1+r,'+',a],[8+r,'+',b],[a*6+r,'−',a],[b*6+r,'−',b]]);
    } else tasks=practiceSet(factories[topic],args);
    if(topic==='logic') tasks[1]=logicClaim(r,args[1][0],text,task);
    if(topic==='addition' || topic==='subtraction') tasks[0]=arithmeticStory(topic,args[0],r,text,choice);
    const id=lesson(d,topic,`explore-${r+3}`,text(...titles[topic][r]),note,tasks);
    if(r===2 || r===7) {
      const spec=challengeSpec(topic,d,r,text,task);
      special(id,`expedition-${r+3}`,'challenge',text(`${titles[topic][r][0]}: against the clock`,`${titles[topic][r][1]}: sacensība ar laiku`),
        text('Complete the whole board before time runs out. Check your choices carefully.', 'Pabeidz visu laukumu, pirms beidzas laiks. Rūpīgi pārbaudi savas izvēles.'),[spec]);
    }
  }
}

function arithmeticStory(topic,[a,b],r,text,choice) {
  const add=topic==='addition', answer=add?a+b:a-b;
  const questions=add ? [
    text(`${a} toy mice are on the shelf and ${b} more arrive. How many mice now?`, `Plauktā ir ${a} rotaļu peles, un atnes vēl ${b}. Cik peļu tagad?`),
    text(`Minka collects ${a} shells in the morning and ${b} in the afternoon. How many shells?`, `Minka no rīta savāc ${a} gliemežvākus un pēcpusdienā ${b}. Cik gliemežvāku kopā?`),
    text(`One picnic basket has ${a} cookies and another has ${b}. How many cookies altogether?`, `Vienā piknika grozā ir ${a} cepumi, bet otrā ${b}. Cik cepumu pavisam?`),
    text(`${a} books are already packed. Add another box of ${b} books. How many books are packed?`, `Ir sapakotas ${a} grāmatas. Pievieno vēl kasti ar ${b} grāmatām. Cik grāmatu sapakots?`),
  ] : [
    text(`${a} toy mice are in a basket. The cat takes ${b}. How many stay?`, `Grozā ir ${a} rotaļu peles. Kaķis paņem ${b}. Cik paliek?`),
    text(`A tree has ${a} paper leaves. ${b} blow away. How many remain?`, `Kokā ir ${a} papīra lapas. ${b} aizpūš vējš. Cik paliek?`),
    text(`The bakery makes ${a} cookies and sells ${b}. How many cookies are left?`, `Ceptuve izcep ${a} cepumus un pārdod ${b}. Cik cepumu paliek?`),
    text(`The library has ${a} books ready. ${b} are borrowed. How many are still there?`, `Bibliotēkā ir sagatavotas ${a} grāmatas. ${b} aizņemas. Cik vēl paliek?`),
  ];
  return choice(topic,questions[r%4],answer,[answer+1,answer+2],text('Track what is added or taken away.', 'Seko tam, ko pievieno vai atņem.'),text(`${a} ${add?'+':'−'} ${b} = ${answer}.`,`${a} ${add?'+':'−'} ${b} = ${answer}.`));
}

function logicClaim(r,n,text,task) {
  const claims=[
    ['Adding two even numbers always gives an even total. Is that true?','Divu pāra skaitļu summa vienmēr ir pāra skaitlis. Vai tā ir?',true,`${n} + 2 = ${n+2}`],
    ['An odd number plus an even number is always odd. Is that true?','Nepāra skaitlis plus pāra skaitlis vienmēr ir nepāra skaitlis. Vai tā ir?',true,`${n+1} + 2 = ${n+3}`],
    ['Every multiple of four is even. Is that true?','Katrs četru daudzkārtnis ir pāra skaitlis. Vai tā ir?',true,`4 × ${n} = ${4*n}`],
    ['Every number divisible by six is also divisible by three. Is that true?','Katrs skaitlis, kas dalās ar seši, dalās arī ar trīs. Vai tā ir?',true,`${6*n} ÷ 3 = ${2*n}`],
    ['Two odd numbers always add to an odd total. Is that true?','Divu nepāra skaitļu summa vienmēr ir nepāra skaitlis. Vai tā ir?',false,`${n+1} + 3 = ${n+4}`],
    ['Multiplying by zero always leaves the number unchanged. Is that true?','Reizinot ar nulli, skaitlis vienmēr paliek nemainīgs. Vai tā ir?',false,`${n} × 0 = 0`],
    ['Every even number is divisible by four. Is that true?','Katrs pāra skaitlis dalās ar četri. Vai tā ir?',false,`${4*n+2} = 4 × ${n} + 2`],
    ['Dividing a positive whole number by one makes it smaller. Is that true?','Dalot pozitīvu veselu skaitli ar viens, tas kļūst mazāks. Vai tā ir?',false,`${n} ÷ 1 = ${n}`],
  ];
  const [en,lv,isTrue,example]=claims[r];
  const statement=isTrue?example:r===4?`${n+1} + 3 > ${n+4}`:r===5?`${n} × 0 = ${n}`:r===6?`${4*n+2} ÷ 4 = ${n}`:`${n} ÷ 1 = ${n-1}`;
  return task('true_false','logic',text(en,lv),{statement,hideStatement:true},text('Look for a reason that works for every allowed number, or a counterexample.', 'Meklē pamatojumu visiem atļautajiem skaitļiem vai pretpiemēru.'),text(`${isTrue?'True':'False'}. ${example}.`,`${isTrue?'Pareizi':'Nepareizi'}. ${example}.`),{isTrue});
}

export function challengeSpec(topic,d,r,text,task) {
  const help=text('Try one part, then check the whole board.', 'Izmēģini vienu daļu, tad pārbaudi visu laukumu.');
  const done=text('Every part fits the conditions.', 'Katra daļa atbilst nosacījumiem.');
  if(topic==='addition') {
    const target=(d==='easy'?12:30)+r, numbers=[1,3,5,target-1,target-3,target-5];
    return task('find_all_pairs','addition',text(`Find every pair adding to ${target}. A tile may be used in different pairs.`,`Atrodi visus pārus, kuru summa ir ${target}. Kartīti drīkst izmantot dažādos pāros.`),{numbers,target},help,done,{helpTemplate:'all_pairs'});
  }
  if(['subtraction','multiplication','division','patterns'].includes(topic)) {
    const step=2+r%4;
    const scale=r>=10?1+Math.floor(r/4):1;
    const sequence=topic==='division' || topic==='patterns' && d==='hard' ? [step**4,step**3,step**2,step,1].map(n=>n*scale)
      : topic==='subtraction' ? Array.from({length:5},(_,i)=>(6-i)*step+r)
      : Array.from({length:5},(_,i)=>(i+1)*step+r);
    const solution=[sequence[1],sequence[3]];
    return task('repair_pattern',topic==='division'?'division':topic==='multiplication'?'multiplication':topic==='subtraction'?'subtraction':'patterns',text('Repair both gaps. Use each tile at most once; leave the spare tiles.', 'Atjauno abas vietas. Katru kartīti izmanto ne vairāk kā vienreiz; atstāj liekās kartītes.'),{sequence:sequence.map((n,i)=>i===1||i===3?null:n),tiles:[solution[1],sequence[0]+1,solution[0],sequence[4]+2],solution},help,done);
  }
  if(topic==='fractions') {
    const denominator=4+r-10, a=r>=10?[1,denominator]:r===2?[1,3]:[2,5], b=r>=10?[denominator-1,denominator]:r===2?[2,3]:[3,5];
    return task('sort_buckets','fractions',text(`Sort every fraction by value: ${a.join('/')} or ${b.join('/')}.`,`Sašķiro katru daļu pēc vērtības: ${a.join('/')} vai ${b.join('/')}.`),{rule:'fractions',targets:[a,b],fractions:[2,3,4].flatMap(k=>[[a[0]*k,a[1]*k],[b[0]*k,b[1]*k]])},help,done,{helpTemplate:'fraction_sort'});
  }
  if(topic==='operations' || topic==='logic') {
    const divisor=3+r%3, quotient=5+r, extra=2+r, start=divisor*quotient, target=(quotient+extra)*2;
    return task('route_grid','operations',text(`Reach the bottom-right exit with ${target} in exactly 3 moves. Start with ${start}.`,`Sasniedz apakšējo labo izeju ar ${target} tieši 3 soļos. Sāc ar ${start}.`),{columns:3,start,target,moves:3,cells:[null,{operator:'÷',operand:divisor},{operator:'+',operand:extra},{operator:'-',operand:1},{operator:'+',operand:7},{operator:'×',operand:2}]},help,done);
  }
  if(topic==='percentages') {
    const prices=[80,100,120,140].map(n=>n+r*20), remaining=20, budget=(prices[0]+prices[3])*.8+remaining;
    const payload=locale=>({budget,remaining,pickCount:2,items:prices.map((price,i)=>({label:locale==='en'?['Blanket','Cushion','Lamp','Basket'][i]:['Sega','Spilvens','Lampa','Grozs'][i],price,discountPercent:20}))});
    return task('budget_plan','fractions',text('Choose two supplies and leave the stated amount after discounts. More than one plan can work.', 'Izvēlies divus krājumus un pēc atlaidēm atstāj norādīto summu. Var derēt vairāki plāni.'),{en:payload('en'),lv:payload('lv')},help,done,{helpTemplate:'budget_plan'});
  }
  const boundary=(topic==='numbers'?10:50)+r, numbers=[boundary+3,boundary-4,boundary,boundary-1,boundary+7,boundary-6];
  return task('sort_buckets','comparison',topic==='measurement'
    ? text(`Sort the lengths in centimetres: below ${boundary} or at least ${boundary}.`,`Sašķiro garumus centimetros: zem ${boundary} vai vismaz ${boundary}.`)
    : text(`Sort every number: below ${boundary} or at least ${boundary}.`,`Sašķiro visus skaitļus: zem ${boundary} vai vismaz ${boundary}.`),{rule:'range',numbers,boundary},help,done);
}
