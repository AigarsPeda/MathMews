/** Check visible jump mechanics on the shipped skin, not just root arrival. */
import assert from 'node:assert/strict';
import {openSkin, sampleCatClip, load} from './check-cat-turning.mjs';
const motion=load('@/utils/native-cat-locomotion'),w=load('@/utils/native-room-world');
const jump=load('@/constants/cat-jump.json');
const position=(pose,name)=>pose[name].slice(12,15);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
for(const skin of ['orange','grey','white']) {
  openSkin(skin);
  const idle=sampleCatClip('idle',0);
  for(const clip of ['jumpOn','jumpOff','hop']) {
    for(const fps of [30,60,120]) {
      for(let time=0;time<=.20;time+=1/fps) {
        const pose=sampleCatClip(clip,time);
        for(const side of ['L','R'])assert.ok(distance(position(pose,side+'.rear.paw'),position(idle,side+'.rear.paw'))<.008,
          `${skin}/${clip}: hind paws support the push until takeoff at ${time}`);
      }
      for(let time=.73;time<=1;time+=1/fps) {
        const pose=sampleCatClip(clip,time);
        for(const side of ['L','R'])assert.ok(distance(position(pose,side+'.front.paw'),position(idle,side+'.front.paw'))<.008,
          `${skin}/${clip}: front paws stay planted while the body absorbs landing`);
      }
    }
    const launch=sampleCatClip(clip,.18),gather=sampleCatClip(clip,.44),reach=sampleCatClip(clip,.58),contact=sampleCatClip(clip,.70),compression=sampleCatClip(clip,.82);
    assert.ok(launch['L.front.paw'][13]>.23,'Front paws release before the hind paws');
    assert.ok(gather['L.rear.paw'][13]>.29&&gather['L.rear.paw'][14]>idle['L.rear.paw'][14]+.08,'The hind legs gather underneath the belly in flight');
    assert.ok(reach['L.front.paw'][13]<gather['L.front.paw'][13]-.07&&reach['L.front.paw'][14]>idle['L.front.paw'][14]+.10,'Forelimbs extend toward the approaching support');
    assert.ok(Math.abs(contact['L.front.paw'][13]-.10)<.004&&contact['L.rear.paw'][13]>.17,'Forefeet contact before the hind feet');
    assert.ok(compression.chest[13]<contact.chest[13]-.07,'Shoulders absorb the impact after contact');
    assert.ok(sampleCatClip(clip,.72).chest[13]<contact.chest[13]-.015,'The torso continues into compression immediately, without stopping before its landing dip');
    assert.ok(gather['L.front.paw'][13]>idle['L.front.paw'][13]+.25
      && gather['L.front.paw'][14]<idle['L.front.paw'][14]-.025,
      'Flight folds the forepaws up and back under the chest instead of keeping a standing silhouette');
    assert.ok(gather['L.rear.paw'][13]>idle['L.rear.paw'][13]+.30,
      'The hind paws visibly gather higher beneath the belly');
    for(const paw of ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw']) {
      const upDot=(a,b)=>a.slice(4,7).reduce((sum,v,i)=>sum+v*b[i+4],0);
      assert.ok(upDot(gather[paw],idle[paw])<.98,'Airborne wrists/hocks fold with their legs');
      for(const phase of [0,paw.includes('front')?jump.touchdown:jump.hindTouchdown,1])
        assert.ok(upDot(sampleCatClip(clip,phase)[paw],idle[paw])>.999,'Pads flatten before their support contact');
    }
    assert.ok(gather.tailTip[14]<idle.tailTip[14]-.30,'The tail trails behind the gathered flight pose');
    const firstImpact=sampleCatClip(clip,.76);
    const shoulderDrop=contact.chest[13]-firstImpact.chest[13],hipDrop=contact.pelvis[13]-firstImpact.pelvis[13];
    assert.ok(shoulderDrop>.10 && shoulderDrop>Math.max(0,hipDrop)*2.5,'The shoulders visibly absorb the initial load before the hips follow');
    const recovery=sampleCatClip(clip,jump.walkReady);
    for(const paw of ['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'])assert.ok(Math.abs(recovery[paw][13]-.10)<.004,`${skin}/${clip}: all four paws support the recovery-to-walk handoff`);
    assert.ok(Math.abs(gather['L.rear.paw'][12]-gather['R.rear.paw'][12])<
      Math.abs(idle['L.rear.paw'][12]-idle['R.rear.paw'][12])*.8,'Airborne hind paws gather laterally under the belly');
  }
  const loaded=sampleCatClip('jumpOn',.11),up=sampleCatClip('jumpOn',.20);
  assert.ok(loaded.pelvis[13]<idle.pelvis[13]-.18,'Upward takeoff loads the haunches');
  assert.ok(up.pelvis[13]>loaded.pelvis[13]+.18,'The hips extend before the hind paws leave their support');
  assert.ok(up.chest[13]>up.pelvis[13],'The shoulders lead the upward push');
  console.log(`Verified ${skin}: planted hind-leg push, forepaw release, gathered flight, reaching, successive contacts and shoulder compression.`);
}

// The planner's flight is already validated for collision. Timing changes may
// not alter that path, and a high target must not be met while still ascending.
for(const scale of [.3,.5,.7]) {
  const from=[0,w.FLOOR_Y,0],to=[scale*1.6,w.FLOOR_Y+scale*.8,scale*.2];
  const low=motion.catJumpDuration(from,to,.35*scale,scale),high=motion.catJumpDuration(from,to,1.2*scale,scale);
  assert.ok(high>low+.25,'Higher clearance arcs need longer flight time');
  assert.ok(low<.9,'An ordinary hop does not float for a fixed 900ms');
  assert.ok(Math.abs(low-motion.catJumpDuration([0,0,0],[1.6,.8,.2],.35,1))<1e-8,'Jump timing follows cat proportions, not viewport size');
  for(const decorationId of ['sofaA','chairRockingOak','chairOfficeA','chairGamingA']) {
    const options={width:390,height:420,petSize:80,sizeScale:scale/.5,homeOffset:{x:0,y:.4},decorations:[{decorationId,instanceId:'seat',offset:{x:0,y:0},scale:/^chair(Office|Gaming)/.test(decorationId)?2:1.5}],toys:[]};
    const room=w.buildNativeRoomWorld(options),seat=room.objects[0];
    if(!seat.seat)continue;
    const {buildRoomActivity}=load('@/utils/room-activities');
    const plan=buildRoomActivity({...options,nativeWorld:room},0,'sofaSit','seat');
    const approach=w.prepareNativeStep(plan,plan.steps[0],w.catScreenPoint(room.home,room),room,w.FLOOR_Y);
    // Very small/large cats still need a usable four-paw support; the full
    // furniture suite checks rejection as well as accessible arrangements.
    if(approach.native.blocked)continue;
    const start=approach.native.path.at(-1);
    const step=w.prepareNativeStep(plan,{...plan.steps[1],seatApproach:approach.seatApproach,seatPosition:approach.seatPosition},w.catScreenPoint(start,room),room,w.FLOOR_Y);
    assert.ok(!step.native.blocked);
    const a=step.native.path[0],b=step.native.path.at(-1),h=step.native.arcHeight;
    assert.ok(motion.catJumpPoint(a,b,.999,h,true)[1]>b[1],'The cat reaches the seat from above, rather than colliding while rising');
    assert.ok(Math.abs(step.durationMs-step.native.duration*1000)<1e-8,'Scheduler and native flight share their new clock');
  }
}
console.log('Verified arc-dependent timing, scale invariance, descending seat arrival and scheduler synchronization.');
