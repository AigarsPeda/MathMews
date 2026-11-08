import assert from 'node:assert/strict';

const text = (locale, en, lv, ru) => ({ en, lv, ru })[locale];
const number = (n, locale) => String(n).replace('.', locale === 'en' ? '.' : ',');
const selectionTypes = new Set(['multiple_choice', 'balance', 'fix_mistake', 'function_machine', 'pattern_next', 'estimate', 'fair_share', 'fraction_equivalent', 'compare']);
const numeric = s => /^-?\d+(?:[.,]\d+)?$/.test(s);
const point = p => `(${p.x}; ${p.y})`;
const hash = s => [...s].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** The alternative question uses the same givens and the same taught operation. */
export function responseExample(p, locale) {
  const v = p.payload;
  let answer, wrong, prompt;
  if ((p.type ?? 'multiple_choice') === 'multiple_choice') {
    answer = p.choices[p.correctIndex]; wrong = p.choices.filter((_, i) => i !== p.correctIndex);
    if (!numeric(answer) && !/^\d{2}:\d{2}$|^\d+\/\d+$/.test(answer)) {
      const m = p.everyday?.model;
      if (!m || m.kind !== 'bars' || !['most', 'least'].includes(m.task)) return null;
      answer = number(m.task === 'most' ? Math.max(...m.values) : Math.min(...m.values), locale);
      prompt = m.task === 'most'
        ? text(locale, 'How many toys are in the largest group?', 'Cik rotaļlietu ir lielākajā grupā?', 'Сколько игрушек в самой большой группе?')
        : text(locale, 'How many toys are in the smallest group?', 'Cik rotaļlietu ir mazākajā grupā?', 'Сколько игрушек в самой маленькой группе?');
      wrong = m.values.filter(n => number(n, locale) !== answer).map(n => number(n, locale));
    }
  } else if (p.type === 'fraction_build' && !v.hideTarget) {
    answer = String(v.numerator);
    prompt = text(locale, `How many of the ${v.denominator} equal pieces make ${v.numerator}/${v.denominator}?`, `Cik no ${v.denominator} vienādajiem gabaliem veido ${v.numerator}/${v.denominator}?`, `Сколько из ${v.denominator} равных частей составляют ${v.numerator}/${v.denominator}?`);
  } else if (p.type === 'fraction_match') {
    const { numerator: n, denominator: d } = v.pairs[0];
    answer = `${n}/${d}`; wrong = [`${n === 0 ? 1 : n - 1}/${d}`, `${n === d ? n - 2 : n + 1}/${d}`];
    prompt = text(locale, 'What fraction does this picture show?', 'Kādu daļu rāda šis attēls?', 'Какую дробь показывает этот рисунок?');
  } else if (p.type === 'fraction_equivalent') {
    answer = v.choices[p.correctIndex]; wrong = v.choices.filter((_, i) => i !== p.correctIndex);
    const d = answer.split('/')[1];
    prompt = text(locale, `Write an equal fraction with denominator ${d}.`, `Uzraksti tikpat lielu daļu ar saucēju ${d}.`, `Запиши равную дробь со знаменателем ${d}.`);
  } else if (p.type === 'balance') answer = v.choices[p.correctIndex];
  else if (['pattern_next', 'function_machine', 'estimate', 'fair_share'].includes(p.type)) { answer = v.choices[p.correctIndex]; wrong = v.choices.filter((_, i) => i !== p.correctIndex); }
  else if (p.type === 'compare') { answer = p.correctIndex === 0 ? v.optionA : v.optionB; wrong = [p.correctIndex === 0 ? v.optionB : v.optionA]; }
  else if (p.type === 'fix_mistake') { answer = v.choices[p.correctIndex]; wrong = v.choices.filter((_, i) => i !== p.correctIndex); }
  else if (p.type === 'true_false' && !v.hideStatement) {
    const match = v.statement.match(/^(\d+)\s*−\s*(\d+)\s*=/);
    if (!match) return null;
    answer = String(Number(match[1]) - Number(match[2]));
    prompt = text(locale, 'What is the correct result?', 'Kāds ir pareizais rezultāts?', 'Какой результат правильный?');
  } else if (p.type === 'number_line') answer = String(v.correctValue);
  else if (p.type === 'signed_line') {
    const delta = v.mode === 'place' ? v.start === v.max ? -1 : 1 : v.delta;
    answer = String(v.start + delta);
    if (v.mode === 'place') prompt = text(locale, `Start at ${v.start}. What number is 1 step ${delta > 0 ? 'right' : 'left'}?`, `Sāc pie ${v.start}. Kurš skaitlis ir 1 soli pa ${delta > 0 ? 'labi' : 'kreisi'}?`, `Начни с ${v.start}. Какое число на 1 шаг ${delta > 0 ? 'вправо' : 'влево'}?`);
  }
  else if (p.type === 'ratio_table') answer = String(v.targetA * v.b / v.a);
  else if (p.type === 'equation_board') {
    answer = String((v.c - v.b) / v.a);
    prompt = text(locale, 'What value of x balances this equation?', 'Kāda x vērtība līdzsvaro šo vienādojumu?', 'Какое значение x уравновешивает это уравнение?');
  }
  else if (p.type === 'coordinate_map') {
    if (v.mode === 'distance') answer = String(Math.abs(v.end.x - v.start.x) + Math.abs(v.end.y - v.start.y));
    else {
      const dx = v.end.x === v.max ? -1 : 1;
      const target = v.mode === 'plot' ? { x: v.end.x + dx, y: v.end.y } : { x: v.start.x + v.end.x, y: v.start.y + v.end.y };
      if (v.mode === 'plot') prompt = text(locale, `Start at A ${point(v.end)}. Move 1 unit ${dx > 0 ? 'right' : 'left'}. Where do you finish?`, `Sāc punktā A ${point(v.end)}. Pārvietojies par 1 vienību pa ${dx > 0 ? 'labi' : 'kreisi'}. Kur nonāc?`, `Начни в точке A ${point(v.end)}. Сдвинься на 1 единицу ${dx > 0 ? 'вправо' : 'влево'}. Где окажешься?`);
      answer = point(target);
      wrong = [point({ x: target.x === v.max ? target.x - 1 : target.x + 1, y: target.y }), point({ x: target.x, y: target.y === v.min ? target.y + 1 : target.y - 1 })];
    }
  } else if (p.type === 'place_value') {
    const total = v.mode === 'add' ? v.start + v.operand : v.mode === 'subtract' ? v.start - v.operand : v.start;
    const tens = Math.floor(total / 10) - (v.mode === 'split' ? 1 : 0), ones = total % 10 + (v.mode === 'split' ? 10 : 0);
    const blocks = (a, b) => `${a} × 10 + ${b} × 1`;
    answer = blocks(tens, ones); wrong = [blocks(tens + 1, ones), blocks(tens, ones + 1)];
    prompt = v.mode === 'split'
      ? text(locale, 'Split one ten into ones. Which groups do you get?', 'Sadali vienu desmitu vienos. Kādas grupas iegūsti?', 'Раздели один десяток на единицы. Какие группы получатся?')
      : v.mode === 'bundle'
        ? text(locale, 'Bundle ten ones. Which groups do you get?', 'Apvieno desmit vienus. Kādas grupas iegūsti?', 'Объедини десять единиц. Какие группы получатся?')
        : v.mode === 'build'
          ? text(locale, `Which tens and ones make ${v.start}?`, `Kuri desmiti un vieni veido ${v.start}?`, `Какие десятки и единицы составляют ${v.start}?`)
          : text(locale, 'Calculate the shown operation. Which tens and ones make the result?', 'Aprēķini parādīto darbību. Kuri desmiti un vieni veido rezultātu?', 'Вычисли показанное действие. Какие десятки и единицы составляют результат?');
  } else if (p.type === 'decimal_grid') {
    answer = String(v.hundredths * v.scale / 100);
    const decimal = number(v.hundredths / 100, locale);
    prompt = text(locale, `How many of the ${v.scale} cells make ${decimal}?`, `Cik no ${v.scale} rūtiņām veido ${decimal}?`, `Сколько из ${v.scale} клеток составляют ${decimal}?`);
  } else if (p.type === 'decimal_place_value') {
    let tenths = Math.floor(v.hundredths / 10) % 10, hundredths = v.hundredths % 10, ones = Math.floor(v.hundredths / 100);
    if (v.mode === 'split') {
      if (v.exchangeUnit === 'tenths') { ones--; tenths += 10; } else { tenths--; hundredths += 10; }
    }
    const blocks = (a, b, c) => `${a} × 1 + ${b} × ${number(0.1, locale)} + ${c} × ${number(0.01, locale)}`;
    answer = blocks(ones, tenths, hundredths); wrong = [blocks(ones, tenths + 1, hundredths), blocks(ones, tenths, hundredths + 1)];
    const decimal = number(v.hundredths / 100, locale);
    const small = number(v.exchangeUnit === 'tenths' ? 0.1 : 0.01, locale), large = number(v.exchangeUnit === 'tenths' ? 1 : 0.1, locale);
    prompt = v.mode === 'build' ? text(locale, `Which groups show ${decimal}?`, `Kuras grupas rāda ${decimal}?`, `Какие группы показывают ${decimal}?`)
      : v.mode === 'split'
        ? text(locale, `Exchange one ${large} for ten ${small} pieces. Which groups do you get?`, `Apmaini vienu ${large} pret desmit ${small} daļām. Kādas grupas iegūsti?`, `Обменяй одну часть ${large} на десять частей по ${small}. Какие группы получатся?`)
        : text(locale, `Bundle ten ${small} pieces into one ${large}. Which groups do you get?`, `Apvieno desmit ${small} daļas vienā ${large}. Kādas grupas iegūsti?`, `Объедини десять частей по ${small} в одну часть ${large}. Какие группы получатся?`);
  } else if (p.type === 'geometry_measure') {
    if (v.mode === 'compare') { const delta = v.width + v.height - v.other.width - v.other.height; answer = delta === 0 ? 'A = B' : delta > 0 ? 'A' : 'B'; wrong = ['A', 'B', 'A = B'].filter(s => s !== answer); }
    else answer = String(v.mode.startsWith('missing') ? v.height : v.mode === 'area' ? v.width * v.height : 2 * (v.width + v.height));
  } else if (p.type === 'pair_sum') {
    const [a, b] = v.correctIndices.map(i => v.numbers[i]);
    answer = String(b);
    prompt = text(locale, `Choose ${a} first. What number must join it to make ${v.target}?`, `Vispirms izvēlies ${a}. Kāds skaitlis jāpievieno, lai iegūtu ${v.target}?`, `Сначала выбери ${a}. Какое число нужно добавить, чтобы получить ${v.target}?`);
  } else return null;
  if (!wrong && numeric(answer)) {
    const value = Number(answer.replace(',', '.')), step = Number.isInteger(value) ? 1 : 0.25;
    wrong = [number(value + step, locale), number(value === 0 ? value + 2 * step : value - step, locale)];
  }
  return { answer, wrong, prompt };
}

