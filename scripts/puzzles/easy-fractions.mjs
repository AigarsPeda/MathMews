import pairsByStage from '../../data/easy-fraction-pairs.json' with { type: 'json' };

/** Revisit halves through different questions without introducing smaller parts. */
function varyIntroductoryHalves(byId, lv) {
  const text = (en, latvian) => lv ? latvian : en;
  const specs = {
    'v2-easy-fractions-parts-3': {
      type: 'compare', correctIndex: 1, payload: { optionA: '1/2', optionB: '2/2' },
      question: text('Which is more: one half or one whole?', 'Kas ir vairāk: viena puse vai viens vesels?'),
      explanation: text('A whole has 2 halves. It is more than 1 half.', 'Veselajam ir 2 puses. Tas ir vairāk nekā 1 puse.'),
    },
    'v2-easy-fractions-parts-4': {
      type: 'true_false', isTrue: true, payload: { statement: '1/2 + 1/2 = 1' },
      question: text('Do 2 halves make one whole?', 'Vai 2 puses veido vienu veselo?'),
      explanation: text('Yes. Put the 2 equal halves together to make one whole.', 'Jā. Saliec abas vienādās puses kopā, lai iegūtu vienu veselo.'),
    },
    'v2-easy-fractions-lesson-1-boss-1': {
      type: 'fraction_build', payload: { numerator: 2, denominator: 2, hideTarget: true },
      question: text('Color both equal parts to make one whole.', 'Iekrāso abas vienādās daļas, lai izveidotu vienu veselo.'),
      explanation: text('Both halves are colored. 2/2 is one whole.', 'Abas puses ir iekrāsotas. 2/2 ir viens vesels.'),
    },
    'v2-easy-fractions-lesson-1-boss-2': {
      type: 'multiple_choice', choices: ['1', '2', '3'], correctIndex: 1,
      question: text('How many halves make one whole?', 'Cik pušu veido vienu veselo?'),
      explanation: text('2 equal halves make one whole.', '2 vienādas puses veido vienu veselo.'),
    },
    'v2-easy-fractions-lesson-1-boss-3': {
      type: 'fraction_match', payload: { pairs: [
        { numerator: 1, denominator: 2, visual: 'grid' }, { numerator: 2, denominator: 2, visual: 'pie' },
      ] },
      question: text('Match one half and one whole to their pictures.', 'Savieno vienu pusi un vienu veselo ar to attēliem.'),
      explanation: text('1/2 colors one of the 2 equal parts. 2/2 colors both.', '1/2 iekrāso vienu no 2 vienādām daļām. 2/2 iekrāso abas.'),
    },
    'v2-easy-easy-fractions-parts-path-review-1': {
      type: 'true_false', isTrue: false, payload: { statement: '1/2 = 2/2' },
      question: text('Is one half the same amount as one whole?', 'Vai viena puse ir tikpat daudz kā viens vesels?'),
      explanation: text('No. 1/2 is one half; 2/2 is both halves.', 'Nē. 1/2 ir viena puse; 2/2 ir abas puses.'),
    },
    'v2-easy-easy-fractions-parts-path-review-2': {
      type: 'multiple_choice', choices: ['0/2', '1/2', '2/2'], correctIndex: 1,
      question: text('A cookie is split into 2 equal pieces. Eat one piece. What fraction is left?', 'Cepums sadalīts 2 vienādos gabalos. Vienu gabalu apēd. Kāda daļa paliek?'),
      explanation: text('One of the 2 equal pieces remains. That is 1/2.', 'Paliek viens no 2 vienādajiem gabaliem. Tā ir 1/2.'),
    },
  };
  for (const [id, spec] of Object.entries(specs)) {
    const p = byId.get(id), { difficulty, ageRange, learning } = p;
    for (const key of Object.keys(p)) delete p[key];
    Object.assign(p, { id, difficulty, ageRange, topic: 'fractions', ...spec,
      hint: text('Think of a whole split into 2 equal parts. Count how many parts you need.', 'Iedomājies veselo, kas sadalīts 2 vienādās daļās. Saskaiti, cik daļu vajag.'),
      helpTemplate: 'fraction_build',
      learning: { ...learning, representation: spec.type.startsWith('fraction') ? 'fraction-model' : 'symbols', reasoningSteps: 1 } });
  }
}

