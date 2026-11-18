/** Run the actual sit, sleep and wake commands on the saved chair and sofa. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load,openSkin,resetCatActor,render,drawCat,actorState,readCushionPose,enableActorCrossfade} from './check-cat-turning.mjs';

const worldApi=load('@/utils/native-room-world'), activities=load('@/utils/room-activities');
const {advanceRockingChair,STILL_ROCKING_MOTION}=load('@/utils/native-rocking-chair');
const {CAT_JUMP_TAKEOFF}=load('@/utils/native-cat-locomotion');
const {createRoomActivitySegment}=load('@/pet-display/registry/cat-model-registry');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/rocking-chair-navigation.json',import.meta.url)));
const options={width:366,height:390,petSize:80,sizeScale:1.15,homeOffset:fixture.roomPetOffset,
  decorations:fixture.placedDecorations,toys:fixture.placedToys,ownedToyIds:[],nativeStepCompletion:true};
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const still=(pad,anchor)=>pad.every((p,k)=>distance(p,anchor[k])<.002);
enableActorCrossfade();

// The saved rocker faces its exit. At 320 degrees the same room planner
// chooses a landing that needs a pivot while the chair is rocking.
const cases = [
  { model:'chairRockingOak', poses:[0] },
  { model:'chairRockingOak', poses:[0], chairAngle:320 },
  { model:'sofaB', poses:[0,1,2] },
];
for (const {model,poses,chairAngle} of cases) for (const napTurn of poses) {
  const layout=chairAngle===undefined ? options : {...options, decorations:options.decorations.map(item=>
    item.decorationId==='chairRockingOak' ? {...item,rotationDegrees:chairAngle} : item)};
  const world=worldApi.buildNativeRoomWorld(layout), scale=world.catScale;
  const object=world.objects.find(o=>o.modelId===model), id=object.instanceId;
  const room={...layout,nativeWorld:world,napTurn};
  const command=kind=>activities.buildRoomActivity(room,0,kind,id);
  const visit=command('sofaSit');
  let pos=world.home;
  function prepare(plan,index) {
    const step=worldApi.prepareNativeStep(plan,plan.steps[index],worldApi.catScreenPoint(pos,world),world,pos[1]);
    assert.ok(!step.native.blocked);plan.steps[index]=step;pos=step.native.path.at(-1);return step;
  }
  function switchTo(kind,plan,stepIndex) {
    return activities.routeToSofa(room,command(kind),worldApi.catScreenPoint(pos,world),{plan,stepIndex},pos);
  }
  prepare(visit,0);prepare(visit,1);const seated=prepare(visit,2);
  const nap=switchTo('sofaSleep',visit,2), entry=prepare(nap,0), sleeping=prepare(nap,1);
  const rise=switchTo('sofaSit',nap,1), wake=prepare(rise,0), sit=prepare(rise,1);
  const leave=activities.buildRoomReturn(room,nap,1,sleeping.position), stand=prepare(leave,0), stretch=prepare(leave,1), drop=prepare(leave,2);
  assert.equal(entry.animation,'curlUp');assert.equal(wake.animation,'curlUp');assert.ok(wake.reverse);
  assert.equal(wake.native.duration,wake.durationMs/1000,'A stationary wake has an animation clock');
  const seat=seated.native.path[0];
  for (const step of [entry,sleeping,wake,sit,stand]) {
    assert.ok(!step.native.jump && step.native.path.length===1 && distance(step.native.path[0],seat)<1e-6);
    assert.equal(step.native.rockingChair?.instanceId,model==='chairRockingOak'?id:undefined);
  }

  for (const interruptStretch of napTurn===0 ? [false,true] : [false])
  for (const coat of ['orange','grey','white']) for (const fps of [30,60,120]) {
    openSkin(coat);resetCatActor();
    const rockingMotion={value:STILL_ROCKING_MOTION}, base={world,active:true,skinId:coat,rockingMotion};
    let complete=false,serial=0,previous;
    function start(step) {
      complete=false;
      render({...base,activityKey:String(++serial),travel:{...step.native,awaitCompletion:true},
        playback:{kind:'segment',mood:step.mood,segment:createRoomActivitySegment(step.animation,step.reverse,step.animationFps)},
        onRoomStepComplete:()=>{complete=true;}});
    }
    function tick(step,dt=1/fps) {
      rockingMotion.value=advanceRockingChair(rockingMotion.value,step.native.rockingChair,actorState().position,dt);
      drawCat(dt);
      const current=readCushionPose(object,rockingMotion.value,scale);
      if (previous) {
        assert.ok(distance(current.hips,previous.hips)<3/fps+.005,'No abrupt rise when clips change');
        current.feet.forEach((pad,j)=>assert.ok(distance(pad[0],previous.feet[j][0])<3/fps+.005,'No paw pop at a handoff'));
      }
      previous=current;return current;
    }
    start(seated);for(let i=0;i<fps;i++)tick(seated);
    const sitting=previous;
    start(entry);
    for(let i=0;i<fps*2.5 && !complete;i++) {
      const p=tick(entry), t=actorState().clipTime/actorState().clipDuration;
      // Once the forepaws tuck, the side sleeper rolls its pelvis over.
      if (t<.4) assert.ok(p.hips[1]<sitting.hips[1]+.04,'The cat starts curling from its seated haunches');
      assert.ok(p.head[1]<sitting.head[1]+.025,'The head stays low throughout the curl');
      p.feet.forEach((pad,j)=>{if(t<(j<2?.39:.21))assert.ok(still(pad,sitting.feet[j]),'Weight stays on the cushion until each paw lifts');});
    }
    assert.ok(complete);
    assert.ok(previous.head[1]<sitting.head[1]-.4,'The cat has lowered its head onto the cushion');
    start(sleeping);for(let i=0;i<fps*.6;i++)tick(sleeping);
    const curled=previous;
    start(wake);
    let frames=0;
    while(!complete && frames<fps*2.5) {
      const p=tick(wake);frames++;
      if (frames<fps*.48) p.feet.forEach((pad,j)=>assert.ok(still(pad,curled.feet[j]),'The head lifts before the paws unfold'));
    }
    assert.ok(complete && Math.abs(frames/fps-wake.native.duration)<=1.1/fps);
    const awake=previous;
    start(sit);
    for(let i=0;i<fps*.45;i++) {
      const p=tick(sit);
      assert.ok(Math.abs(p.hips[1]-awake.hips[1])<.025,'Stay seated after waking');
      p.feet.forEach((pad,j)=>assert.ok(still(pad,awake.feet[j]),'No extra step after the feet have opened'));
    }
    if (coat==='orange') {
      start(entry);for(let i=0;i<fps*1.10;i++)tick(entry);
      const interrupted=previous;
      start(wake);const reversed=tick(wake,0);
      reversed.feet.forEach((pad,j)=>assert.ok(still(pad,interrupted.feet[j]),'Interrupting a tuck preserves the displayed pads'));
      assert.ok(distance(reversed.hips,interrupted.hips)<.002);
      for(let i=0;i<fps*1.2 && !complete;i++)tick(wake);
      assert.ok(complete,'A mid-curl wake uses the remaining transition');
      start(sit);tick(sit);
    }
    start(entry);for(let i=0;i<fps*2.4 && !complete;i++)tick(entry);
    start(sleeping);for(let i=0;i<fps*.4;i++)tick(sleeping);
    start(stand);for(let i=0;i<fps*2.4 && !complete;i++)tick(stand);
    assert.ok(complete && previous.hips[1]>awake.hips[1]+.25,'The return-home wake rises onto four feet');
    const upright=previous, heading=actorState().heading;
    // A saved furniture heading can differ from the cat's actual waking pose.
    const bow={...stretch,native:{...stretch.native,heading:heading+.55}};
    start(bow);
    let lowChest=upright.chest[1];
    const bowSeconds=interruptStretch ? stretch.native.duration/2 : 3;
    for(let i=0;i<fps*bowSeconds && !complete;i++) {
      const p=tick(bow);
      lowChest=Math.min(lowChest,p.chest[1]);
      p.feet.forEach((pad,j)=>assert.ok(still(pad,upright.feet[j]),'Stretch keeps each pad on its cushion contact'));
    }
    assert.equal(complete,!interruptStretch);
    assert.ok(lowChest<upright.chest[1]-.12,'The chest reaches the deep stretch');
    const departurePose=previous;
    const surface=upright.feet[0][0][1], anchors=[...previous.feet], lifts=[0,0,0,0];
    let loadedHeight, turned=false;
    start(drop);
    for(let i=0;i<fps*3;i++) {
      // Airborne stride has its own velocity and contact checks.
      rockingMotion.value=advanceRockingChair(rockingMotion.value,drop.native.rockingChair,actorState().position,1/fps);
      drawCat(1/fps);
      const state=actorState(), p=readCushionPose(object,rockingMotion.value,scale);
      if(state.jumpPhase>CAT_JUMP_TAKEOFF) break;
      if(interruptStretch && i===0) {
        assert.ok(Math.abs(p.head[1]-departurePose.head[1])<.65/fps,'The interrupted bow begins without a head pop');
        p.feet.forEach((pad,j)=>assert.ok(still(pad,departurePose.feet[j]),'Takeoff starts on the visible contacts'));
      }
      if(interruptStretch && state.turnElapsed<state.turnDuration*.5) {
        assert.ok(p.chest[1]<departurePose.chest[1]+.09,'The chest stays low while the first pair of paws pivots');
      }
      if(state.turnDuration && state.turnElapsed<state.turnDuration) {
        turned=true;
        p.feet.forEach((pad,j)=>{
          if(pad[0][1]>surface+.001) {
            if(anchors[j]) lifts[j]++;
            anchors[j]=undefined;
          } else {
            anchors[j]??=pad;
            assert.ok(still(pad,anchors[j]),'A supporting paw stays planted during the turn');
          }
        });
        if(state.turnElapsed>state.turnDuration*.75) {
          if(loadedHeight!==undefined) assert.ok(p.hips[1]<loadedHeight+.009,'The last step flows down into the jump crouch');
          loadedHeight=p.hips[1];
        }
      } else {
        p.feet.slice(2).forEach((pad,j)=>assert.ok(still(pad,anchors[j+2]),'Hind feet hold through push-off'));
      }
    }
    assert.equal(turned, model==='sofaB' || chairAngle!==undefined,'Pivot only when the landing calls for it');
    assert.deepEqual(lifts,Array(4).fill(turned?1:0),'A quarter turn uses one placement per paw');
    assert.ok(actorState().jumpPhase>CAT_JUMP_TAKEOFF);
    if (coat==='orange') {
      resetCatActor();previous=undefined;
      start(seated);for(let i=0;i<fps;i++)tick(seated);
      start(entry);for(let i=0;i<fps*.8;i++)tick(entry);
      start(stand);for(let i=0;i<fps*1.1 && !complete;i++)tick(stand);
      assert.ok(complete);
      const beforeStretch=previous;
      start(stretch);const stretching=tick(stretch);
      stretching.feet.forEach((pad,j)=>assert.ok(still(pad,beforeStretch.feet[j]),'An interrupted nap starts the stretch with its feet planted'));
      for(let i=0;i<fps;i++)tick(stretch);
      assert.ok(previous.hips[1]>awake.hips[1]+.25);
    }
  }
  console.log(`Verified ${model} ${entry.sleepPose}${chairAngle===undefined?'':` at ${chairAngle} degrees`} on all three coats at 30/60/120 fps.`);
}