export const activityKind = p => p.response?.kind ?? p.type ?? 'multiple_choice';
export function activityMix(tasks) {
  const counts = {}, runs = []; let last, run = 0;
  for (const p of tasks) { const kind = activityKind(p); counts[kind] = (counts[kind] ?? 0) + 1; run = kind === last ? run + 1 : 1; last = kind; runs.push(run); }
  return { types: Object.keys(counts).length, largest: Math.max(...Object.values(counts)), run: Math.max(...runs), counts };
}
const valid = tasks => { const m = activityMix(tasks); return m.types >= 3 && m.largest <= 5 && m.run <= 2; };

export function applyActivityMix({ puzzles, lessons, pathExtras }) {
  const maps = Object.fromEntries(['en', 'lv', 'ru'].map(locale => [locale, new Map(Object.values(puzzles[locale]).flat().map(p => [p.id, p]))]));
  for (const lesson of lessons) {
    const practice = lesson.levels.filter(l => l.kind === 'practice').flatMap(l => l.puzzleIds);
    const application = lesson.levels.filter(l => l.kind === 'boss').flatMap(l => l.puzzleIds);
    const challenge = lesson.levels.filter(l => l.kind === 'challenge').flatMap(l => l.puzzleIds);
    const tasks = [...practice, ...application, ...challenge, ...pathExtras[lesson.id]].map(id => maps.en.get(id));
    // Preserve the first encounter with each mathematical model.
    for (let pass = 0; !valid(tasks) && pass < 20; pass++) {
      const mix = activityMix(tasks), counts = mix.counts;
      let best;
      for (let slot = 1; slot < tasks.length; slot++) {
        const p = tasks[slot], spec = responseExample(p, 'en');
        if (p.response || !spec) continue;
        const kinds = p.type === 'true_false' ? ['write', 'choose'] : selectionTypes.has(p.type ?? 'multiple_choice') ? ['write', 'judge'] : ['choose', 'judge'];
        for (const kind of kinds) {
          if (kind === 'write' && !numeric(spec.answer) && !/^\d{2}:\d{2}$|^\d+\/\d+$/.test(spec.answer) && p.type !== 'fix_mistake') continue;
          const candidate = tasks.map((q, i) => i === slot ? { ...q, response: { kind } } : q), next = activityMix(candidate);
          const score = Math.min(next.types, 3) * 20 - Math.max(0, next.largest - 5) * 10 - Math.max(0, next.run - 2) * 10 - (counts[kind] ?? 0) * 0.1;
          if (!best || score > best.score) best = { p, kind, slot, score };
        }
      }
      assert.ok(best, `${lesson.id}: author another activity format for this skill`);
      const isCorrect = hash(best.p.id) % 2 === 0;
      for (const locale of ['en', 'lv', 'ru']) {
        const p = maps[locale].get(best.p.id), spec = responseExample(p, locale);
        assert.ok(spec, `${p.id}: missing ${locale} response`);
        const { answer, wrong, prompt } = spec;
        if (best.kind === 'write') {
          const result = p.type === 'fix_mistake' ? answer.split('=').at(-1).trim() : answer;
          p.response = { kind: 'write', answer: result.replace(',', '.'), format: result.includes(':') ? 'clock' : result.includes('/') ? 'fraction' : 'number', ...(p.type === 'fraction_equivalent' && { denominator: Number(result.split('/')[1]) }), ...(prompt && { prompt }) };
        } else if (best.kind === 'choose') {
          const index = best.slot % 3, options = wrong.slice(0, 2); options.splice(index, 0, answer);
          p.response = { kind: 'choose', options, correctIndex: index, ...(prompt && { prompt }) };
        } else {
          p.response = { kind: 'judge', proposed: isCorrect ? answer : wrong[best.slot % wrong.length], isCorrect, ...(prompt && { prompt }) };
        }
      }
    }
    assert.ok(valid(tasks), `${lesson.id}: insufficient activity mix`);
  }
  // Balance verdicts without teaching a predictable true/false sequence.
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const judgments = [...maps.en.values()].filter(p => p.difficulty === difficulty && p.response?.kind === 'judge')
      .sort((a, b) => hash(`${a.id}/verdict`) - hash(`${b.id}/verdict`));
    judgments.forEach((p, i) => {
      const isCorrect = i < Math.ceil(judgments.length / 2);
      for (const locale of ['en', 'lv', 'ru']) {
        const q = maps[locale].get(p.id), spec = responseExample(q, locale);
        q.response.isCorrect = isCorrect;
        q.response.proposed = isCorrect ? spec.answer : spec.wrong[hash(q.id) % spec.wrong.length];
      }
    });
  }
}

