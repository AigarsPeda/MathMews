const line = (numerator, denominator, divisions = denominator) => ({ type: 'fraction_number_line', numerator, denominator, divisions });
const strip = (numerator, denominator, partitions = [denominator], mode = 'build') => ({ type: 'fraction_strip', numerator, denominator, partitions, mode });

export const FRACTION_PILOT_LESSONS = [
  { id: 'easy-fractions-pictures', title: { en: 'Halves and quarters on strips and lines', lv: 'Puses un ceturtdaļas joslās un uz taisnes' }, tasks: [
    strip(1, 2), line(1, 2), strip(1, 4), line(3, 4), line(2, 4), strip(3, 4), line(1, 4),
  ] },
  { id: 'easy-fractions-explore-3', title: { en: 'Thirds, fifths and sixths', lv: 'Trešdaļas, piektdaļas un sestdaļas' }, tasks: [
    strip(1, 3), line(2, 3), strip(1, 6), line(4, 6), line(2, 5), strip(3, 5), line(5, 6),
  ] },
  { id: 'easy-fractions-explore-6', title: { en: 'Different parts, the same amount', lv: 'Dažādas daļas, vienāds daudzums' }, tasks: [
    strip(1, 2, [4, 3], 'equivalent'), line(2, 4, 2), strip(2, 3, [4, 6], 'equivalent'), line(3, 6, 4),
    strip(3, 4, [6, 8], 'equivalent'), line(4, 6, 3), strip(2, 4, [6, 3], 'equivalent'),
  ] },
  { id: 'medium-fractions-equivalent', title: { en: 'Equivalent fractions on strips and lines', lv: 'Vienādas daļas joslās un uz taisnes' }, tasks: [
    strip(3, 4, [6, 8, 12], 'equivalent'), line(2, 3, 6), strip(2, 5, [8, 10, 6], 'equivalent'), line(3, 6, 8),
    strip(4, 6, [9, 8, 3], 'equivalent'), line(6, 8, 4), strip(3, 9, [6, 4, 12], 'equivalent'),
  ] },
];

/** Keep placements and reward registrations stable; replace content in existing slots. */
export function applyFractionModelPilot({ puzzles, lessons, pathExtras }) {
  for (const plan of FRACTION_PILOT_LESSONS) {
    const lesson = lessons.find(l => l.id === plan.id);
    lesson.title = plan.title;
    lesson.description = { en: 'Build fractions with equal parts, then locate their value between zero and one.', lv: 'Veido daļas no vienādām daļām, tad atrodi to vērtību starp nulli un vienu.' };
    const slots = [...lesson.levels.filter(l => l.kind === 'practice').flatMap(l => l.puzzleIds),
      ...lesson.levels.filter(l => l.kind === 'challenge').flatMap(l => l.puzzleIds), ...pathExtras[lesson.id]];
    for (const locale of ['en', 'lv']) slots.forEach((id, slot) => {
      const puzzle = puzzles[locale][lesson.difficulty].find(p => p.id === id);
      const { difficulty, ageRange, learning } = puzzle;
      const { type, ...values } = plan.tasks[slot];
      const { numerator: n, denominator: d, divisions, partitions, mode } = values;
      const lv = locale === 'lv', fraction = `${n}/${d}`, guided = slot < 3;
      const question = type === 'fraction_number_line'
        ? lv ? `Atzīmē ${fraction} uz skaitļu taisnes.` : `Place ${fraction} on the number line.`
        : mode === 'equivalent'
          ? lv ? `Izveido joslā daļu, kas vienāda ar ${fraction}.` : `Make a strip equal to ${fraction}.`
          : lv ? `Iekrāso ${fraction} no joslas.` : `Shade ${fraction} of the strip.`;
      const hint = type === 'fraction_number_line'
        ? lv ? `No 0 līdz 1 ir ${divisions} vienādi soļi. Skaiti atstarpes starp atzīmēm.` : `There are ${divisions} equal steps from 0 to 1. Count the spaces between the marks.`
        : mode === 'equivalent'
          ? lv ? 'Abas joslas ir vienāda garuma. Izvēlies daļas un iekrāso tikpat lielu laukumu kā paraugā.' : 'Both strips are the same length. Choose parts and shade the same amount as the reference.'
          : lv ? `Veselais sadalīts ${d} vienādās daļās. Iekrāso ${n} no tām.` : `The whole is split into ${d} equal parts. Shade ${n} of them.`;
      const explanation = type === 'fraction_number_line'
        ? lv ? `${n * divisions / d} no ${divisions} vienādiem soļiem ved no 0 līdz ${fraction}.` : `${n * divisions / d} of ${divisions} equal steps take you from 0 to ${fraction}.`
        : [fraction, ...partitions.filter(parts => n * parts % d === 0 && parts !== d).map(parts => `${n * parts / d}/${parts}`)].join(' = ') + '.';
      for (const key of Object.keys(puzzle)) delete puzzle[key];
      Object.assign(puzzle, { id, difficulty, ageRange, type, topic: 'fractions', question, hint, explanation,
        payload: { ...values, guided }, helpTemplate: type === 'fraction_number_line' ? 'fraction_number_line' : `fraction_strip_${mode}`,
        learning: { ...learning, representation: type === 'fraction_number_line' ? 'number-line' : 'fraction-model', reasoningSteps: mode === 'equivalent' ? 2 : 1 } });
    });
  }
  // Replacing old comparisons must not leave a new left/right answer bias.
  for (const locale of ['en', 'lv']) for (const difficulty of ['easy', 'medium', 'hard']) {
    puzzles[locale][difficulty].filter(p => p.type === 'compare').forEach((p, i) => {
      if (p.correctIndex !== i % 2) {
        [p.payload.optionA, p.payload.optionB] = [p.payload.optionB, p.payload.optionA];
        p.correctIndex = i % 2;
      }
    });
  }

}
