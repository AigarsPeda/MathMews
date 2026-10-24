/** Exercise each authored nap through the actual GLB and native worklet. */
import assert from 'node:assert/strict';
import {load,openSkin,resetCatActor,render,drawCat,actorState,actorBones,enableActorCrossfade,sampleCatClip,deferCatNotifications,flushCatNotifications} from './check-cat-turning.mjs';
const {CAT_SLEEP_POSES,CAT_SLEEP_ENTER_MS}=load('@/constants/cat-sleep');
const {createRoomActivitySegment}=load('@/pet-display/registry/cat-model-registry');
const floor=load('@/utils/native-room-world').FLOOR_Y;
const world={width:390,height:420,catScale:.5,radius:.28,home:[0,floor,0],objects:[]};
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const rotationFrom=(pose,neutral)=>{
  let trace=0;
  for(const offset of [0,4,8]) {
    const a=pose.slice(offset,offset+3),b=neutral.slice(offset,offset+3);
    trace+=a.reduce((sum,v,k)=>sum+v*b[k],0)/(Math.hypot(...a)*Math.hypot(...b));
  }
  return Math.acos(Math.max(-1,Math.min(1,(trace-1)/2)));
};
const joints=['head','chest','pelvis','tailTip','L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
enableActorCrossfade();
for(const coat of process.argv.includes('--orange')?['orange']:['orange','grey','white']) {
  openSkin(coat);
  const silhouettes=[];
  for(const pose of CAT_SLEEP_POSES) {
    const entry=`rest${pose}Enter`,loop=`rest${pose}Sleep`;
    const rest=sampleCatClip(loop,0),settled=sampleCatClip(entry,2),seam=sampleCatClip(loop,4);
    silhouettes.push(rest.head);
    for(const name of joints) {
      assert.ok(distance(rest[name],settled[name])<1e-5,`${coat}/${pose}/${name}: entry joins the held rest`);
      assert.ok(distance(rest[name],seam[name])<1e-5,`${coat}/${pose}/${name}: loop has no seam`);
    }
    assert.ok(rest.tailTip[13]<.25,`${pose}: tail rests on the cushion`);
    assert.ok(rest.chest[13]<.45,`${pose}: body lowers into the rest`);
    assert.ok(Math.abs(sampleCatClip(loop,1).chest[13]-rest.chest[13])>.002,'A quiet breath moves the ribcage');
    const standing=sampleCatClip(entry,0);
    const wake=`rest${pose}Wake`,waking=sampleCatClip(wake,.48);
    for(const name of joints) {
      assert.ok(distance(sampleCatClip(wake,0)[name],rest[name])<1e-5,`${pose}/${name}: waking starts in the sleeping pose`);
      assert.ok(distance(sampleCatClip(wake,2)[name],standing[name])<1e-5,`${pose}/${name}: waking finishes ready for the stretch`);
    }
    assert.ok(waking.head[13]-rest.head[13]>.10,`${pose}: the head visibly lifts before rising`);
    for(const name of ['chest','pelvis','L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'])
      assert.ok(distance(waking[name],rest[name])<1e-5,`${pose}/${name}: the body and tucked paws stay supported during the head lift`);
    for(const seconds of [.4,.6,.8,1]) {
      const settling=sampleCatClip(entry,seconds);
      assert.ok(settling.head[13]-settling.chest[13] < standing.head[13]-standing.chest[13]+.03,
        `${pose}: the head follows descending shoulders without stretching the neck`);
    }
    if(pose==='Loaf') {
      const tuck=sampleCatClip(entry,1.1);
      const moved=name=>distance(tuck[name].slice(12,15),standing[name].slice(12,15));
      assert.ok(moved('L.front.paw')>moved('R.front.paw')*1.5,
        'The front paws tuck in sequence instead of collapsing together');
    }
    if(pose==='Side') {
      const lowered=sampleCatClip(entry,.7);
      assert.ok(standing.chest[13]-lowered.chest[13]>.10,'The chest lowers before rolling onto the flank');
      assert.ok(rotationFrom(lowered.chest,standing.chest)<.15,'The side sleeper does not roll while standing tall');
      assert.ok(rotationFrom(rest.chest,standing.chest)>1.2,'The body rests on its side');
      assert.ok(Math.abs(rotationFrom(rest.neck,standing.neck)-rotationFrom(rest.head,standing.head))<.15,
        'The neck shares the head and torso roll instead of staying upright');
      assert.ok(rest.tailTip[12]>.55,'The side sleeper has a loose tail beside the haunches');
    }
    if(pose==='Crescent') {
      assert.ok(rotationFrom(rest.head,standing.head)<1.25,'The curled head avoids an extreme neck twist');
    }
    for(const fps of [30,60,120]) {
      resetCatActor();
      const travel={path:[world.home],distance:0,duration:CAT_SLEEP_ENTER_MS/1000,jump:false,sleepPose:pose};
      const base={active:true,world,skinId:coat,travel};
      let previous,maxDelta=0,worst;
      const play=(name,seconds,reverse=false,key=name)=>{
        render({...base,activityKey:key,playback:{kind:'segment',mood:name==='curlSleep'?'sleeping':'lyingDown',
          segment:createRoomActivitySegment(name,reverse,name==='curlUp'?24000/CAT_SLEEP_ENTER_MS:name==='curlSleep'?6:undefined)}});
        for(let i=0;i<Math.round(seconds*fps);i++) {
          drawCat(1/fps);const bones=actorBones();
          for(const name of joints) {
            assert.ok(bones[name].every(Number.isFinite));
            if(previous) { const d=distance(bones[name].slice(12,15),previous[name].slice(12,15))/world.catScale; if(d>maxDelta){maxDelta=d;worst={name,i,key,time:actorState().clipTime,elapsed:actorState().elapsed};} }
          }
          assert.ok(distance(actorState().position,world.home)<1e-8,'Sleep and waking never slide the root');
          previous=bones;
        }
      };
      play('curlUp',2.2);
      play('curlSleep',4);
      const paused=actorBones(),clock=actorState().elapsed;
      render({...base,active:false,activityKey:'curlSleep',playback:{kind:'segment',mood:'sleeping',segment:createRoomActivitySegment('curlSleep',false,6)}});
      drawCat(.5);assert.equal(actorState().elapsed,clock,'Pause freezes sleep');
      for(const name of joints)assert.ok(distance(paused[name],actorBones()[name])<1e-6);
      play('curlUp',.55,true,'wake');
      const raised=actorBones();
      assert.ok((raised.head[13]-paused.head[13])/world.catScale>.10,`${pose}: production playback uses the forward wake clip`);
      assert.ok(distance(raised.chest.slice(12,15),paused.chest.slice(12,15))<.005,`${pose}: production playback holds the body for the head lift`);
      const wakePlayback={kind:'segment',segment:createRoomActivitySegment('curlUp',true,24000/CAT_SLEEP_ENTER_MS)};
      render({...base,active:false,activityKey:'wake',playback:wakePlayback});drawCat(.5);
      for(const name of joints)assert.ok(distance(raised[name],actorBones()[name])<1e-6,`${pose}: pausing freezes the head lift`);
      render({...base,activityKey:'wake-again',playback:wakePlayback});drawCat(0);
      for(const name of joints)assert.ok(distance(raised[name],actorBones()[name])<1e-6,`${pose}: a repeated wake command continues from the lifted head`);
      play('curlUp',1.65,true,'wake-again');play('wakeStretch',2.5);play('idle',.5);
      assert.ok(maxDelta<5/fps+.015,`${coat}/${pose}/${fps}: continuous entry, rest, wake and stand (${maxDelta}: ${JSON.stringify(worst)})`);
      resetCatActor();previous=undefined;
      play('curlUp',.9,false,'settling');
      const beforeInterrupt=actorBones();
      render({...base,activityKey:'interrupt-settling',playback:{kind:'segment',mood:'lyingDown',
        segment:createRoomActivitySegment('curlUp',true,24000/CAT_SLEEP_ENTER_MS)}});
      drawCat(0);
      for(const name of joints)assert.ok(distance(beforeInterrupt[name].slice(12,15),actorBones()[name].slice(12,15))<.005,
        `${pose}/${name}: waking during settling retains the displayed pose`);

      // A sleeping clock report can still be queued on RN when waking starts.
      // It must not become the resume clock of the new wake command.
      resetCatActor();let reportedClock=0;
      const reporting={...base,onContactPosition:(_position,elapsed)=>{reportedClock=elapsed;}};
      render({...reporting,activityKey:'old-nap',playback:{kind:'segment',segment:createRoomActivitySegment('curlSleep',false,6)}});
      for(let i=0;i<fps*3;i++)drawCat(1/fps);
      deferCatNotifications();for(let i=0;i<fps/2;i++)drawCat(1/fps);
      render({...reporting,activityKey:'fresh-wake',playback:wakePlayback});reportedClock=0;
      flushCatNotifications();
      assert.equal(reportedClock,0,`${pose}: delayed sleeping reports cannot overwrite the wake clock`);
      for(let i=0;i<fps/2;i++)drawCat(1/fps);
      assert.ok(reportedClock>0&&reportedClock<.6,`${pose}: current wake reports still update the clock`);

    }
  }
  for(let a=0;a<silhouettes.length;a++)for(let b=a+1;b<silhouettes.length;b++)
    assert.ok(distance(silhouettes[a],silhouettes[b])>.5,'Nap variants must have distinct head orientation and position');
}
console.log('Verified three distinct nap silhouettes, matched entry/loop poses, breathing, pause and smooth waking at 30/60/120 fps for each coat.');
