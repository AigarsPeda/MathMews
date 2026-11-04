import plans from '../../data/medium-fraction-transition.json' with { type: 'json' };

/** Reuse Easy's familiar amounts before extending comparison and equivalence. */
export function smoothMediumFractions({ puzzles, lessons, pathExtras }) {
  const track = lessons.filter(l => l.difficulty === 'medium' && l.topicId === 'fractions');
  for (const locale of ['en', 'lv']) {
    const lv = locale === 'lv', byId = new Map(puzzles[locale].medium.map(p => [p.id, p]));
    plans.forEach((plan, stage) => {
      const lesson = track[stage];
      const ids = [...['practice', 'boss', 'challenge'].flatMap(kind => lesson.levels.filter(l => l.kind === kind).flatMap(l => l.puzzleIds)), ...pathExtras[lesson.id]];
      ids.forEach((id, slot) => {
        const p = byId.get(id), variant = slot < 4 ? 0 : slot < 7 ? 1 : 2;
        if (p.type === 'fraction_build') {
          const [n, d] = plan.builds[variant];
          p.payload = { numerator: n, denominator: d };
          p.question = lv ? `Iekrāso ${n}/${d} no veselā.` : `Color ${n}/${d} of this whole.`;
          p.explanation = lv ? `${n} no ${d} vienādām daļām ir ${n}/${d}.` : `${n} out of ${d} equal parts is ${n}/${d}.`;
        }
        if (p.type === 'fraction_match') p.payload.pairs = plan.matches.map(([numerator, denominator], i) => ({ numerator, denominator, visual: i ? 'grid' : 'pie' }));
        if (p.type === 'fraction_equivalent') {
          const [n, d, answerN, answerD] = plan.equivalents[variant];
          const wrong = Array.from({ length: answerD + 1 }, (_, i) => i).filter(i => i !== answerN)
            .sort((a, b) => Math.abs(a - answerN) - Math.abs(b - answerN)).slice(0, 2);
          const choices = wrong.map(i => `${i}/${answerD}`), correctIndex = (stage + slot) % 3;
          choices.splice(correctIndex, 0, `${answerN}/${answerD}`);
          p.payload = { numerator: n, denominator: d, choices }; p.correctIndex = correctIndex;
          p.question = lv ? 'Kura daļa rāda to pašu daudzumu?' : 'Which fraction shows the same amount?';
          const factor = Math.max(d, answerD) / Math.min(d, answerD);
          p.hint = answerD > d
            ? (lv ? `Sadali katru daļu ${factor} vienādās daļās. Reizini gan skaitītāju, gan saucēju ar ${factor}.` : `Split each part into ${factor} equal pieces. Multiply both the numerator and denominator by ${factor}.`)
            : (lv ? `Dali gan skaitītāju, gan saucēju ar ${factor}.` : `Divide both the numerator and denominator by ${factor}.`);
          p.explanation = `${n}/${d} = ${answerN}/${answerD}.`;
          p.helpTemplate = n * 3 === d ? 'easy_fraction_half' : 'fraction_equivalent';
          p.learning.reasoningSteps = 1;
        }
        if (p.type === 'compare') {
          const [greater, smaller] = plan.comparisons[variant];
          p.payload = { optionA: (p.correctIndex === 0 ? greater : smaller).join('/'), optionB: (p.correctIndex === 1 ? greater : smaller).join('/') };
          p.explanation = `${greater.join('/')} > ${smaller.join('/')}.`;
          p.hint = stage < 2
            ? (lv ? 'Veselie un daļu lielumi ir vienādi. Salīdzini iekrāsoto daļu skaitu.' : 'The wholes and the piece sizes are equal. Compare how many pieces are shaded.')
            : stage < 4
              ? (lv ? 'Veselie ir vienādi. Ja ņemts vienāds daļu skaits, tad mazāks saucējs nozīmē lielākas daļas.' : 'The wholes are equal. With the same number of pieces, fewer pieces in the whole means larger pieces.')
              : (lv ? 'Salīdzini katru daudzumu ar pusi no tā paša veselā.' : 'Compare each amount with half of the same whole.');
          p.helpTemplate = stage < 2 ? 'easy_fraction_compare' : stage === 2 ? 'fraction_compare_unit' : stage === 3 ? 'fraction_compare_same_numerator' : 'fraction_compare_half';
        }
        if (p.type === 'sort_buckets') {
          const [a, b] = plan.targets.map(f => f.join('/'));
          p.payload = { rule: 'fractions', targets: structuredClone(plan.targets), fractions: plan.sortFactors.flatMap(k => plan.targets.map(([n, d]) => [n * k, d * k])) };
          p.question = lv ? `Sašķiro daļas pēc vērtības: ${a} vai ${b}.` : `Sort the fractions by value: ${a} or ${b}.`;
          p.explanation = plan.targets.map(([n, d]) => plan.sortFactors.map(k => `${n * k}/${d * k}`).join(' = ')).join('; ') + '.';
        }
        if (p.type === 'fraction_strip') p.helpTemplate = 'fraction_equivalent';
      });
    });
  }
}
