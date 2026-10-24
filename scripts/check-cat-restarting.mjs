/** Interrupted floor commands retain the visible pose, then finish normally. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,load,walking,idle,enableActorCrossfade} from './check-cat-turning.mjs';
const {catPacedPath,catWalkTiming}=load('@/utils/native-cat-locomotion');
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const names=['head','tailTip','L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const metrics=[];
enableActorCrossfade();
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120]) {
  openSkin(skin);resetCatActor();
  const scale=.4,home=[0,.068,0],world={width:390,height:420,catScale:scale,radius:.16,home,objects:[]};
  const base={active:true,world};let revision=0,props,end,maxJump=0,maxStep=0,minPaw=Infinity;
  render({...base,playback:idle});drawCat(0);
  function frames(n) {
    for(let i=0;i<n;i++) {
      const before=actorBones();drawCat(1/fps);const after=actorBones();
      for(const name of names.slice(2))minPaw=Math.min(minPaw,(after[name][13]-actorState().position[1])/scale);
      for(const m of Object.values(after))assert.ok(m.every(Number.isFinite));
      for(const name of names)maxStep=Math.max(maxStep,distance(before[name].slice(12,15),after[name].slice(12,15))/scale);
    }
  }
  function command(playback,turn=0) {
    const before=actorBones(),position=[...actorState().position],heading=actorState().heading+turn;
    end=[position[0]+Math.sin(heading),position[1],position[2]+Math.cos(heading)];
    const path=catPacedPath([position,end],scale);
    props={...base,playback,activityKey:`interrupt-${revision++}`,
      ...(playback===walking?{travel:{path,...catWalkTiming(path,scale,'walk'),distance:1,jump:false}}:{})};
    render(props);drawCat(0);const after=actorBones();
    assert.ok(distance(position,actorState().position)<1e-7,'Command cannot teleport the root');
    for(const name of names)maxJump=Math.max(maxJump,distance(before[name].slice(12,15),after[name].slice(12,15))/scale);
    assert.ok(maxJump<.001,`${skin}/${fps}: interrupted pose jumps ${maxJump}`);
  }
  command(walking);frames(Math.round(fps*.7));
  // Interrupt both a full stride and the first supported step, at varied phases.
  for(const seconds of [1/120,.025,.05,.10,.16,.24]) {
    command(idle);frames(Math.max(1,Math.round(fps*seconds)));
    command(walking);frames(Math.max(1,Math.round(fps*seconds)));
  }
  command(idle);frames(Math.max(1,Math.round(fps*.05)));
  command(walking,.9);frames(Math.round(fps*.08));
  const paused=actorBones();render({...props,active:false});drawCat(.4);
  for(const name of names)assert.ok(distance(paused[name],actorBones()[name])<1e-7,'Pause holds recovery');
  render(props);drawCat(0);
  for(const name of names)assert.ok(distance(paused[name],actorBones()[name])<1e-7,'Resume retains recovery');
  frames(Math.ceil((props.travel.duration+.6)*fps));
  assert.ok(distance(actorState().position,end)<1e-6,'Final command arrives exactly');
  assert.ok(actorState().recoveryTime>=.18,'Correction releases fully');
  assert.ok(maxStep<12/fps,`${skin}/${fps}: recovery frame step ${maxStep}`);
  assert.ok(minPaw>.06,`${skin}/${fps}: paw penetrates floor (${minPaw})`);
  metrics.push({skin,fps,maxJump,maxStep,minPaw});
}
fs.writeFileSync('/tmp/brainpet-restarting/metrics.json',JSON.stringify(metrics,null,2));
console.log('Verified rapid stop/restart across three coats at 30/60/120 FPS: pose continuity, bounded frame movement, pause/resume, exact arrival and completed recovery.');
