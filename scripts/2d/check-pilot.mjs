import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const source='docs/production/2d-characters/production';
async function pixels(file) { return sharp(file).ensureAlpha().raw().toBuffer(); }
function samePose(actual,expected,label) {
  // Atlas compositing rounds premultiplied antialias colors by one level.
  let error=0;
  for(let i=0;i<actual.length;i+=4) {
    error=Math.max(error,Math.abs(actual[i+3]-expected[i+3]));
    for(let c=0;c<3;c++) error=Math.max(error,Math.abs(actual[i+c]*actual[i+3]-expected[i+c]*expected[i+3])/255);
  }
  assert.ok(error<=1.01,`${label}: visible pixel difference ${error}`);
}
async function checkFrame(file) {
  const label=typeof file==='string'?file:'atlas frame';
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height],[512,320],label);
  for(let y=0;y<320;y++) for(let x=0;x<512;x++) if(x<24||x>=488||y<24||y>=296) {
    assert.ok(data[(y*512+x)*4+3]<10,`${label}: movement outside the 24px safe inset at ${x},${y}`);
  }
}
for(const id of ['cat','boba']) {
  const dir=`${source}/characters/${id}`;
  const svg=await fs.readFile(`${dir}/character.svg`,'utf8');
  assert.ok(!/<image|<script|<text/.test(svg),'Masters must be real standalone vector art');
  for(const group of ['root','head','body','face','ear-left','ear-right','foot-left','foot-right','front-left','front-right','accessory']) assert.ok(svg.includes(`id="${group}"`),`${id}: ${group}`);
  assert.deepEqual((await sharp(`${dir}/model-sheet.png`).metadata()).width,2048);
  const rig=JSON.parse(await fs.readFile(`${dir}/rig.json`,'utf8')); assert.deepEqual(rig.floorAnchor,[256,464]);
  for(const [action,count] of [['greet',8],['acknowledge',8],['celebrate',16]]) {
    const clip=`${dir}/clips/${action}`;
    const frames=await fs.readdir(`${clip}/frames`); assert.equal(frames.length,count);
    for(const frame of frames) await checkFrame(`${clip}/frames/${frame}`);
    assert.deepEqual(await pixels(`${clip}/final.png`),await pixels(`${clip}/frames/${String(count-1).padStart(2,'0')}.png`));
  }
}
let shippingBytes=0;
for(const coat of ['orange','grey','white']) {
  const dir=`assets/2d/bosses/picnic-boba-2d/${coat}`;
  const hashes=[];
  for(let i=0;i<4;i++) {await checkFrame(`${dir}/state-${i}.png`);hashes.push((await pixels(`${dir}/state-${i}.png`)).toString('base64'));}
  assert.equal(new Set(hashes).size,4,'Each checkpoint changes the scene');
  for(const [clip,count,state] of [['reaction-1',8,1],['reaction-2',8,2],['outcome',16,3]]) {
    const file=`${dir}/${clip}.webp`, atlas=sharp(file), meta=await atlas.metadata();
    assert.deepEqual([meta.width,meta.height,meta.hasAlpha],[2048,count/4*320,true]);
    const frames=[];
    for(let i=0;i<count;i++) {
      const buffer=await atlas.clone().extract({left:i%4*512,top:Math.floor(i/4)*320,width:512,height:320}).png().toBuffer();
      await checkFrame(buffer); frames.push(await pixels(buffer));
    }
    assert.ok(new Set(frames.map(f=>f.toString('base64'))).size>=4,`${clip}: actual motion`);
    samePose(frames.at(-1),await pixels(`${dir}/state-${state}.png`),`${clip}: destination hold`);
    samePose(frames[0],await pixels(`${dir}/state-${state-1}.png`),`${clip}: previous checkpoint`);
  }
  for(const file of await fs.readdir(dir)) shippingBytes+=(await fs.stat(`${dir}/${file}`)).size;
}
assert.ok(shippingBytes<2*1024*1024,'Three-coat runtime pilot fits the provisional 2MiB budget');
const curriculum=JSON.parse(await fs.readFile('data/puzzle-curriculum.json','utf8'));
const bosses=curriculum.lessons.flatMap(l=>l.levels).filter(l=>l.story?.sceneId==='picnic-balloon');
assert.equal(bosses.length,1,'One selected boss only');
assert.equal(bosses[0].id,'easy-addition-explore-5-lesson-5-boss');
assert.equal(bosses[0].story.stages.length,3);
const localized=[];
function collect(value) {
  if(!value||typeof value!=='object') return;
  if(typeof value.en==='string') localized.push(value.en,value.lv);
  else Object.values(value).forEach(collect);
}
collect(bosses[0].story);
assert.ok(!/balloon|branches|balon|zaros/i.test(localized.join(' ')),'Pilot copy describes the picnic consistently');
console.log(`Verified layered masters, six character clips, 96 pilot frames, three coat variants, exact scene endpoints, safe bounds, one selected boss. Shipping media: ${shippingBytes} bytes.`);
