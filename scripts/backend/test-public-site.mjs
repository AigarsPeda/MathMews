import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

const files=['index.html','privacy.html','support.html','delete-account.html'];
function fixture(run,values={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mathmews-site-'));
  const output=path.join(root,'docs');
  try {
    execFileSync(process.execPath,['scripts/backend/generate-legal-pages.mjs','--out-dir',output],{
      env:{...process.env,EXPO_PUBLIC_PUBLISHER_NAME:'',EXPO_PUBLIC_SUPPORT_EMAIL:'',REVENUECAT_SECRET_API_KEY:'sk_NEVER_PUBLISH_THIS',...values},stdio:'pipe',
    });
    return run({root,output,read:file=>fs.readFileSync(path.join(output,file),'utf8')});
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
const main=html=>html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];

test('all four pages have complete, separate English and Latvian content',()=>fixture(({read})=>{
  for(const file of files) {
    const en=read(file),lv=read('lv/'+file);
    assert.match(en,/<html lang="en">/);assert.match(lv,/<html lang="lv">/);
    assert.equal((en.match(/<h1>/g)??[]).length,1);assert.equal((lv.match(/<h1>/g)??[]).length,1);
    assert.equal((en.match(/<h2>/g)??[]).length,(lv.match(/<h2>/g)??[]).length,file);
    assert.ok(!/[āčēģīķļņšūž]/i.test(main(en)),`English content contains Latvian: ${file}`);
    assert.ok(!/TODO: publisher legal name|TODO: support email|Contact support|Missing coins/.test(main(lv)),`Untranslated Latvian content: ${file}`);
    for(const html of [en,lv])assert.ok(!/class="eyebrow"|class="number"|For parents and players|YOUR DATA|YOUR GAME|YOUR ACCOUNT/.test(html));
    assert.ok(!/sk_NEVER_PUBLISH_THIS/.test(en+lv));
  }
  for(const heading of ['Sazinies ar atbalstu','Monētu pakas','Trūkstošas monētas','Atmaksas un konta dzēšana'])assert.ok(read('lv/support.html').includes(heading));
  for(const heading of ['Pieprasi dzēšanu bez lietotnes','Dzēs kontu lietotnē','Kas tiek dzēsts un saglabāts'])assert.ok(read('lv/delete-account.html').includes(heading));
}));

test('language switches preserve the page, and every local link and asset resolves',()=>fixture(({output,read})=>{
  for(const locale of ['en','lv'])for(const file of files) {
    const relative=(locale==='lv'?'lv/':'')+file,html=read(relative);
    assert.ok(html.includes(`href="${locale==='en'?'lv/':'../'}${file}" lang="${locale==='en'?'lv':'en'}"`));
    for(const [,attribute] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if(/^(https:|mailto:|#)/.test(attribute))continue;
      const resolved=path.resolve(output,path.dirname(relative),attribute);
      assert.ok(resolved.startsWith(output+path.sep));assert.ok(fs.existsSync(resolved),`${relative}: missing ${attribute}`);
    }
  }
}));

test('publisher/contact values are escaped; missing email never creates a fake request button',()=>{
  fixture(({read})=>{
    for(const file of ['support.html','delete-account.html','lv/support.html','lv/delete-account.html'])assert.ok(!read(file).includes('mailto:'));
  });
  fixture(({read})=>{
    const en=read('delete-account.html'),lv=read('lv/delete-account.html');
    assert.ok(en.includes('&lt;Publisher &amp; Co&gt;'));assert.ok(!en.includes('<Publisher'));
    assert.ok(en.includes('mailto:support%40example.com?subject=Math%20Mews%20account%20deletion%20request'));
    assert.ok(lv.includes('mailto:support%40example.com?subject=Math%20Mews%20konta%20dz%C4%93%C5%A1anas%20piepras%C4%ABjums'));
  },{EXPO_PUBLIC_PUBLISHER_NAME:'<Publisher & Co>',EXPO_PUBLIC_SUPPORT_EMAIL:'support@example.com'});
});

test('the real Pages staging step includes both languages and the cat, excluding development notes',()=>fixture(({root,output})=>{
  fs.writeFileSync(path.join(output,'DO-NOT-PUBLISH.md'),'private development fixture');
  const workflow=fs.readFileSync('.github/workflows/github-pages.yml','utf8');
  const script=workflow.match(/name: Stage public pages\n\s+run: \|\n([\s\S]*?)(?=\n\s*- uses:)/)[1].split('\n').map(line=>line.replace(/^          /,'')).join('\n');
  execFileSync('sh',['-eu','-c',script],{cwd:root});
  for(const locale of ['','lv/'])for(const file of files)assert.ok(fs.existsSync(path.join(root,'_site',locale,file)));
  for(const file of ['site.css','assets/cat.png','.nojekyll'])assert.ok(fs.existsSync(path.join(root,'_site',file)));
  assert.ok(!fs.existsSync(path.join(root,'_site','DO-NOT-PUBLISH.md')));
}));
