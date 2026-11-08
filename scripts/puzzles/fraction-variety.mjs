import assert from 'node:assert/strict';
import { taskFingerprint } from './task-repetition.mjs';

const familiar = [2, 3, 4, 5, 6, 8];
const maxima = { easy: Array(10).fill(8), medium: [8, 8, 12, 12, 18, 24, 24, 24, 24, 24], hard: [12, 16, 20, 24, 48, 48, 48, 48, 64, 64] };

/** Fresh quantities keep the existing interaction and the lesson's fraction method. */
function* alternatives(p, stage, lv) {
  const v = p.payload, max = maxima[p.difficulty][stage];
  const denominators = p.difficulty === 'easy' || p.difficulty === 'medium' && stage < 2
    ? familiar.filter(d => stage !== 1 || p.difficulty !== 'easy' || [2, 4].includes(d))
    : Array.from({ length: max - 1 }, (_, i) => i + 2);
  for (const d of denominators) for (let n = 1; n < d + (p.type === 'fraction_equivalent' ? 1 : 0); n++) {
    const q = structuredClone(p);
    if (p.type === 'fraction_number_line') {
      q.payload = { ...v, numerator: n, denominator: d, divisions: d };
      q.question = lv ? `Atzīmē ${n}/${d} uz skaitļu taisnes.` : `Place ${n}/${d} on the number line.`;
      q.hint = lv ? `No 0 līdz 1 ir ${d} vienādi soļi. Skaiti atstarpes starp atzīmēm.` : `There are ${d} equal steps from 0 to 1. Count the spaces between the marks.`;
      q.explanation = lv ? `${n} no ${d} vienādiem soļiem ved no 0 līdz ${n}/${d}.` : `${n} of ${d} equal steps take you from 0 to ${n}/${d}.`;
    } else if (p.type === 'fraction_strip') {
      if (v.mode === 'equivalent' && (v.partitions.includes(d) || v.partitions.some(parts => n * parts % d !== 0))) continue;
      q.payload = { ...v, numerator: n, denominator: d, partitions: v.mode === 'build' ? [d] : v.partitions };
      q.question = v.mode === 'build' ? lv ? `Iekrāso ${n}/${d} no joslas.` : `Shade ${n}/${d} of the strip.`
        : lv ? `Izveido joslā daļu, kas vienāda ar ${n}/${d}.` : `Make a strip equal to ${n}/${d}.`;
      q.explanation = [`${n}/${d}`, ...q.payload.partitions.filter(parts => parts !== d).map(parts => `${n * parts / d}/${parts}`)].join(' = ') + '.';
    } else if (p.type === 'fraction_build') {
      if (p.difficulty === 'easy' && stage === 2 && n !== 1) continue;
      q.payload = { ...v, numerator: n, denominator: d };
      q.question = lv ? `Iekrāso ${n}/${d} no veselā.` : `Color ${n}/${d} of this whole.`;
      q.explanation = lv ? `${n} no ${d} vienādām daļām ir ${n}/${d}.` : `${n} out of ${d} equal parts is ${n}/${d}.`;
    } else if (p.type === 'fraction_match') {
      q.payload.pairs = [{ numerator: n, denominator: d, visual: 'pie' }, { numerator: d - n === n ? d : d - n, denominator: d, visual: 'grid' }];
      q.explanation = lv ? 'Saskaiti iekrāsotās daļas un visas vienādās daļas.' : 'Count the shaded parts and all equal parts.';
    } else if (p.type === 'fraction_equivalent') {
      const factor = Number(v.choices[p.correctIndex].split('/')[1]) / v.denominator;
      const answerN = n * factor, answerD = d * factor;
      if (!Number.isInteger(answerN) || !Number.isInteger(answerD) || answerD > max || answerD < 2) continue;
      if (p.difficulty === 'easy' && !familiar.includes(answerD)) continue;
      const wrong = Array.from({ length: answerD + 1 }, (_, i) => i).filter(i => i !== answerN)
        .sort((a, b) => Math.abs(a - answerN) - Math.abs(b - answerN)).slice(0, 2).map(i => `${i}/${answerD}`);
      wrong.splice(p.correctIndex, 0, `${answerN}/${answerD}`);
      q.payload = { numerator: n, denominator: d, choices: wrong };
      q.explanation = `${n}/${d} = ${answerN}/${answerD}.`;
    } else if (p.type === 'compare') {
      let a = [n + 1, d], b = [n, d];
      if (p.difficulty === 'medium' && stage >= 2 && stage < 4 || p.difficulty === 'hard' && stage === 0) {
        if (stage === 2 && p.difficulty === 'medium' && n !== 1 || d + 1 > max) continue;
        a = [n, d]; b = [n, d + 1];
      } else if (p.difficulty === 'medium' && stage >= 4 || p.difficulty === 'hard' && stage === 1) {
        if (n * 2 === d) continue;
        a = n * 2 > d ? [n, d] : [1, 2]; b = n * 2 > d ? [1, 2] : [n, d];
      }
      q.payload = { optionA: (p.correctIndex === 0 ? a : b).join('/'), optionB: (p.correctIndex === 1 ? a : b).join('/') };
      q.explanation = `${a.join('/')} > ${b.join('/')}.`;
    } else if (p.type === 'sort_buckets') {
      const factors = p.difficulty === 'easy' && stage < 5 ? [1, 1] : v.fractions.length === 4 ? [1, 2] : [1, 2, 3];
      if (d * Math.max(...factors) > max || p.difficulty === 'easy' && factors.some(k => !familiar.includes(d * k))) continue;
      const targets = [[n, d], [n * 2 === d ? d : d - n, d]];
      q.payload = { rule: 'fractions', targets, fractions: factors.flatMap(k => targets.map(([a, b]) => [a * k, b * k])) };
      const [a, b] = targets.map(f => f.join('/'));
      q.question = lv ? `Sašķiro daļas pēc vērtības: ${a} vai ${b}.` : `Sort the fractions by value: ${a} or ${b}.`;
      q.explanation = targets.map(([a, b]) => factors.map(k => `${a * k}/${b * k}`).join(' = ')).join('; ') + '.';
    } else return;
    yield q;
  }
}

