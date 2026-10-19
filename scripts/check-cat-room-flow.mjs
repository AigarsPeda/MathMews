/** Native gait/velocity continuity at room thresholds, with fresh actor mounts. */
import assert from 'node:assert/strict';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,load,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const {catPacedPath,catWalkTiming,catTravelProgress,catWalkExitRate}=load('@/utils/native-cat-locomotion');
const {FLOOR_Y}=load('@/utils/native-room-world');
const dist=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const close=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${a} matches ${b}`);
for(const initial of [0,.3,.8,10]) {
  const end=catWalkExitRate(2,.2,initial),h=1e-7;
  close(catTravelProgress(h,2,.2,initial,end)/h,Math.min(initial,.9/.2));
  close((1-catTravelProgress(2-h,2,.2,initial,end))/h,end);
  assert.equal(catTravelProgress(2,2,.2,initial,end),1);
}
enableActorCrossfade();
for(const skin of ['orange','grey','white'])for(const fps of [30,60,120])for(const gait of ['walk','trot','run']) {
  let incoming;
  for(const [index,name]of ['bedroom','livingRoom','kitchen','bathroom'].entries()) {
    openSkin(skin);resetCatActor();
    // Viewports can size cats differently. A doorway transfers body lengths/s,
    // not a world-unit velocity tied to the previous room's scale.
    const scale=index%2?.32:.45,home=[-1.6,FLOOR_Y,-.6];
    const world={width:390,height:420,catScale:scale,radius:.2*scale,home,objects:[]};
    const target=[1.6,FLOOR_Y,.6],path=catPacedPath([home,target],scale);
    const timing=catWalkTiming(path,scale,gait,undefined,true),ends=[],animation={value:{name:'',time:0}};
    const travel={path,...timing,distance:dist(home,target),jump:false,through:true,entryMotion:incoming,awaitCompletion:true,
      // Obstacle itineraries sample their first walk through catMotionSample.
      // Exercise that code path too, rather than only plain floor routes.
      legs:index===2?[{kind:'walk',path,...timing}]:undefined};
    const props={active:true,world,initialPosition:home,playback:walking,activityKey:name,travel,animationTimeValue:animation,
      onRoomStepComplete:(key,position,motion)=>ends.push({key,position,motion})};
    render(props);drawCat(0);
    if(incoming) {
      assert.equal(actorState().turnDuration,0,'An entering cat faces its validated entry path without another stationary turn');
      close(actorState().distance/(actorState().walkStride*scale)+actorState().walkOffset,incoming.phase);
      incoming.tailYaw.forEach((v,k)=>close(actorState().tailYaw[k],v));
      incoming.tailPitch.forEach((v,k)=>close(actorState().tailPitch[k],v));
      assert.ok(incoming.spinePose,'Doorway transfer includes the flexed back');
      for(const [key,value]of Object.entries(incoming.spinePose))close(actorState().spinePose[key],value,1e-7);
      assert.ok(animation.value.name!=='idle','The first displayed doorway pose keeps walking');
    }
    let last=[...home],minimum=Infinity,nearEnd=Infinity;
    for(let i=0;i<fps*15&&!ends.length;i++) {
      drawCat(1/fps);const state=actorState(),bones=actorBones(),speed=dist(state.position,last)*fps/scale;
      for(const m of Object.values(bones))assert.ok(m.every(Number.isFinite));
      if(incoming&&i<fps*.12)minimum=Math.min(minimum,speed);
      if(state.elapsed>state.routeDuration-.15&&state.elapsed<state.routeDuration-.04)nearEnd=Math.min(nearEnd,speed);
      if(i===Math.round(fps*.4)) {
        const frozen=bones;render({...props,active:false});drawCat(.5);
        for(const key of Object.keys(frozen))assert.ok(dist(actorBones()[key],frozen[key])<1e-7,'Doorway travel pauses the complete rig');
        render(props);drawCat(0);
      }
      last=[...state.position];
    }
    assert.equal(ends.length,1,'A doorway arrival fires once');
    assert.ok(dist(ends[0].position,target)<1e-6);
    assert.ok(nearEnd>.7,'The outgoing cat does not brake to zero at the doorway');
    assert.ok(ends[0].motion?.speed>.7,'The new room receives nonzero speed');
    if(incoming)assert.ok(minimum>incoming.speed*.55,'Room entry begins with incoming speed rather than a fresh acceleration from rest');
    assert.notEqual(animation.value.name,'idle','Boundary dispatch does not insert an idle pose');
    close(((animation.value.time/1)%1+1)%1,((ends[0].motion.phase%1)+1)%1,.02);
    incoming=ends[0].motion;
    for(let i=0;i<3;i++)drawCat(1/fps);
    assert.equal(ends.length,1,'Delayed JS dispatch cannot duplicate arrival');
  }
}
console.log('Verified three coats at 30/60/120 FPS through four fresh room actors: nonzero exit/entry speed, stride and tail handoff, no idle insertion, scale changes, pause/resume and one arrival per threshold.');
