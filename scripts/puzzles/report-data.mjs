import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const readJson = file => JSON.parse(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8'));
export const difficulties = ['easy', 'medium', 'hard'];
export const curriculum = readJson('data/puzzle-curriculum.json');
export const puzzles = difficulties.flatMap(d => readJson('assets/puzzles/' + d + '.json'));
export const localized = (value, language) => value?.[language] ?? value;
export const reportDir = path.join(process.env.SCR ?? process.env.SCRATCHPAD ?? path.join(os.tmpdir(), 'math-mews'), 'learn');
export function writeReport(name, content) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, name), content + '\n');
}
