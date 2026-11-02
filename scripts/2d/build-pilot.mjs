/** Editable vector masters and deterministic eight-fps exports. No image-model frame redraws. */
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = 'docs/production/2d-characters/production';
const spec = JSON.parse(await fs.readFile('docs/production/2d-characters/asset-plan.json', 'utf8'));
const ink = '#2D3436', cream = '#FFF0D8';
const coats = { orange: ['#F5A44C', '#CC7A32', cream], grey: ['#ADB4C0', '#737D90', '#F7F5F1'], white: ['#FAF8F3', '#D7D5D2', '#FFFFFF'] };
const ellipse = (x,y,rx,ry,fill,stroke=ink) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}"/>`;
const draw = (d,fill='none',extra='') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const group = (id,body,transform='') => `<g id="${id}" transform="${transform}">${body}</g>`;
export const svg = (body,w=512,h=512) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="${ink}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
const smooth = v => { const t=Math.max(0,Math.min(1,v)); return t*t*(3-2*t); };
const blend = (t,a,b) => smooth((t-a)/(b-a));
function face(expression='neutral',offset=0) {
  const happy=['pleased','proud','reassuring'].includes(expression);
  const eyes=happy ? draw('M225 244 Q235 232 245 244 M294 244 Q304 232 314 244', 'none','stroke-width="4"') : ellipse(236,244,7,12,ink)+ellipse(305,244,7,12,ink);
  const brows=expression==='curious'?draw('M225 220 L244 214 M297 219 L314 223','none','stroke-width="3"'):expression==='proud'?draw('M224 222 Q235 217 245 222 M295 222 Q306 217 316 222','none','stroke-width="3"'):expression==='reassuring'?draw('M225 220 L244 224 M297 224 L314 220','none','stroke-width="3"'):'';
  return group('face',brows+eyes+draw('M262 263 Q271 258 280 263 L271 272 Z',ink)+
    (expression==='surprised' ? ellipse(271,286,7,9,ink) : draw('M271 273 Q260 289 251 278 M271 273 Q282 289 291 278','none','stroke-width="3"')),`translate(${offset} 0)`);
}
export function character(id,{coat='orange',expression='neutral',head=0,paw=0,ear=0,hop=0,reach=0,view='three_quarter'}={}) {
  const cat=id==='cat', [fur,stripe,light]=cat?coats[coat]:[cream,cream,cream];
  const side=view==='side', front=view==='front';
  const tailShape='M181 405 C82 400 66 335 92 293 C115 256 104 240 91 242 C56 247 57 280 67 302 C38 374 85 451 183 441';
  let tail=cat?`<defs><clipPath id="tail-stripe-clip">${draw(tailShape,fur)}</clipPath></defs>`+draw(tailShape,fur)+draw('M65 318 L92 330 M66 354 L93 362 M81 387 L107 391','none',`stroke="${stripe}" stroke-width="15" clip-path="url(#tail-stripe-clip)"`):ellipse(360,397,31,30,light);
  const body=cat?draw('M203 299 C178 326 165 380 168 429 Q165 464 209 464 L321 464 Q356 463 351 425 L329 315 Z',fur)+draw('M242 306 Q219 377 233 449 L307 449 Q321 381 291 312 Z',light):draw('M209 290 C175 322 164 383 176 425 Q188 459 266 459 Q351 459 358 420 C361 367 336 316 311 294 Z',light);
  const feet=group('foot-left',ellipse(cat?202:209,449,cat?31:49,15,cat?light:cream))+group('foot-right',ellipse(cat?322:322,449,cat?31:49,15,cat?light:cream));
  const left=cat?draw(`M220 334 Q198 367 208 414 Q217 437 237 419 L${241+reach} ${383-reach*.5}`,light):draw(`M211 324 Q177 345 ${190-reach} ${377-reach*.18} Q${190-reach} ${401-reach*.18} ${214-reach} ${392-reach*.18} L244 343`,light);
  const right=cat?draw(`M294 332 Q${335+reach} 347 ${325+reach} 388 Q${325+reach} 413 ${306+reach} 411 L288 367`,light):draw('M309 324 Q343 345 335 380 Q324 405 305 387 L286 343',light);
  const ears=cat?group('ear-left',draw('M184 194 L176 100 Q181 91 190 100 L236 154 Z',fur)+draw('M188 165 L185 121 L215 157 Z','#F3A6B6'))+group('ear-right',draw('M289 151 L338 94 Q348 86 350 105 L351 201 Z',fur)+draw('M314 161 L341 117 L339 173 Z','#F3A6B6')):
    group('ear-left',draw('M206 204 C158 141 151 48 170 38 C193 28 222 134 240 201 Z',light)+draw('M204 175 Q174 95 177 70 Q192 89 221 180 Z','#F3A6B6'),`rotate(${ear} 220 200)`)+group('ear-right',draw('M285 202 Q284 92 321 51 Q344 27 363 63 L374 87 Q375 104 355 101 L330 81 Q312 151 315 207 Z',light)+draw('M299 176 Q303 122 324 91 L335 99 L316 185 Z','#F3A6B6'));
  const skull=cat?draw('M181 190 Q172 156 226 151 Q276 136 322 160 Q359 175 360 223 Q375 297 291 313 Q208 329 178 275 Q164 246 181 190 Z',fur)+draw('M258 149 Q280 204 273 249 Q321 250 358 232 Q360 296 291 313 Q209 327 180 275 L179 246 Q225 253 246 238 Q251 195 244 151 Z',light):draw('M201 208 Q261 165 321 204 Q363 229 357 273 Q352 320 273 323 Q189 326 179 279 Q170 236 201 208 Z',light);
  const accents=cat?draw('M209 167 L218 188 M229 157 L236 178 M317 172 L310 189','none',`stroke="${stripe}" stroke-width="9"`)+draw('M190 269 L156 261 M190 280 L154 285 M334 268 L372 259 M335 281 L373 288','none','stroke-width="3"'):'';
  const accessory=cat?group('accessory',draw('M223 316 Q271 334 318 311','none','stroke-width="7"')+ellipse(271,328,10,12,'#E7B447')):group('accessory',draw('M210 199 Q208 165 255 165 Q299 165 316 198 Z','#69C5BC')+draw('M202 201 Q269 183 331 194 Q350 206 325 215 Q261 206 202 215 Z','#69C5BC'));
  const profile=draw(cat?'M208 192 Q215 150 283 155 Q326 158 333 214 L365 239 Q379 253 359 265 L341 269 Q334 311 277 314 Q208 315 199 263 Z':'M208 217 Q253 176 302 208 Q328 226 330 244 L358 256 L331 267 Q330 311 273 322 Q205 323 196 275 Z',fur)+ellipse(310,241,7,11,ink)+draw('M342 250 L356 255 L343 262 Z',ink)+draw('M336 275 Q322 288 313 279','none','stroke-width="3"');
  const headBody=ears+(side?profile:skull+accents+face(expression,front?-12:0))+(cat?'':accessory);
  return group('root',group('tail',tail)+group('body',body)+feet+
    group('front-left',left,`rotate(${paw} ${cat?220:211} 334)`)+group('front-right',right)+
    group('head',headBody,`rotate(${head} 270 305)`)+(cat?accessory:''),`translate(0 ${-hop}) ${side?'translate(60 0) scale(.78 1)':''}`);
}
export function actionPose(action,t) {
  const gesture=Math.sin(Math.PI*blend(t,.08,.78));
  return { head:action==='acknowledge'?gesture*9:-gesture*7, paw:action==='greet'?gesture*55:0, ear:-gesture*9,
    hop:action==='celebrate'?Math.sin(Math.PI*blend(t,.15,.65))*22:0, expression:t>.4?'pleased':'neutral' };
}
export function picnic(phase,t,coat='orange') {
  const u=blend(t,.08,.72);
  let opened=phase===0?0:phase===1?u:phase===2?1-u:0;
  const packed=phase>=3?1:phase===2?u:0;
  const complete=phase===4?1:phase===3?u:0;
  const pleased=phase===4||phase===3&&t>.65;
  const cat=group('cat-actor',character('cat',{coat,head:phase===1?u*8:phase===2?(1-u)*8:0,reach:phase===2?Math.sin(Math.PI*u)*95:0,expression:pleased?'pleased':'neutral'}),'translate(41 49) scale(.48)');
  const boba=group('boba-actor',character('boba',{ear:phase===1?-u*6:phase===2?-(1-u)*6:0,reach:phase===1||phase===2?Math.sin(Math.PI*u)*110:phase===3?Math.sin(Math.PI*u)*110:0,expression:pleased?'pleased':'neutral'}),'translate(264 40) scale(.5)');
  const blanket=group('blanket',draw(`M${125-complete*22} 274 L${173+complete*130} 274 L${188+complete*145} 290 L${136-complete*40} 290 Z`,'#69C5BC')+draw(`M${145-complete*20} 276 L${155+complete*40} 288`,'none','stroke="#FFF0D8" stroke-width="3"'));
  const basketX=complete*31, basketY=-complete*5;
  const basket=group('basket',draw('M230 238 Q233 230 242 230 L287 230 Q300 231 301 240 L294 269 L237 269 Z','#E7B447')+draw('M247 234 L247 216 Q264 195 282 216 L282 234','none','stroke-width="5"')+
    group('lid',draw('M229 235 Q265 222 303 235 L302 240 L230 240 Z','#CC7A32'),`rotate(${opened*95} 303 235)`)+draw('M248 244 L249 261 M263 244 L264 261 M279 244 L278 261','none','stroke-width="2"'),`translate(${basketX} ${basketY})`);
  const bundle=packed<1?group('lunch-bundle',draw('M188 244 Q183 235 193 230 L212 230 Q226 235 221 249 L215 258 L192 258 Z',cream)+draw('M194 230 L212 255 M214 230 L194 255','none','stroke="#F3A6B6" stroke-width="4"'),`translate(${packed*65} ${-Math.sin(packed*Math.PI)*18})`):'';
  return svg(blanket+cat+boba+bundle+basket,512,320);
}
async function write(file,body) { await fs.mkdir(path.dirname(file),{recursive:true}); await fs.writeFile(file,body); }
async function png(file,source) { await fs.mkdir(path.dirname(file),{recursive:true}); await sharp(Buffer.from(source)).png().toFile(file); }
async function pack(dir,frames,writeFrames=true) {
  if(writeFrames) for(let i=0;i<frames.length;i++) await write(`${dir}/frames/${String(i).padStart(2,'0')}.png`,frames[i]);
  await sharp({create:{width:2048,height:frames.length/4*320,channels:4,background:'#00000000'}}).composite(frames.map((input,i)=>({input,left:i%4*512,top:Math.floor(i/4)*320}))).webp({lossless:true,effort:5}).toFile(`${dir}/atlas.webp`);
}
async function build() {
  for(const id of ['cat','boba']) {
    const dir=`${root}/characters/${id}`;
    await write(`${dir}/character.svg`,svg(character(id)));
    await write(`${dir}/rig.json`,JSON.stringify({viewBox:[0,0,512,512],floorAnchor:[256,464],groups:{root:[256,464],tail:[180,420],body:[256,400],head:[270,305],face:[271,270],'front-left':[id==='cat'?220:211,334],'front-right':[309,334],'foot-left':[209,449],'foot-right':[322,449],'ear-left':[220,200],'ear-right':[300,200],accessory:[270,200]},hierarchy:'root > tail/body/feet/front limbs/head; head > ears/face/cap; collar attached to body',bentEar:'right side of source canvas',coatTokens:coats},null,2));
    const views=['front','three_quarter','side','silhouette'];
    const label=(text,x,y)=>`<text x="${x}" y="${y}" fill="${ink}" stroke="none" font-family="sans-serif" font-size="30">${text}</text>`;
    let sheet='<rect width="2048" height="2048" fill="#FFF5EB" stroke="none"/>';
    sheet+=views.map((view,i)=>group(`view-${view}`,character(id,{view}),`translate(${i*512} 20)`)+label(view.replace('_',' '),i*512+180,550)).join('');
    sheet+=spec.expressionIds.map((expression,i)=>group(`expression-${expression}`,character(id,{expression}),`translate(${(i%3)*650+40} ${Math.floor(i/3)*600+650}) scale(1.05)`)).join('');
    sheet+=spec.expressionIds.map((expression,i)=>label(expression,(i%3)*650+240,Math.floor(i/3)*600+1200)).join('');
    const palette=Object.entries(spec.characters.find(c=>c.id===id).palette);
    sheet+=palette.map(([name,color],i)=>`<rect x="${60+i*320}" y="1880" width="70" height="70" fill="${color}"/>`+label(name,60+i*320,1990)+label(color,60+i*320,2030)).join('');
    sheet+=`<style>#view-silhouette * {fill:${ink};stroke:${ink}}</style>`;
    const model=svg(sheet,2048,2048);
    await write(`${dir}/model-sheet.svg`,model); await png(`${dir}/model-sheet.png`,model);
    for(const [action,{frames:count,durationMs}] of Object.entries(spec.actions)) {
      const clip=`${dir}/clips/${action}`, frames=[], poses=[];
      for(let i=0;i<count;i++) {
        const pose=actionPose(action,i/(count-1)); poses.push({timeMs:i*125,...pose});
        frames.push(await sharp(Buffer.from(svg(group('actor',character(id,pose),'translate(128 24) scale(.5)'),512,320))).png().toBuffer());
      }
      await fs.mkdir(clip,{recursive:true}); await pack(clip,frames); await write(`${clip}/final.png`,frames.at(-1));
      await write(`${clip}/timeline.json`,JSON.stringify({fps:8,durationMs,loop:false,poses},null,2));
    }
  }
  const sceneDir=`${root}/scenes/picnic-boba-2d`;
  const checkpoints=[[0,0],[1,1],[2,1],[4,1]];
  await write(`${sceneDir}/scene.svg`,picnic(0,0).replace('width="512" height="320" viewBox="0 0 512 320"','width="1024" height="640" viewBox="0 0 1024 640"').replace('<g stroke=','<g transform="scale(2)" stroke='));
  for(const coat of Object.keys(coats)) {
    const runtime=`assets/2d/bosses/picnic-boba-2d/${coat}`;
    for(let i=0;i<4;i++) {
      const source=picnic(...checkpoints[i],coat); await png(`${runtime}/state-${i}.png`,source);
      if(coat==='orange') await png(`${sceneDir}/state-${i}.png`,source);
    }
    for(const [clip,{frames:count}] of Object.entries(spec.sceneClipTemplate)) {
      const phase=clip==='reaction-1'?1:clip==='reaction-2'?2:3, frames=[];
      for(let i=0;i<count;i++) frames.push(await sharp(Buffer.from(picnic(phase,i/(count-1),coat))).png().toBuffer());
      const tmp=`${sceneDir}/${coat}/${clip}`; await fs.mkdir(tmp,{recursive:true}); await pack(tmp,frames,false);
      await fs.copyFile(`${tmp}/atlas.webp`,`${runtime}/${clip}.webp`);
      if(coat==='orange') {
        await fs.copyFile(`${tmp}/atlas.webp`,`${sceneDir}/${clip}.webp`);
        for(let i=0;i<count;i++) await write(`${sceneDir}/frames/${clip}-${String(i).padStart(2,'0')}.png`,frames[i]);
      }
    }
    await fs.rm(`${sceneDir}/${coat}`,{recursive:true,force:true});
  }
  await write(`${sceneDir}/timeline.json`,JSON.stringify({fps:8,source:'scripts/2d/build-pilot.mjs:picnic',transitions:spec.sceneClipTemplate,checkpoints},null,2));
  let html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Math Mews pilot</title><style>body{margin:32px;background:#FFF5EB;color:#2D3436;font:18px system-ui}h1,h2{max-width:800px}section{display:flex;gap:24px;flex-wrap:wrap;margin:24px 0}img{max-width:100%}.small{height:96px}.frame{width:320px;height:200px}button{padding:12px;font:inherit}canvas{max-width:100%}</style><h1>Cat and Boba production pilot</h1><p>Editable masters, 96 px identity checks and one-shot story clips. No art appears while solving.</p>';
  for(const id of ['cat','boba']) {
    html+=`<h2>${id}</h2><section><img width="256" src="characters/${id}/character.svg"><img class="small" src="characters/${id}/character.svg"><img width="600" src="characters/${id}/model-sheet.png"></section>`;
    for(const [action,{frames}] of Object.entries(spec.actions)) html+=`<p>${id}: ${action}</p><canvas width="512" height="320" data-src="characters/${id}/clips/${action}/atlas.webp" data-frames="${frames}"></canvas><button onclick="this.previousElementSibling.play()">Replay</button>`;
  }
  html+='<h2>Picnic checkpoints</h2><section>'+[0,1,2,3].map(i=>`<img class="frame" src="scenes/picnic-boba-2d/state-${i}.png">`).join('')+'</section><h2>One-shot playback</h2>';
  for(const [clip,{frames}] of Object.entries(spec.sceneClipTemplate)) html+=`<p>${clip}</p><canvas width="512" height="320" data-src="scenes/picnic-boba-2d/${clip}.webp" data-frames="${frames}"></canvas><button onclick="this.previousElementSibling.play()">Replay</button>`;
  html+=`<script>document.querySelectorAll('canvas').forEach(c=>{const image=new Image();image.src=c.dataset.src;const ctx=c.getContext('2d');c.play=()=>{const start=performance.now();function tick(now){const f=Math.min(+c.dataset.frames-1,Math.floor((now-start)/125));ctx.clearRect(0,0,512,320);ctx.drawImage(image,f%4*512,Math.floor(f/4)*320,512,320,0,0,512,320);if(f<+c.dataset.frames-1)requestAnimationFrame(tick)}requestAnimationFrame(tick)};image.onload=c.play});</script>`;
  await write(`${root}/preview.html`,html);
  console.log('Built Cat/Boba sources, six character clips, picnic kit and three runtime coat variants.');
}
if(import.meta.url===pathToFileURL(process.argv[1]).href) await build();
