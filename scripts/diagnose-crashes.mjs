// Read Apple's local reports without uploading them or printing device identifiers.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
const target = path.resolve(process.argv[2] ?? path.join(homedir(), 'Library/Logs/DiagnosticReports'));
function firstJSON(source) {
  let depth = 0, quoted = false, escaped = false;
  const start = source.indexOf('{');
  for (let i = start; i >= 0 && i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(source.slice(start, i + 1));
  }
  throw new Error('No complete JSON crash report');
}
let files;
try {
  files = statSync(target).isDirectory()
    ? readdirSync(target).filter(name => /^(MathMews|SimMetalHost).*\.ips$/.test(name)).map(name => path.join(target, name))
    : [target];
} catch {
  console.error(`No crash reports found at ${target}. You can pass an exported .ips file or report folder.`);
  process.exit(1);
}
files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
console.log(`Math Mews crash reports: ${target}\n`);
if (!files.length) console.log('No MathMews or SimMetalHost reports found.');
// Include the companion GPU service without letting its reports crowd out the
// app's own stacks, which identify physics and JavaScript runtime failures.
const recent = files.length === 1 ? files : [
  ...files.filter(file => !path.basename(file).startsWith('SimMetalHost')).slice(0, 10),
  ...files.filter(file => path.basename(file).startsWith('SimMetalHost')).slice(0, 2),
];
for (const file of recent) {
  try {
    const source = readFileSync(file, 'utf8');
    const header = firstJSON(source);
    const report = header.threads ? header : firstJSON(source.slice(source.indexOf('\n') + 1));
    const thread = report.threads?.find(thread => thread.triggered) ?? report.threads?.[report.faultingThread];
    const frames = thread?.frames?.map(frame => frame.symbol ?? '<unsymbolicated>') ?? [];
    const category = report.termination?.namespace === 'METAL' || path.basename(file).startsWith('SimMetalHost')
      ? 'Simulator Metal graphics service'
      : frames.some(frame => /btDbvt|btDiscreteDynamicsWorld|btSimulationIslandManager/.test(frame))
        ? 'Bullet physics'
        : frames.some(frame => frame.includes('JsiArrayWrapper')) ? 'Worklets shared array' : 'Other native crash';
    console.log(`${report.captureTime ?? header.timestamp ?? path.basename(file)} | ${category}`);
    console.log(`  ${report.exception?.type ?? 'Unknown exception'} / ${report.exception?.signal ?? 'unknown signal'} | ${thread?.name ?? thread?.queue ?? 'unnamed thread'}`);
    for (const reason of report.termination?.reasons ?? []) console.log(`  ${reason}`);
    for (const frame of frames.slice(0, 8)) console.log(`  ${frame.length > 180 ? frame.slice(0, 180) + '…' : frame}`);
    console.log(`  Report: ${file}\n`);
  } catch (error) {
    console.log(`Cannot parse ${file}: ${error.message}\n`);
  }
}
