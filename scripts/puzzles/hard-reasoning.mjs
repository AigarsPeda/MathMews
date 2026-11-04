/** Replace Hard sorting with reasoning while retaining saved puzzle identities. */
const text = (en, lv) => ({ en, lv });

function choices(puzzle, answer, wrong, ordinal) {
  const values = [...wrong];
  const correctIndex = ordinal % 3;
  values.splice(correctIndex, 0, answer);
  puzzle.choices = values.map(String);
  puzzle.correctIndex = correctIndex;
}

function reasoningTask(stage, boss, locale, finale) {
  const variant = boss ? 1 : 0;
  if (stage < 3 || finale) {
    const divisor = finale ? 7 : 3 + 2 * stage;
    const answer = finale ? 84 : divisor * (4 + 2 * stage + 2 * variant);
    const lower = answer - divisor, upper = answer + 2 * divisor;
    return {
      answer, wrong: [answer + divisor, upper], helpTemplate: 'number_range',
      question: text(
        `The code is greater than ${lower}, less than ${upper}, divisible by ${divisor}, and even. Which number fits every clue?`,
        `Kods ir lielāks par ${lower}, mazāks par ${upper}, dalās ar ${divisor} un ir pāra skaitlis. Kurš skaitlis atbilst visām norādēm?`)[locale],
      hint: text('Find the multiples inside the range, then check which are even. The endpoints are excluded.',
        'Atrodi daudzkārtņus dotajā intervālā un pārbaudi, kuri ir pāra skaitļi. Robežskaitļi neder.')[locale],
      explanation: text(
        `${answer} and ${answer + divisor} are the multiples strictly inside the range. Only ${answer} is even; ${upper} is excluded.`,
        `${answer} un ${answer + divisor} ir daudzkārtņi stingri starp robežām. Tikai ${answer} ir pāra skaitlis; ${upper} neder.`)[locale],
    };
  }
  if (stage < 6) {
    const answer = 9 + stage * 2 + variant * 3, factor = stage - 1, extra = 5 + stage + variant;
    const result = answer * factor + extra;
    return {
      answer, wrong: [answer * factor, answer + extra], helpTemplate: 'operation_path',
      question: text(
        `A machine multiplies a starting number by ${factor}, then adds ${extra}. The result is ${result}. What was the starting number?`,
        `Mašīna reizina sākuma skaitli ar ${factor}, tad pieskaita ${extra}. Rezultāts ir ${result}. Kāds bija sākuma skaitlis?`)[locale],
      hint: text('Work backwards: undo the addition first, then undo the multiplication. Check by running the steps forwards.',
        'Risini no beigām: vispirms atcel saskaitīšanu, tad reizināšanu. Pārbaudi, veicot darbības uz priekšu.')[locale],
      explanation: `${result} − ${extra} = ${answer * factor}; ${answer * factor} ÷ ${factor} = ${answer}. ${answer} × ${factor} + ${extra} = ${result}.`,
    };
  }
  const answer = 12 + stage + variant * 4, difference = 4 + 2 * (stage - 6) + variant * 2;
  const total = 2 * answer + difference;
  return {
    answer, wrong: [answer + difference, total / 2], helpTemplate: 'balance',
    question: text(
      `Two boxes hold ${total} stars altogether. The larger box has ${difference} more stars than the smaller box. How many are in the smaller box?`,
      `Divās kastēs kopā ir ${total} zvaigznes. Lielākajā kastē ir par ${difference} zvaigznēm vairāk nekā mazākajā. Cik zvaigžņu ir mazākajā kastē?`)[locale],
    hint: text('Remove the extra stars from the total, then split what remains equally between the two boxes.',
      'No kopskaita atņem papildu zvaigznes, tad atlikušo sadali vienādi starp abām kastēm.')[locale],
    explanation: text(
      `${total} − ${difference} = ${2 * answer}; ${2 * answer} ÷ 2 = ${answer}. The boxes hold ${answer} and ${answer + difference}, with total ${total} and difference ${difference}.`,
      `${total} − ${difference} = ${2 * answer}; ${2 * answer} ÷ 2 = ${answer}. Kastēs ir ${answer} un ${answer + difference} zvaigznes, kopā ${total}, un starpība ir ${difference}.`)[locale],
  };
}

export function applyHardReasoning({ puzzles, lessons, pathExtras }) {
  const track = lessons.filter(l => l.difficulty === 'hard' && l.topicId === 'logic');
  for (const locale of ['en', 'lv']) {
    const byId = new Map(puzzles[locale].hard.map(p => [p.id, p]));
    track.forEach((lesson, stage) => {
      const entries = lesson.levels.flatMap(level => level.puzzleIds.map(id => ({ id, boss: level.kind === 'boss' })));
      entries.push(...pathExtras[lesson.id].map(id => ({ id, boss: false })));
      for (const { id, boss } of entries) {
        const p = byId.get(id);
        if (p.type === 'order_numbers') {
          const { answer, wrong, ...spec } = reasoningTask(stage, boss, locale, id === 'v2-hard-logic-vault-3');
          const { difficulty, ageRange, learning } = p;
          for (const key of Object.keys(p)) delete p[key];
          Object.assign(p, { id, difficulty, ageRange, type: 'multiple_choice', topic: 'logic', ...spec,
            learning: { ...learning, representation: 'symbols', reasoningSteps: 2 } });
          choices(p, answer, wrong, stage + (boss ? 1 : 0));
        } else if (p.type === 'multiple_choice' && p.question === (locale === 'en'
          ? `A box holds fewer than ${Number(p.choices[p.correctIndex]) - 1} balls. Which amount is impossible?`
          : `Kastē ir mazāk nekā ${Number(p.choices[p.correctIndex]) - 1} bumbiņas. Kurš daudzums nav iespējams?`)) {
          // Numeric-rank balancing must never turn a distractor into another valid answer.
          const answer = Number(p.choices[p.correctIndex]);
          choices(p, answer, [answer - 2, answer - 3], stage + (boss ? 1 : 0));
        }
      }
    });
  }
}
