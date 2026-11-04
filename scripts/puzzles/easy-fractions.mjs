import pairsByStage from '../../data/easy-fraction-pairs.json' with { type: 'json' };

/** Familiar pieces and one equivalence step throughout the later Easy paths. */
export function simplifyEasyFractions({ puzzles, lessons, pathExtras }) {
  const track = lessons.filter(l => l.difficulty === 'easy' && l.topicId === 'fractions');
  for (const locale of ['en', 'lv']) {
    const lv = locale === 'lv', byId = new Map(puzzles[locale].easy.map(p => [p.id, p]));
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
