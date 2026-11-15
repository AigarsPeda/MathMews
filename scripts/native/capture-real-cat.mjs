#!/usr/bin/env node
/** Usage: node scripts/native/capture-real-cat.mjs [--only idle-day-1,sofa,sleep] [--out DIR]
 * Booted iOS development build + existing Metro :8081 required. Installs a temporary
 * __DEV__ QA route, records real Filament scenes, restores Fast Refresh, removes route.
 * --extract-only rebuilds sheets from recordings/events; --list lists capture names.
 */
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, open, rm, access, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sources = path.join(root, 'scripts/native/cat-capture');
const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const out = path.resolve(option('--out') ?? '/private/tmp/claude-501/-Users-aigarspeda-Desktop-BrainPet/be927aa4-9b0a-49f8-9660-819e605e64f9/scratchpad/astra-capture');
const route = path.join(root, 'app/cat-capture-qa.tsx');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sim = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const scenarios = [
  ...['day', 'night'].flatMap(period => [1, 3].map(zoom => ({ name: `idle-${period}-${zoom}`, period, zoom, type: 'idle' }))),
  ...['grey', 'white'].map(coat => ({ name: `idle-${coat}`, coat, zoom: 3, type: 'idle' })),
  { name: 'locomotion', type: 'locomotion' }, { name: 'sofa', type: 'sofa' },
  { name: 'sleep', type: 'sleep' }, { name: 'eat', type: 'eat' }, { name: 'play', type: 'play' },
  { name: 'reactions', type: 'reactions', mode: 'portrait' }, { name: 'loading', type: 'loading' },
];
if (process.argv.includes('--list')) { console.log(scenarios.map(s => s.name).join('\n')); process.exit(0); }
await mkdir(out, { recursive: true });
const exec = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }); let log = '';
  p.stdout.on('data', d => { log += d; }); p.stderr.on('data', d => { log += d; });
  p.on('error', reject); p.on('exit', code => code === 0 ? resolve(log) : reject(new Error(`${cmd} (${code}): ${log}`)));
});
const hashes = async () => Object.fromEntries(await Promise.all([
  'assets/3d/native/cat-orange.glb', 'assets/3d/native/cat-grey.glb', 'assets/3d/native/cat-white.glb',
  'components/pet/native/NativeCatActor.tsx', 'constants/cat-gaits.json', 'utils/room-activities.ts',
].map(async name => [name, createHash('sha256').update(await readFile(path.join(root, name))).digest('hex')])));
let recorder, active, server, sessionHashes, installed = false;
let stopping = false;
async function cleanup() {
  if (stopping) return;
  stopping = true;
  await recordStop();
  if (installed) {
    try { sim('openurl', 'booted', 'mathmews:///'); await sleep(1200); } catch {}
    await rm(route, { force: true }); installed = false;
    // A deep link can be ignored during startup. Reload the route tree after
    // removing the fixture so the simulator cannot retain the capture screen.
    try { sim('terminate', 'booted', 'com.mathmews.app'); } catch {}
    try { sim('launch', 'booted', 'com.mathmews.app'); } catch {}
  }
  if (server) await new Promise(resolve => server.close(resolve));
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
});
let commandId = 0;
async function recordStart(file) {
  const startedAt = Date.now();
  recorder = spawn('xcrun', ['simctl', 'io', 'booted', 'recordVideo', '--codec', 'h264', '--force', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Recorder did not start')), 15000);
    recorder.on('error', reject);
    recorder.stderr.on('data', d => { log += d; if (log.includes('Recording started')) { clearTimeout(timeout); resolve(); } });
    recorder.on('exit', code => { clearTimeout(timeout); if (code) reject(new Error(log)); });
  });
  return { startedAt, readyAt: Date.now() };
}
async function recordStop() {
  if (!recorder) return;
  const child = recorder; recorder = undefined;
  await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGINT'); });
}
async function until(predicate, label, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = predicate(); if (value) return value; await sleep(150); }
  sim('io', 'booted', 'screenshot', path.join(out, 'failure.png'));
  throw new Error(`Timed out: ${label}. See ${out}/failure.png`);
}
function send(kind, data = {}) {
  active.command = { id: ++commandId, kind, ...data };
  return until(() => active.events.find(e => e.type === 'command' && e.id === commandId), `${kind} acknowledgement`);
}
function stepSince(time, animation, extra = () => true) {
  return until(() => active.events.find(e => e.at >= time && e.type === 'step' && e.animation === animation && extra(e)), `step ${animation}`, 60000);
}
function windowAt(label, event, seconds = 1.5, offset = 0) {
  active.windows.push({ label, at: event.at + offset * 1000, seconds });
}
async function action(kind, target, animation, hold = 2000) {
  const command = await send(kind, { target });
  const event = await stepSince(command.at, animation);
  await sleep(hold); return event;
}
async function capture(scenario) {
  const run = `${scenario.name}-${Date.now()}`;
  const dir = path.join(out, scenario.name); await mkdir(dir, { recursive: true });
  active = { scenario, run, events: [], windows: [], sessionHashes, hashesBefore: await hashes(), video: path.join(dir, 'recording.mp4') };
  console.log(`Recording ${scenario.name}`);
  try {
    if (scenario.type === 'loading') {
      sim('openurl', 'booted', 'mathmews:///'); await sleep(1500);
      try { sim('terminate', 'booted', 'com.mathmews.app'); } catch {}
      active.recording = await recordStart(active.video);
      sim('launch', 'booted', 'com.mathmews.app');
      await sleep(23000);
      active.windows.push({ label: 'loading-timeline', at: active.recording.readyAt, seconds: 20, step: .5 });
      for (let second = 0; second < 6; second++) active.windows.push({
        label: `loading-handoff-${second}-${second + 1}s`, at: active.recording.readyAt + second * 1000, seconds: 1, step: 1 / 30,
      });
    } else {
      const params = new URLSearchParams({ run, port: String(server.address().port), coat: scenario.coat ?? 'orange',
        period: scenario.period ?? 'day', zoom: String(scenario.zoom ?? 1), mode: scenario.mode ?? 'room' });
      sim('openurl', 'booted', `mathmews:///cat-capture-qa?${params}`);
      await until(() => active.events.find(e => e.type === 'ready'), 'room ready', 90000);
      await sleep(3000);
      active.recording = await recordStart(active.video); await sleep(600);
      if (scenario.type === 'idle') {
        windowAt('idle-front', { at: Date.now() }); await sleep(1800);
        const turn = await send('turn', { heading: Math.PI * 1.25 });
        windowAt('stationary-turn-away', turn, 2); await sleep(3500);
        windowAt('idle-away', { at: Date.now() }); await sleep(1800);
        const back = await send('turn', { heading: Math.PI / 4 });
        windowAt('stationary-turn-front', back, 2); await sleep(3500);
      } else if (scenario.type === 'locomotion') {
        await action('investigate', 'left', 'idle2', 1500);
        await action('investigate', 'bowl', 'idle2', 1500);
        await send('returnHome'); await sleep(5000);
        await send('investigate', { target: 'left' }); await sleep(800);
        const redirect = await send('investigate', { target: 'bowl' });
        windowAt('walking-direction-change', redirect, 2);
        await stepSince(redirect.at, 'idle2');
        await send('investigate', { target: 'left' }); await sleep(1000);
        const stop = await send('stop'); windowAt('stop-command', stop, 2); await sleep(4000);
      } else if (scenario.type === 'sofa') {
        await action('sofaSit', 'sofa', 'sit', 3500);
        await send('returnHome'); await sleep(9000);
      } else if (scenario.type === 'sleep') {
        for (const pose of ['Loaf', 'Crescent', 'Side']) {
          const command = await send('sofaSleep', { target: 'sofa' });
          const asleep = await stepSince(command.at, 'curlSleep', e => e.pose === pose);
          windowAt(`sleep-${pose}`, asleep, 1.5, 1); await sleep(3000);
          await send('returnHome'); await sleep(12000);
        }
      } else if (scenario.type === 'eat') {
        await action('bowlEat', 'bowl', 'eating', 10000); await sleep(4000);
      } else if (scenario.type === 'play') {
        await action('toyPlay', 'ball', 'batToy', 18000);
      } else if (scenario.type === 'reactions') {
        for (const reaction of ['puzzleHighPaw', 'puzzleOops']) {
          const command = await send('reaction', { reaction }); windowAt(reaction, command, 2); await sleep(3500);
        }
      }
    }
    sim('io', 'booted', 'screenshot', path.join(dir, 'end.png'));
  } catch (error) { active.error = error.message; throw error; }
  finally {
    await recordStop(); await sleep(300);
    active.hashesAfter = await hashes(); active.sourceChangedDuringCapture = JSON.stringify(active.hashesBefore) !== JSON.stringify(active.hashesAfter);
    await writeFile(path.join(dir, 'events.json'), JSON.stringify(active, null, 2));
  }
}
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
function caption(text, width, height = 30) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff5eb"/><text x="8" y="21" font-size="15" font-family="Arial" fill="#28221d">${escape(text)}</text></svg>`);
}
async function extractAll() {
  const extractor = path.join(out, 'extract-frames');
  await exec('swiftc', ['-O', path.join(sources, 'extract.swift'), '-o', extractor]);
  const manifest = { version: 1, generatedAt: new Date().toISOString(), timing: 'Requested samples every 0.05s (every third frame at 60Hz). Actual AVFoundation presentation timestamps are listed per tile. Simulator recording is variable-rate; duplicate frames are retained and counted.',
    framing: 'Production NativeRoomScene and useRoomActivity in temporary QA route; production cat/furniture size, 393×500pt viewport; max zoom uses same 3× view transform as PetStage. Portrait uses NativeCatDisplay at 192pt. Loading records a cold launch of the actual app.', sheets: [], runs: [] };
  for (const dirName of await readdir(out)) {
    if (process.argv.includes('--extract-only') && option('--only') && !option('--only').split(',').includes(dirName)) continue;
    const dir = path.join(out, dirName), eventsFile = path.join(dir, 'events.json');
    if (!await access(eventsFile).then(() => true, () => false)) continue;
    const data = JSON.parse(await readFile(eventsFile, 'utf8'));
    if (!data.recording) continue;
    manifest.runs.push({ name: dirName, video: data.video, events: eventsFile, error: data.error, sourceChanged: data.sourceChangedDuringCapture, sessionHashes: data.sessionHashes, hashesAtRecording: data.hashesBefore });
    const mounted = data.events.find(e => e.type === 'mounted');
    const viewport = mounted?.viewport ?? { width: 393, height: 500, top: 130, ratio: 3 };
    const zoom = data.scenario.zoom ?? 1;
    let windows = [...data.windows];
    if (data.scenario.type === 'loading') {
      // Find the longest still portrait stretch, then sample its hand-off densely.
      // This adapts to Metro/native startup delays without a hand-entered timestamp.
      const scanDir = path.join(dir, 'handoff-scan'); await mkdir(scanDir, { recursive: true });
      const scan = { video: data.video, report: path.join(dir, 'handoff-scan.json'),
        frames: Array.from({ length: 85 }, (_, i) => ({ time: .75 + i * .25,
          crop: [310, 930, 560, 480], path: path.join(scanDir, `${i}.png`) })) };
      const scanSpec = path.join(dir, 'handoff-scan-spec.json');
      await writeFile(scanSpec, JSON.stringify(scan)); await exec(extractor, [scanSpec]);
      const pixels = await Promise.all(scan.frames.map(frame => sharp(frame.path).resize(64, 64).removeAlpha().raw().toBuffer()));
      const difference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
      let beginning = 0, best;
      for (let i = 1; i < pixels.length; i++) {
        if (difference(pixels[i], pixels[beginning]) <= .5) continue;
        const length = scan.frames[i - 1].time - scan.frames[beginning].time;
        if (length >= 1 && (!best || length > best.length)) best = { length, last: scan.frames[i - 1].time, changed: scan.frames[i].time };
        beginning = i;
      }
      windows = windows.filter(window => window.label === 'loading-timeline');
      if (best) {
        windows.push({ label: 'loading-still-to-live', at: data.recording.readyAt + (best.last - .5) * 1000,
          seconds: 2, step: 1 / 30 });
        manifest.runs.at(-1).loadingHandoff = { ...best, method: 'Longest stable cat-region run, mean RGB difference <= 0.5/255 at 64px; dense frames bracket the next visual change. Review the exact transition in the sheet.' };
      }
    }
    if (['locomotion', 'sofa', 'sleep', 'eat', 'play'].includes(data.scenario.type)) {
      const steps = data.events.filter(e => e.type === 'step' && e.at > data.recording.readyAt && e.animation !== 'idle');
      windows.push(...steps.filter(e => !e.native?.blocked).map((e, i) => ({
        label: `${e.kind}-${e.animation}${e.pose ? `-${e.pose}` : ''}${e.reverse ? '-reverse' : ''}-${i + 1}`,
        at: e.at - (e.native?.jump ? 100 : 0), seconds: Math.max(.4, Math.min(e.native?.jump ? 2.5 : 1.5, ((steps[i + 1]?.at ?? e.at + 2000) - e.at) / 1000 + (e.native?.jump ? .2 : -.05))), stepData: e,
      })));
    }
    const eating = data.events.find(e => e.type === 'step' && e.animation === 'eating');
    if (eating) windows.push({ label: 'eating-contact', at: eating.at + 3000, seconds: 2 });
    const positions = data.events.filter(e => e.type === 'position');
    const spec = { video: data.video, report: path.join(dir, 'extraction.json'), frames: [] };
    const sheets = [];
    for (const [n, window] of windows.entries()) {
      const label = `${String(n + 1).padStart(2, '0')}-${window.label}`;
      const frameDir = path.join(dir, label); await mkdir(frameDir, { recursive: true });
      // RecordVideo's readiness message bounds the movie origin; save the bound instead of claiming exact wall-clock sync.
      const start = Math.max(0, (window.at - data.recording.readyAt) / 1000);
      const step = window.step ?? .05, count = Math.floor(window.seconds / step) + 1;
      const frames = [];
      for (let i = 0; i < count; i++) {
        const time = start + i * step, wall = window.at + i * step * 1000;
        let crop;
        if (data.scenario.type === 'loading') crop = window.label === 'loading-timeline' ? [0, 450, 1179, 1550] : [285, 885, 610, 600];
        else if (data.scenario.mode === 'portrait') crop = [285, 700, 610, 610];
        else {
          const position = positions.reduce((best, p) => Math.abs(p.at - wall) < Math.abs((best?.at ?? Infinity) - wall) ? p : best, undefined) ?? { x: 0, y: 20 };
          const size = Math.round(260 * Math.min(zoom, 2.8));
          const cx = (viewport.width / 2 + position.x * zoom) * viewport.ratio;
          const cy = (viewport.top + viewport.height / 2 + position.y * zoom) * viewport.ratio;
          crop = [Math.max(0, Math.min(1179 - size, Math.round(cx - size / 2))), Math.max(0, Math.min(2556 - size, Math.round(cy - size * .60))), size, size];
        }
        const frame = { time, crop, path: path.join(frameDir, `${String(i + 1).padStart(3, '0')}.png`) }; frames.push(frame); spec.frames.push(frame);
      }
      const context = path.join(dir, `${label}-context.png`); spec.frames.push({ time: start, path: context });
      sheets.push({ scenario: dirName, label: window.label, path: path.join(dir, `${label}.png`), context,
        video: data.video, startSeconds: start, stepSeconds: step, stepData: window.stepData,
        timingUncertaintyMs: data.recording.readyAt - data.recording.startedAt, frames });
    }
    await writeFile(path.join(dir, 'extract-spec.json'), JSON.stringify(spec));
    await exec(extractor, [path.join(dir, 'extract-spec.json')]);
    const report = JSON.parse(await readFile(spec.report, 'utf8'));
    const handoff = sheets.find(sheet => sheet.label === 'loading-still-to-live');
    if (handoff) {
      const pixels = await Promise.all(handoff.frames.map(frame => sharp(frame.path).resize(128, 128).removeAlpha().raw().toBuffer()));
      const changed = pixels.findIndex((buffer, i) => i > 0 && buffer.reduce((sum, value, j) => sum + Math.abs(value - pixels[0][j]), 0) / buffer.length > 1);
      if (changed > 0) {
        sheets.push({ ...handoff, label: 'loading-last-still-first-live',
          path: path.join(dir, '03-loading-last-still-first-live.png'),
          startSeconds: handoff.frames[changed - 1].time,
          frames: handoff.frames.slice(changed - 1, changed + 1),
          handoffTiles: [changed, changed + 1],
          detection: 'First cat-region mean RGB difference > 1/255 from the stable reference, measured at 128px. Pair retains original recorded frames.' });
      }
    }
    for (const sheet of sheets) {
      const pair = sheet.label === 'loading-last-still-first-live';
      const tiles = [], columns = Math.min(6, sheet.frames.length), tile = pair ? 740 : data.scenario.type === 'loading' ? 300 : zoom > 1 ? 740 : 420;
      const tileHeight = pair ? 770 : data.scenario.type === 'loading' ? 424 : tile + 30;
      sheet.actualFrames = sheet.frames.map(frame => report.frames.find(r => r.path === frame.path));
      sheet.uniqueFrames = new Set(sheet.actualFrames.map(f => f.actual)).size;
      for (const [i, frame] of sheet.frames.entries()) {
        const actual = sheet.actualFrames[i]; if (actual.error) throw new Error(actual.error);
        const pic = await sharp(frame.path).resize(tile, tileHeight - 30, { fit: 'contain', background: '#fff5eb', kernel: 'nearest' }).toBuffer();
        tiles.push({ input: pic, left: i % columns * tile, top: Math.floor(i / columns) * tileHeight + 40 });
        tiles.push({ input: caption(`${i + 1} · ${actual.actual.toFixed(3)}s`, tile), left: i % columns * tile, top: Math.floor(i / columns) * tileHeight + tileHeight - 30 + 40 });
      }
      tiles.push({ input: caption(`${sheet.scenario} / ${sheet.label} · ${sheet.uniqueFrames}/${sheet.frames.length} distinct captured frames`, columns * tile, 40), left: 0, top: 0 });
      await sharp({ create: { width: columns * tile, height: Math.ceil(sheet.frames.length / columns) * tileHeight + 40, channels: 3, background: '#fff5eb' } }).composite(tiles).png().toFile(sheet.path);
      manifest.sheets.push(sheet);
    }
    const expected = new Set(sheets.flatMap(sheet => [path.basename(sheet.path), path.basename(sheet.context), path.basename(sheet.path, '.png')]));
    for (const name of await readdir(dir)) if (/^\d{2}-/.test(name) && !expected.has(name)) await rm(path.join(dir, name), { recursive: true, force: true });
  }
  const overview = [], columns = 5, width = 300, height = 330;
  for (const [i, sheet] of manifest.sheets.entries()) {
    const frame = sheet.frames[Math.floor(sheet.frames.length / 2)];
    overview.push({ input: await sharp(frame.path).resize(width, 280, { fit: 'contain', background: '#fff5eb' }).toBuffer(), left: i % columns * width, top: Math.floor(i / columns) * height });
    overview.push({ input: caption(`${i + 1}. ${sheet.scenario}`, width), left: i % columns * width, top: Math.floor(i / columns) * height + 280 });
    overview.push({ input: caption(sheet.label.slice(0, 38), width, 20), left: i % columns * width, top: Math.floor(i / columns) * height + 310 });
    sheet.overviewTile = i + 1;
  }
  if (overview.length) await sharp({ create: { width: columns * width, height: Math.ceil(manifest.sheets.length / columns) * height, channels: 3, background: '#fff5eb' } }).composite(overview).png().toFile(path.join(out, 'overview.png'));
  manifest.overview = path.join(out, 'overview.png');
  await writeFile(path.join(out, 'sheet-index.txt'), manifest.sheets.map((sheet, i) =>
    `${i + 1}. ${sheet.scenario} / ${sheet.label}\nSheet: ${sheet.path}\nContext: ${sheet.context}\nVideo: ${sheet.video}\nTiming: ${sheet.startSeconds.toFixed(3)}s, step ${sheet.stepSeconds.toFixed(5)}s, ${sheet.frames.length} tiles, ${sheet.uniqueFrames} distinct presentation timestamps\n`).join('\n')); 
  manifest.sheets = manifest.sheets.map(({ frames, actualFrames, stepData, ...sheet }) => ({ ...sheet,
    tileCount: frames.length, actualFrameTimes: actualFrames.map(frame => Number(frame.actual.toFixed(4))),
    action: stepData ? { kind: stepData.kind, animation: stepData.animation, pose: stepData.pose, reverse: stepData.reverse, gait: stepData.native?.gait } : undefined,
    extractionDetails: path.join(out, sheet.scenario, 'extract-spec.json') }));
  await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${manifest.sheets.length} sheets: ${out}/manifest.json`);
}
if (process.argv.includes('--extract-only')) { await extractAll(); process.exit(0); }
try {
  console.log('Waiting for the existing Metro on :8081 (will not start or restart it)');
  const deadline = Date.now() + 180000;
  while (true) {
    try { if ((await fetch('http://127.0.0.1:8081/status', { signal: AbortSignal.timeout(2000) })).ok) break; } catch {}
    if (Date.now() > deadline) throw new Error('Existing Metro :8081 is not available');
    await sleep(2000);
  }
  const container = sim('get_app_container', 'booted', 'com.mathmews.app', 'data');
  let previous = true;
  try { previous = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(container, 'Library/Preferences/com.mathmews.app.plist')], { encoding: 'utf8' })).RCTDevMenu?.hotLoadingEnabled ?? true; } catch {}
  const fixture = (await readFile(path.join(sources, 'fixture.tsx'), 'utf8')).replace('const PREVIOUS_FAST_REFRESH = true;', `const PREVIOUS_FAST_REFRESH = ${!!previous};`);
  const handle = await open(route, 'wx'); installed = true; await handle.writeFile(fixture); await handle.close();
  server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    let payload; try { payload = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
    if (active?.run === payload.run) active.events.push(...payload.events);
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ command: active?.run === payload.run ? active.command : undefined }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { sim('terminate', 'booted', 'com.mathmews.app'); } catch {}
  sessionHashes = await hashes();
  sim('launch', 'booted', 'com.mathmews.app'); await sleep(20000);
  const selected = option('--only')?.split(',');
  for (const scenario of scenarios.filter(s => !selected || selected.includes(s.name))) await capture(scenario);
} finally {
  await cleanup();
}
await extractAll();
