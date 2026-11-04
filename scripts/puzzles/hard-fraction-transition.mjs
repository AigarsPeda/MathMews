import plan from '../../data/hard-fraction-transition.json' with { type: 'json' };

function equivalent(p, [n, d, a, b], lv, index) {
  const wrong = Array.from({ length: b + 1 }, (_, i) => i).filter(i => i !== a)
    .sort((x, y) => Math.abs(x - a) - Math.abs(y - a)).slice(0, 2);
  const choices = wrong.map(i => `${i}/${b}`);
  choices.splice(index, 0, `${a}/${b}`);
  p.payload = { numerator: n, denominator: d, choices }; p.correctIndex = index;
  p.question = lv ? 'Kura daļa rāda to pašu daudzumu?' : 'Which fraction shows the same amount?';
  const factor = Math.max(d, b) / Math.min(d, b);
  p.hint = b > d
    ? (lv ? `Sadali katru daļu ${factor} vienādās daļās. Reizini gan skaitītāju, gan saucēju ar ${factor}.` : `Split each part into ${factor} equal pieces. Multiply both the numerator and denominator by ${factor}.`)
    : (lv ? `Dali gan skaitītāju, gan saucēju ar ${factor}.` : `Divide both the numerator and denominator by ${factor}.`);
  p.explanation = `${n}/${d} = ${a}/${b}.`;
  p.helpTemplate = n * 3 === d ? 'easy_fraction_half' : 'fraction_equivalent';
}

function compare(p, greater, smaller, lv, help, common) {
  p.payload = { optionA: (p.correctIndex === 0 ? greater : smaller).join('/'), optionB: (p.correctIndex === 1 ? greater : smaller).join('/') };
  p.explanation = `${greater.join('/')} > ${smaller.join('/')}.`;
  p.helpTemplate = help;
  if (common) p.hint = lv ? `Izmanto vienāda lieluma veselos. Izsaki abas daļas ar saucēju ${common} un salīdzini skaitītājus.`
    : `Use equal-sized wholes. Rewrite both fractions with denominator ${common}, then compare their numerators.`;
  else if (help === 'fraction_compare_half') p.hint = lv ? 'Salīdzini katru daudzumu ar pusi no tā paša veselā.' : 'Compare each amount with half of the same whole.';
}

export function smoothHardFractions({ puzzles, lessons, pathExtras }) {
  const track = lessons.filter(l => l.difficulty === 'hard' && l.topicId === 'fractions');
  for (const locale of ['en', 'lv']) {
    const lv = locale === 'lv', byId = new Map(puzzles[locale].hard.map(p => [p.id, p]));
    plan.opening.forEach((stagePlan, stage) => {
      const lesson = track[stage];
      const ids = [...['practice', 'boss', 'challenge'].flatMap(kind => lesson.levels.filter(l => l.kind === kind).flatMap(l => l.puzzleIds)), ...pathExtras[lesson.id]];
      ids.forEach((id, slot) => {
        const p = byId.get(id), variant = slot < 4 ? 0 : slot < 7 ? 1 : 2;
        if (p.type === 'multiple_choice') {
          const [n, d, total] = plan.amounts[stage][variant], each = total / d, answer = each * n;
          const rank = (stage + slot) % 3;
          p.choices = [answer - rank, answer + 1 - rank, answer + 2 - rank].map(String); p.correctIndex = rank;
          p.question = lv ? `Paplātē ir ${total} stādi. ${n}/${d} ir puķes. Cik puķu?` : `A tray has ${total} seedlings. ${n}/${d} are flowers. How many flowers?`;
          p.hint = n === 1
            ? (lv ? `Sadali stādus ${d} vienādās grupās. Saskaiti stādus vienā grupā.` : `Share the seedlings into ${d} equal groups. Count the seedlings in one group.`)
            : (lv ? `Sadali stādus ${d} vienādās grupās. Saskaiti stādus ${n} grupās.` : `Share the seedlings into ${d} equal groups. Count the seedlings in ${n} groups.`);
          p.explanation = `${total} ÷ ${d} = ${each}${n === 1 ? '.' : `; ${each} × ${n} = ${answer}.`}`;
          p.helpTemplate = n === 1 ? 'fraction_unit_set' : 'fraction_of_set';
          if (stage === 0 || stage === 1 && variant === 0) p.taskVisual = { kind: 'share', items: total, groups: d };
          else delete p.taskVisual;
          p.learning.representation = p.taskVisual ? 'objects' : 'symbols';
          p.learning.reasoningSteps = n === 1 ? 1 : 2;
        }
        if (p.type === 'fraction_equivalent') equivalent(p, stagePlan.equivalents[variant], lv, (stage + slot) % 3);
        if (p.type === 'fraction_match') p.payload.pairs = stagePlan.matches[variant].map(([numerator, denominator], i) => ({ numerator, denominator, visual: i ? 'grid' : 'pie' }));
        if (p.type === 'compare') compare(p, ...stagePlan.comparison, lv,
          stage === 0 ? 'fraction_compare_same_numerator' : stage === 1 ? 'fraction_compare_half' : 'fraction_compare_common', stage === 2 ? 6 : stage === 3 ? 12 : undefined);
      });
    });

    // Reconnect the decimal block to familiar fractions before the Hard entry.
    const medium = new Map(puzzles[locale].medium.map(p => [p.id, p]));
    const first = medium.get('v2-medium-fractions-explore-10-1');
    delete first.payload;
    Object.assign(first, { type: 'multiple_choice', question: lv ? 'Kura daļa ir vienāda ar 0,6?' : 'Which fraction equals 0.6?',
      choices: ['3/5', '1/5', '1/2'], correctIndex: 0,
      hint: lv ? 'Izsaki decimāldaļu desmitdaļās, tad saīsini daļu.' : 'Write the decimal as tenths, then simplify the fraction.',
      explanation: lv ? '0,6 = 6/10 = 3/5.' : '0.6 = 6/10 = 3/5.', helpTemplate: 'fraction_decimal_link' });
    first.learning.representation = 'symbols'; first.learning.reasoningSteps = 2;
    compare(medium.get('v2-medium-fractions-explore-10-2'), [3,4], [5,8], lv, 'fraction_compare_common', 8);
    compare(medium.get('v2-medium-medium-fractions-explore-10-path-review-2'), [2,3], [3,6], lv, 'fraction_compare_common', 6);
    equivalent(medium.get('v2-medium-fractions-explore-10-4'), [9,15,3,5], lv, 1);
    equivalent(medium.get('v2-medium-fractions-fountain-2'), [9,24,3,8], lv, 2);
    const challenge = medium.get('v2-medium-fractions-expedition-10-1');
    challenge.payload = { rule: 'fractions', targets: [[1,6],[5,6]], fractions: [[2,12],[10,12],[3,18],[15,18],[4,24],[20,24]] };
    challenge.question = lv ? 'Sašķiro daļas pēc vērtības: 1/6 vai 5/6.' : 'Sort the fractions by value: 1/6 or 5/6.';
    challenge.explanation = '1/6 = 2/12 = 3/18 = 4/24; 5/6 = 10/12 = 15/18 = 20/24.';
  }
}
