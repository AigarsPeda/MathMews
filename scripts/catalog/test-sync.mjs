import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { planCatalog, syncCatalog } from './sync.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'brainpet-catalog-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for (const file of ['data/room-catalog.json','data/store-prices.json','constants/cat-rooms.ts','locales/en.json','locales/lv.json','scripts/3d/inventory.json']) {
    fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
    fs.copyFileSync(file,path.join(root,file));
  }
  fs.cpSync('supabase/migrations',path.join(root,'supabase/migrations'),{recursive:true});
  return root;
}
function addRoom(root) {
  const file=path.join(root,'data/room-catalog.json');const rooms=JSON.parse(fs.readFileSync(file));
  rooms.push({...rooms[0],id:'room31',initialPrice:64,en:{name:'New room',description:'Linen and cork'},lv:{name:'Jauna istaba',description:'Lins un korķis'}});
  fs.writeFileSync(file,JSON.stringify(rooms));
}
test('one room definition generates registrations, locales and an insert-only migration', t => {
  const root=fixture(t);addRoom(root);
  const before=fs.readFileSync(path.join(root,'supabase/migrations/202610160004_wallet_catalog.sql'),'utf8');
  assert.throws(()=>syncCatalog(root,{check:true}),/out of date/);
  const result=syncCatalog(root,{now:new Date('2026-10-17T12:00:00Z')});
  assert.ok(result.migration);
  assert.match(fs.readFileSync(path.join(root,result.migration),'utf8'),/\('room','room31',64\)/);
  assert.match(fs.readFileSync(path.join(root,result.migration),'utf8'),/on conflict\(kind,item_id\) do nothing/);
  assert.match(fs.readFileSync(path.join(root,'constants/cat-rooms.ts'),'utf8'),/room31: require/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'locales/en.json'))).store.roomStyles.room31.name,'New room');
  assert.equal(fs.readFileSync(path.join(root,'supabase/migrations/202610160004_wallet_catalog.sql'),'utf8'),before);
  assert.equal(syncCatalog(root).migration,null);
  assert.deepEqual(syncCatalog(root,{check:true}).changed,[]);
});
test('changing a bundled display default never overwrites a server-managed price', t => {
  const root=fixture(t),file=path.join(root,'data/room-catalog.json'),rooms=JSON.parse(fs.readFileSync(file));
  rooms[0].initialPrice=99;fs.writeFileSync(file,JSON.stringify(rooms));
  assert.equal(planCatalog(root).sql,null);
  syncCatalog(root);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'data/store-prices.json'))).room.room1,99);
});
test('invalid definitions fail before writing or creating a migration', t => {
  const root=fixture(t),file=path.join(root,'data/room-catalog.json'),original=fs.readFileSync(file,'utf8');
  const files=fs.readdirSync(path.join(root,'supabase/migrations'));
  for (const mutate of [rooms=>rooms.push(rooms[0]),rooms=>rooms[0].initialPrice=-1,
    rooms=>rooms[0].wall.pattern='missing',rooms=>rooms[0].lv.name='',rooms=>rooms.pop()]) {
    const rooms=JSON.parse(original);mutate(rooms);fs.writeFileSync(file,JSON.stringify(rooms));
    assert.throws(()=>syncCatalog(root));
    assert.deepEqual(fs.readdirSync(path.join(root,'supabase/migrations')),files);
  }
});