if (process.argv[1]?.endsWith('/activity-mix.mjs')) {
  const fs = await import('node:fs'), { readPuzzles } = await import('./catalog.mjs');
  const lessons = JSON.parse(fs.readFileSync('data/puzzle-curriculum.json')).lessons;
  const extras = JSON.parse(fs.readFileSync('data/puzzle-path-extras.json'));
  const puzzles = new Map(['easy', 'medium', 'hard'].flatMap(d => readPuzzles('en', d)).map(p => [p.id, p]));
  const rows = lessons.map(l => {
    const tasks = [...l.levels.filter(v => v.kind === 'practice').flatMap(v => v.puzzleIds), ...l.levels.filter(v => v.kind === 'challenge').flatMap(v => v.puzzleIds), ...extras[l.id]].map(id => puzzles.get(id));
    return { id: l.id, ...activityMix(tasks) };
  });
  const violations = rows.filter(m => m.types < 3 || m.largest > 5 || m.run > 2);
  console.log(JSON.stringify(process.argv.includes('--details') ? rows : { levels: rows.length, violations,
    minimumActivityFormats: Math.min(...rows.map(m => m.types)), maximumOfOneFormat: Math.max(...rows.map(m => m.largest)), maximumConsecutive: Math.max(...rows.map(m => m.run)) }, null, 2));
  if (violations.length) process.exitCode = 1;
}