/** Varied halves first, then familiar pieces and simple equivalence in later Easy paths. */
export function simplifyEasyFractions({ puzzles, lessons, pathExtras }) {
  const track = lessons.filter(l => l.difficulty === 'easy' && l.topicId === 'fractions');
  for (const locale of ['en', 'lv']) {
    const lv = locale === 'lv', byId = new Map(puzzles[locale].easy.map(p => [p.id, p]));
    varyIntroductoryHalves(byId, lv);
    track.forEach((lesson, stage) => {
      if (stage < 4) return;
      const ids = [...['practice', 'boss', 'challenge'].flatMap(kind => lesson.levels.filter(l => l.kind === kind).flatMap(l => l.puzzleIds)), ...pathExtras[lesson.id]];
      ids.forEach((id, slot) => {
        const p = byId.get(id);
        if (p.type === 'fraction_equivalent') {
          const pairs = pairsByStage[stage];
          const variant = slot === 6 ? 1 : slot === 8 ? 2 : 0;
          const [n, d, answerN, answerD] = id === 'v2-easy-fractions-kite-2' ? [2, 6, 1, 3] : pairs[variant % pairs.length];
          const wrong = Array.from({ length: answerD + 1 }, (_, i) => i).filter(i => i !== answerN)
            .sort((a, b) => Math.abs(a - answerN) - Math.abs(b - answerN)).slice(0, 2);
          const correctIndex = (stage + slot) % 3, choices = wrong.map(i => `${i}/${answerD}`);
          choices.splice(correctIndex, 0, `${answerN}/${answerD}`);
          p.payload = { numerator: n, denominator: d, choices };
          p.correctIndex = correctIndex;
          p.question = lv ? 'Kura daļa rāda to pašu daudzumu?' : 'Which fraction shows the same amount?';
          p.hint = answerD > d
            ? (lv ? 'Iedomājies, ka katra daļa sadalīta uz pusēm. Iekrāsotais daudzums nemainās.' : 'Imagine splitting each piece in half. The shaded amount stays the same.')
            : (lv ? 'Apvieno katrus divus blakus gabaliņus vienā lielākā daļā. Daudzums nemainās.' : 'Join each pair of neighboring pieces into one larger piece. The amount stays the same.');
          p.explanation = `${n}/${d} = ${answerN}/${answerD}.`;
          p.helpTemplate = n * 3 === d ? 'easy_fraction_half' : 'fraction_equivalent';
          p.learning.reasoningSteps = 1;
        }
        if (p.type === 'compare') {
          const d = [4, 6, 8][(stage + slot) % 3], smaller = 1 + slot % (d - 2), greater = smaller + 1;
          const a = p.correctIndex === 0 ? greater : smaller, b = p.correctIndex === 1 ? greater : smaller;
          p.payload = { optionA: `${a}/${d}`, optionB: `${b}/${d}` };
          p.hint = lv ? 'Veselie un daļu lielumi ir vienādi. Salīdzini iekrāsoto daļu skaitu.' : 'The wholes and the piece sizes are equal. Compare how many pieces are shaded.';
          p.explanation = `${greater}/${d} > ${smaller}/${d}.`;
          p.helpTemplate = 'easy_fraction_compare';
        }
        if (p.type === 'fraction_build' && p.payload.denominator === 7) {
          p.payload = { numerator: 3, denominator: stage % 2 ? 4 : 6 };
          const { numerator: n, denominator: d } = p.payload;
          p.question = lv ? `Iekrāso ${n} no ${d} vienādām daļām: ${n}/${d}.` : `Color ${n} of the ${d} equal parts: ${n}/${d}.`;
          p.explanation = lv ? `${n} no ${d} vienādām daļām ir ${n}/${d}.` : `${n} out of ${d} equal parts is ${n}/${d}.`;
        }
        if (p.type === 'fraction_strip') p.helpTemplate = p.payload.mode === 'equivalent' ? 'fraction_equivalent' : 'fraction_build';
        if (p.type === 'sort_buckets' && stage >= 6) {
          // Four cards, two familiar amounts. Avoid six-card scaling problems.
          const boards = {
            6: { targets: [[1, 2], [1, 3]], fractions: [[1, 3], [2, 4], [2, 6], [1, 2]] },
            7: { targets: [[1, 4], [3, 4]], fractions: [[3, 4], [2, 8], [1, 4], [6, 8]] },
            8: { targets: [[1, 2], [1, 3]], fractions: [[2, 6], [1, 2], [1, 3], [2, 4]] },
            9: { targets: [[1, 2], [3, 4]], fractions: [[3, 4], [2, 4], [6, 8], [1, 2]] },
          };
          const board = boards[stage], [a, b] = board.targets.map(f => f.join('/'));
          p.payload = { rule: 'fractions', ...structuredClone(board) };
          p.question = lv ? `Sašķiro katru daļu pēc vērtības: ${a} vai ${b}.` : `Sort every fraction by value: ${a} or ${b}.`;
          p.hint = lv ? 'Izmanto pazīstamos pārus. Sadalot katru gabaliņu uz pusēm, daudzums nemainās.' : 'Use the familiar pairs. Splitting each piece in half keeps the same amount.';
          p.explanation = stage === 6 || stage === 8 ? '1/2 = 2/4; 1/3 = 2/6.' : stage === 7 ? '1/4 = 2/8; 3/4 = 6/8.' : '1/2 = 2/4; 3/4 = 6/8.';
        }
      });
    });
  }
}
