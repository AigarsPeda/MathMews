/** Explicitly reset one simulator's learning paths without touching its other storage. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const device=process.argv[process.argv.indexOf('--device')+1];
if(!process.argv.includes('--device')||!/^[0-9A-F-]{36}$/i.test(device??''))throw new Error('Pass --device <simulator UUID>. Add --apply to reset.');
const apply=process.argv.includes('--apply');
const container=execFileSync('xcrun',['simctl','get_app_container',device,'com.mathmews.app','data'],{encoding:'utf8'}).trim();
const directory=path.join(container,'Library/Application Support/com.mathmews.app/RCTAsyncLocalStorage_V1'),manifestFile=path.join(directory,'manifest.json');
if(apply)try{execFileSync('xcrun',['simctl','terminate',device,'com.mathmews.app'],{stdio:'pipe'});}catch(error){if(!String(error.stderr).includes('found nothing to terminate'))throw error;}
const manifest=JSON.parse(fs.readFileSync(manifestFile));
const keys=Object.keys(manifest).filter(k=>k.endsWith('/game-save'));
if(keys.length!==1)throw new Error(`Expected one profile; found ${keys.length}. No reset performed.`);
const key=keys[0],hash=crypto.createHash('md5').update(key).digest('hex'),saveFile=path.join(directory,hash);
const original=JSON.parse(manifest[key]??fs.readFileSync(saveFile,'utf8'));
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../../utils/reset-puzzle-progress.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Set});
const next=JSON.parse(JSON.stringify(module.exports.resetPuzzleProgress(original)));
const allowed=new Set(['lifetimeCompletedPuzzleIds','completedPuzzleIds','attemptedPuzzleIds','completedPathLessonIds','unlockedPathLessonIds','pathVersion','puzzlesSolved','puzzleStreak','topicStats','topicStatsByDifficulty','learningEvidence','learningSupportIds','reviewAttemptKeys','challengeAttempt']);
for(const k of Object.keys(original))if(k!=='progress')assert.deepEqual(next[k],original[k],`${k} changed`);
for(const k of Object.keys(original.progress))if(!allowed.has(k))assert.deepEqual(next.progress[k],original.progress[k],`${k} changed`);
assert.equal(next.progress.completedPuzzleIds.length,0);
assert.equal(next.progress.attemptedPuzzleIds.length,0);
if(!apply){console.log(`Ready to reset ${original.progress.completedPuzzleIds?.length??0} completions on ${device}. All unrelated fields match. Pass --apply to execute.`);process.exit(0);}
const backup=path.join(os.homedir(),'Library/Application Support/MathMews/Backups',`puzzle-reset-${new Date().toISOString().replaceAll(':','-')}`);
fs.mkdirSync(backup,{recursive:true,mode:0o700});fs.writeFileSync(path.join(backup,'save-before.json'),JSON.stringify(original,null,2),{mode:0o600});
fs.writeFileSync(path.join(backup,'metadata.json'),JSON.stringify({device,key,previousUpdatedAt:manifest[`${key}-updated-at`]},null,2),{mode:0o600});
const raw=JSON.stringify(next);
if(manifest[key]===null){fs.writeFileSync(saveFile+'.reset',raw,{mode:0o600});fs.renameSync(saveFile+'.reset',saveFile);}else manifest[key]=raw;
manifest[`${key}-updated-at`]=String(Date.now());
fs.writeFileSync(manifestFile+'.reset',JSON.stringify(manifest));fs.renameSync(manifestFile+'.reset',manifestFile);
const stored=JSON.parse(manifest[key]??fs.readFileSync(saveFile,'utf8'));assert.deepEqual(stored,next);
console.log(JSON.stringify({reset:true,previousCompletions:original.progress.completedPuzzleIds?.length??0,completions:0,achievements:0,unrelatedFieldsUnchanged:true,backup},null,2));
