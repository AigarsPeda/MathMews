import { curriculum, puzzles, localized, readJson, writeReport } from './report-data.mjs';

const rules = ['ai-phrasing', 'interface', 'ru-vy', 'ru-plural', 'lv-count', 'hint-answer', 'english', 'double-space', 'punctuation', 'shared-description', 'easy-length'];
const hits = new Map(rules.map(rule => [rule, { count: 0, examples: [] }]));
function flag(rule, where, value) {
  const hit = hits.get(rule);
  hit.count++;
  if (hit.examples.length < 3) hit.examples.push(where + ' · ' + value);
}
const ai = /(?<!\p{L})(?:let['’]s|let us|great job|awesome|well done|remember|note that|keep in mind|simply|just|easily|carefully|basically|consider|think about|explore|in this puzzle|davai|davaj|atceries|ņem vērā|vienkārši|rūpīgi|viegli|padomā|apsver|izpēti|lieliski|šajā uzdevumā|давай(?:те)?|молодец|отлично|помни|запомни|обрати внимание|просто|легко|внимательно|по сути|подумай|рассмотри|изучи|в этой задаче)(?!\p{L})/iu;
const ui = /the (?:shown|marked|given|offered)|(?<!\p{L})(?:parādīt|atzīmēt|piedāvāt|dot(?:aj|o|ā|ie)|показанн|отмеченн|данн|предложенн|указанн)\p{L}*/iu;
const polite = /(?<!\p{L})(?:вы|вас|вам[и]?|ваш(?:а|е|и|его|ему|их|ей|у|им|ими)?|можете|[а-яё]+(?:йте|ите|ьте|йтесь|итесь|ьтесь|ётесь|етесь))(?!\p{L})/iu;
const pluralLooking = /^(?:(?:papīra|rotaļu|kvadrātveida) )?(?:centi|grami|lauciņiem|ceturtdaļpagriezieniem|lentes|rindas|soļus|zvaigznes|peles|stādvietas|sarkanas|zilas|minūtes|bumbiņas|priekšmetus|grāmatas|daļas|vietas|kastes|maisiņus|paciņas|vienības)(?!\p{L})/iu;
const enWords = /(?<!\p{L})(?:the|with|from|find|choose|puzzle|answer|which|number|tiles|coins|square|shown|what|how|count|items|minutes|whole)(?!\p{L})/iu;
function inspect(text, lang, where, field, difficulty, answers) {
  if (ai.test(text) || ((difficulty === 'easy' || field === 'question') && ((difficulty === 'easy' && text.includes('—')) || (field === 'question' && text.includes('!')))) || (difficulty === 'easy' && text.includes(';'))) flag('ai-phrasing', where, text);
  if (ui.test(text)) flag('interface', where, text);
  if (lang === 'ru' && polite.test(text)) flag('ru-vy', where, text);
  if (lang === 'lv') for (const m of text.matchAll(/(?<![\d/,.:])\b(\d+)(?![.,]\d)\s+/g)) {
    if (+m[1] % 10 === 1 && +m[1] % 100 !== 11 && pluralLooking.test(text.slice(m.index + m[0].length))) flag('lv-count', where, text);
  }
  if (lang !== 'en' && (enWords.test(text) || (lang === 'ru' && /(?<![a-z])(?!(?:cm|mm|ml|km|min|kg|kgf|max)\b)[a-z]{2,}\b/u.test(text.replace(/\b[A-Z][a-z]+\b/g, ''))))) flag('english', where, text);
  if (/ {2}/.test(text)) flag('double-space', where, text);
  if (['question','hint','description','explanation'].includes(field) && /\p{L}/u.test(text) && !/[.!?…][»”"]?$/.test(text)) flag('punctuation', where, text);
  if (field === 'question' && difficulty === 'easy' && text.trim().split(/\s+/).length > 12) flag('easy-length', where, text);
  if (field === 'hint' && answers.some(a => a && new RegExp('(?<![\\p{L}\\d])' + String(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\d])', 'iu').test(text))) flag('hint-answer', where, text);
}
function answerTexts(p, lang) {
  const d = p.payload ?? {};
  const opts = p.choices ?? d.choices ?? [d.optionA, d.optionB];
  const value = localized(opts[p.correctIndex], lang) ?? d.correctValue ?? (d.numerator != null ? d.numerator + '/' + d.denominator : undefined);
  if (value != null) return [String(value)];
  if (p.type === 'true_false') return [{ en:['false','true'], lv:['aplami','patiesi'], ru:['неверно','верно'] }[lang][Number(p.isTrue)]];
  if (d.correctOrder || d.solution) return [(d.correctOrder ?? d.solution).join(', ')];
  if (p.type === 'signed_line') return [String(d.start + d.delta)];
  return [];
}
function visit(value, id, difficulty, field, puzzle) {
  if (value && typeof value === 'object' && typeof value.en !== 'string') {
    for (const [key, child] of Object.entries(value)) visit(child, id, difficulty, Array.isArray(value) ? field : key, puzzle);
  } else if (typeof value?.en === 'string' || (typeof value === 'string' && ['question','hint','explanation','description','label','statement','choices'].includes(field))) {
    for (const lang of ['en','lv','ru']) inspect(localized(value, lang), lang, id + '/' + field + '/' + lang, field, difficulty, puzzle ? answerTexts(puzzle, lang) : []);
  }
}
for (const p of puzzles) visit(p, p.id, p.difficulty, '', p);
for (const entry of [...curriculum.topics, ...curriculum.lessons]) visit(entry, entry.id, entry.difficulty, '');
for (const lang of ['en','lv','ru']) {
  const groups = new Map();
  for (const lesson of curriculum.lessons) {
    const desc = lesson.description[lang];
    groups.set(desc, (groups.get(desc) ?? 0) + 1);
  }
  for (const [desc, n] of groups) if (n >= 3) flag('shared-description', lang + ' × ' + n, desc);
}
// Prepositions, predicates, invariant units and fractional complements do not agree with the slot.
const invariant = new Set('в и к по на с из до или не после больше вперед вперёд входит готовы днём есть использует ли наверх ниже нужно означает покрывают присоединяются ровно синим содержится составляют спасателям упакованы четное четный чётное чётный является мл см мин л м мм км кг г ч евро целого'.split(' '));
for (const [key, value] of Object.entries(readJson('locales/puzzle-text/ru.json'))) {
  for (const m of value.matchAll(/__N\d+__\s+([а-яё]+)/giu)) {
    if (!invariant.has(m[1].toLowerCase()) && !/\/\s*$/.test(value.slice(0, m.index))) flag('ru-plural', key, m[0]);
  }
}
const lines = [...hits].map(([rule, hit]) => '## ' + rule + ' (' + hit.count + ')\n\n' + hit.examples.map(s => '- ' + s).join('\n'));
console.log(lines.join('\n'));
writeReport('text-baseline.md', '# Puzzle text checks\n\n' + lines.join('\n\n'));
const strict = process.argv.find(arg => arg.startsWith('--strict='))?.slice(9).split(',') ?? [];
for (const rule of strict) {
  if (!hits.has(rule)) throw new Error('Unknown rule ' + rule);
  if (hits.get(rule).count) process.exitCode = 1;
}