export function varyFractionExamples({ puzzles, lessons, pathExtras }) {
  for (const locale of ['en', 'lv']) for (const difficulty of ['easy', 'medium', 'hard']) {
    const byId = new Map(puzzles[locale][difficulty].map(p => [p.id, p]));
    let previous = new Set();
    const track = lessons.filter(l => l.difficulty === difficulty && l.topicId === 'fractions');
    // Finale pictures and questions share authored quantities. Reserve those tasks first.
    const protectedIds = new Set(track.at(-1).levels.filter(l => l.kind === 'boss').flatMap(l => l.puzzleIds));
    const reserved = [...protectedIds].map(id => taskFingerprint(byId.get(id)));
    track.forEach((lesson, stage) => {
      const seen = new Set([...previous, ...reserved]), current = new Set();
      for (const id of [...lesson.levels.flatMap(l => l.puzzleIds), ...pathExtras[lesson.id]]) {
        const p = byId.get(id);
        if (protectedIds.has(id)) { current.add(taskFingerprint(p)); continue; }
        const key = taskFingerprint(p);
        if (seen.has(key)) {
          let fresh;
          for (const candidate of alternatives(p, stage, locale === 'lv')) if (!seen.has(taskFingerprint(candidate))) { fresh = candidate; break; }
          assert.ok(fresh, `${id}: needs another example of the taught fraction skill`);
          Object.assign(p, fresh);
        }
        seen.add(taskFingerprint(p));
        current.add(taskFingerprint(p));
      }
      previous = current;
    });
  }
}
