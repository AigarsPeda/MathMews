/** Forward-only seeds. Never reset prices or rewrite an applied migration. */
import fs from 'node:fs';
import { syncCatalog } from '../catalog/sync.mjs';

const result = syncCatalog(process.cwd());
if (result.migration) console.log(`Item seed: ${result.migration}`);
const history = fs.readdirSync('supabase/migrations').filter(file => file.endsWith('.sql'))
  .map(file => fs.readFileSync(`supabase/migrations/${file}`,'utf8')).join('\n');
const known = new Set([...history.matchAll(/\('([^']+)',\d+,\d+\)/g)].map(match => match[1]));
const rewards = { easy:[4,2],medium:[7,3],hard:[9,4] };
const rows = [];
for (const tier of Object.keys(rewards)) for (const puzzle of JSON.parse(fs.readFileSync(`assets/puzzles/${tier}.json`,'utf8'))) {
  if (known.has(puzzle.id)) continue;
  const [first,replay] = rewards[puzzle.type === 'number_line' ? 'hard' : tier];
  rows.push(`('${puzzle.id.replaceAll("'","''")}',${first},${replay})`);
}
if (rows.length) {
  const existing = fs.readdirSync('supabase/migrations').map(file => file.match(/^(\d+)_/)?.[1]).filter(Boolean).map(BigInt);
  const timestamp = BigInt(new Date().toISOString().replace(/\D/g,'').slice(0,14));
  const version = existing.reduce((next, value) => value >= next ? value + 1n : next,timestamp);
  const file = `supabase/migrations/${version}_puzzle_catalog.sql`;
  fs.writeFileSync(file,'-- Generated puzzle registrations; existing rewards are preserved.\nbegin;\ninsert into wallet_private.puzzle_catalog(puzzle_id,first_reward,replay_reward) values\n'+rows.join(',\n')+'\non conflict(puzzle_id) do nothing;\ncommit;\n',{flag:'wx'});
  console.log(`Puzzle seed: ${file}`);
} else console.log('Puzzle registration is current. Existing server rewards were preserved.');
