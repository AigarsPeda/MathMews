/** Replace only existing slots: saved progress, catalog registrations and rewards remain valid. */
export function applyPlaceValuePilot({ puzzles, lessons, pathExtras }) {
  const plans = {
    addition: [['build', 34], ['bundle', 25], ['add', 27, 16], ['add', 36, 28], ['add', 48, 15], ['add', 29, 38], ['add', 57, 26]],
    subtraction: [['build', 42], ['split', 31], ['subtract', 42, 17], ['subtract', 51, 24], ['subtract', 63, 28], ['subtract', 54, 18], ['subtract', 72, 39]],
  };
  for (const [topic, plan] of Object.entries(plans)) {
    const lesson = lessons.find(l => l.difficulty === 'medium' && l.topicId === topic);
    lesson.title = topic === 'addition' ? { en: 'Tens, ones and addition', lv: 'Desmiti, vieni un saskaitīšana' }
      : { en: 'Exchange to subtract', lv: 'Samaini, lai atņemtu' };
    lesson.description = { en: 'Build numbers, exchange tens and ones, then try a fresh calculation.', lv: 'Veido skaitļus, samaini desmitus un vienus, tad izmēģini jaunu aprēķinu.' };
    const slots = [...lesson.levels.filter(l => l.kind === 'practice').flatMap(l => l.puzzleIds),
      ...lesson.levels.filter(l => l.kind === 'challenge').flatMap(l => l.puzzleIds), ...pathExtras[lesson.id]];
    for (const locale of ['en', 'lv']) {
      const lv = locale === 'lv';
      slots.forEach((id, i) => {
        const puzzle = puzzles[locale].medium.find(p => p.id === id);
        const { difficulty, ageRange, learning } = puzzle;
        const [mode, start, operand] = plan[i], guided = i < 3;
        const question = mode === 'build' ? (lv ? `Izveido skaitli ${start} no desmitiem un vieniem.` : `Build ${start} with tens and ones.`)
          : mode === 'bundle' ? (lv ? 'Samaini 10 vienus pret 1 desmitu.' : 'Exchange 10 ones for 1 ten.')
          : mode === 'split' ? (lv ? 'Samaini 1 desmitu pret 10 vieniem.' : 'Exchange 1 ten for 10 ones.')
          : `${start} ${mode === 'add' ? '+' : '−'} ${operand} = ?`;
        const hint = mode === 'split' ? (lv ? 'Daudzums nemainās, ja vienu desmitu samaina pret desmit vieniem.' : 'Trading one ten for ten ones keeps the same amount.')
          : mode === 'subtract' ? (lv ? 'Ja nepietiek vienu, samaini vienu desmitu pret desmit vieniem. Tad atņem vajadzīgo daudzumu.' : 'If there are not enough ones, exchange one ten for ten ones. Then take away the amount in the question.')
          : mode === 'build' ? (lv ? 'Pirmais cipars rāda desmitus, otrais — vienus.' : 'The first digit counts tens. The second counts ones.')
          : (lv ? 'Desmit vienus var samainīt pret vienu desmitu. Beigās vienu jābūt mazāk par desmit.' : 'Ten ones can be exchanged for one ten. Finish with fewer than ten ones.');
        const total = mode === 'add' ? start + operand : mode === 'subtract' ? start - operand : start;
        const tens = Math.floor(total / 10) - (mode === 'split' ? 1 : 0), ones = total % 10 + (mode === 'split' ? 10 : 0);
        const expression = mode === 'add' || mode === 'subtract' ? `${start} ${mode === 'add' ? '+' : '−'} ${operand} = ${total}. ` : '';
        for (const key of Object.keys(puzzle)) delete puzzle[key];
        Object.assign(puzzle, { id, difficulty, ageRange, topic, type: 'place_value', question, hint,
          explanation: `${expression}${tens} × 10 + ${ones} = ${total}.`,
          payload: { mode, start, ...(operand === undefined ? {} : { operand }), guided }, helpTemplate: `base_ten_${mode}`,
          learning: { ...learning, representation: 'objects', reasoningSteps: mode === 'add' || mode === 'subtract' ? 2 : 1 } });
      });
    }
  }
}
