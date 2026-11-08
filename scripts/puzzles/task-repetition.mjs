import fs from 'node:fs';
import { readPuzzles } from './catalog.mjs';

const sorted = values => values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => !['label', 'guided', 'correctIndices', 'choices'].includes(key))
    .map(key => [key, canonical(value[key])]));
  return value;
}

/** Choice order, distractors, guidance and labels cannot disguise a repeated task. */
export function taskFingerprint(puzzle) {
  const payload = structuredClone(puzzle.payload ?? {});
  if (puzzle.type === 'true_false' && payload.hideStatement) delete payload.statement;
  if (puzzle.type === 'compare') {
    payload.options = sorted([payload.optionA, payload.optionB]);
    delete payload.optionA; delete payload.optionB;
  }
  for (const key of ['pairs', 'fractions', 'targets', 'numbers']) if (payload[key]) sorted(payload[key]);
  const model = structuredClone(puzzle.everyday?.model);
  if (model?.kind === 'bars' && !['read', 'missing'].includes(model.task)) delete model.index;
  if (model?.kind === 'grid') {
    if (model.task !== 'rotate') delete model.turns;
    if (model.task !== 'translate') { delete model.dx; delete model.dy; }
  }
  if (model?.kind === 'money' && !['change', 'afford'].includes(model.task)) delete model.paid;
  if (model?.kind === 'money' && model.coins) sorted(model.prices);
  if (model?.kind === 'shapes') sorted(model.sides);
  if (model?.kind === 'capacity' && !['servings', 'containers'].includes(model.task)) delete model.portion;
  const modeled = ['fraction_build', 'fraction_match', 'fraction_equivalent', 'fraction_number_line', 'fraction_strip', 'compare', 'number_line', 'order_numbers'].includes(puzzle.type);
  return JSON.stringify(canonical({ type: puzzle.type, question: modeled ? undefined : puzzle.question,
    payload, model, visual: puzzle.taskVisual }));
}

export function auditTaskRepetition({ lessons, pathExtras, puzzles }) {
  const byId = new Map(puzzles.map(p => [p.id, p])), tracks = new Map();
  const withinLevel = [], neighboringLevels = [], spacedReview = [];
  for (const lesson of lessons) {
    const track = `${lesson.difficulty}/${lesson.topicId}`, history = tracks.get(track) ?? new Map();
    const seen = new Map(), stage = (tracks.get(`${track}/stage`) ?? -1) + 1;
    const ids = [...lesson.levels.flatMap(level => level.puzzleIds), ...pathExtras[lesson.id]];
    for (const id of ids) {
      const fingerprint = taskFingerprint(byId.get(id));
      const previous = history.get(fingerprint);
      const entry = { lessonId: lesson.id, puzzleId: id, repeatedPuzzleId: seen.get(fingerprint) ?? previous?.id };
      if (seen.has(fingerprint)) withinLevel.push(entry);
      else if (previous) (previous.stage === stage - 1 ? neighboringLevels : spacedReview).push(entry);
      seen.set(fingerprint, id);
    }
    for (const [fingerprint, id] of seen) history.set(fingerprint, { id, stage });
    tracks.set(track, history); tracks.set(`${track}/stage`, stage);
  }
  return { levels: lessons.length, puzzles: puzzles.length, withinLevel, neighboringLevels, spacedReview };
}

export function readRepetitionAudit(locale = 'en') {
  return auditTaskRepetition({ lessons: JSON.parse(fs.readFileSync('data/puzzle-curriculum.json')).lessons,
    pathExtras: JSON.parse(fs.readFileSync('data/puzzle-path-extras.json')),
    puzzles: ['easy', 'medium', 'hard'].flatMap(d => readPuzzles(locale, d)) });
}

if (process.argv[1]?.endsWith('/task-repetition.mjs')) {
  const audit = readRepetitionAudit();
  console.log(JSON.stringify(process.argv.includes('--details') ? audit : {
    levels: audit.levels, puzzles: audit.puzzles, withinLevel: audit.withinLevel.length,
    neighboringLevels: audit.neighboringLevels.length, spacedReview: audit.spacedReview.length,
  }, null, 2));
}
