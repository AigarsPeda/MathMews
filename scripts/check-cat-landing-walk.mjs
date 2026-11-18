/** Drive the shipped actor through floor approaches, cushion landings and walks home. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,readCushionPose,point,load,idle,walking,enableActorCrossfade} from './check-cat-turning.mjs';
const motion=load('@/utils/native-cat-locomotion'),w=load('@/utils/native-room-world');
const baseline=process.argv.includes('--baseline'),preview=baseline||process.argv.includes('--preview');
const poses=[],metrics=[],paws=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
enableActorCrossfade();
for(const skin of preview?['orange']:['orange','grey','white']) {
  openSkin(skin);
  for(const fps of preview?[60]:[30,60,120])for(const scale of preview?[.5]:[.35,.5])for(const degrees of preview?[0]:[0,60,150])for(const delay of !preview&&skin==='orange'&&fps===60&&scale===.5&&degrees===0?[0,4,12]:[0]) {
    resetCatActor();
    const world=w.buildNativeRoomWorld({width:390,height:420,petSize:80,sizeScale:1,decorations:[{decorationId:'sofaA',instanceId:'sofa',offset:{x:0,y:0},scale:1.3}],toys:[]});
    const sofa=world.objects[0],from=sofa.seat,landing=sofa.approach;world.catScale=scale;world.radius=.3*scale;world.home=from;
    const heading=Math.atan2(landing[0]-from[0],landing[2]-from[2]);
    const seated=degrees===0;
    const departure=seated?{kind:'segment',segment:{assetKey:'sit',loop:true}}:idle;
    render({active:true,world,playback:departure,travel:{path:[from],duration:0,distance:0,jump:false,heading}});drawCat(0);
    const takeoffFeet=paws.map(point);
    const target=[landing[0]+Math.sin(heading+degrees*Math.PI/180)*.8,landing[1],landing[2]+Math.cos(heading+degrees*Math.PI/180)*.8];
    const path=motion.catPacedPath([landing,target],scale),timing=motion.catWalkTiming(path,scale);
    let arrived=false,started=false,complete=0,firstMove,previous,slip=0,step=0,launchFrames=0,launchStep=0,bodyDip=0,arrivalFrame=0,frameCounter=0;
    let props={active:true,world,playback:{kind:'segment',segment:{assetKey:'jumpOff',loop:false}},activityKey:'landing',travel:{path:[from,landing],duration:.9,distance:distance(from,landing),jump:true,walkAfterLanding:true,awaitCompletion:true},onRoomStepComplete:()=>{arrived=true;arrivalFrame=frameCounter;}};
    render(props);
    for(let frame=0;frame<fps*5;frame++) {
      frameCounter=frame;
      if(arrived&&!started&&frame>=arrivalFrame+delay) {
        started=true;
        props={active:true,world,playback:walking,activityKey:'next-task',travel:{path,...timing,distance:.8,jump:false,awaitCompletion:true},onRoomStepComplete:()=>complete++};render(props);
      }
      drawCat(1/fps);const state=actorState(),feet=paws.map(point);
      if(!baseline && !started && seated && state.jumpPhase<=motion.CAT_JUMP_TAKEOFF) {
        for(const i of [2,3]) assert.ok(distance(feet[i],takeoffFeet[i])/scale<.003,'Tucked hind pads push from their seat contacts');
      }
      if(started&&firstMove===undefined&&distance(state.position,landing)>.00001)firstMove=frame/fps;
      if(started&&state.launchStarted&&(state.distance-state.launchDistance)/(state.launchStride*scale)<.9) {
        launchFrames++;
        if(previous)for(let p=0;p<4;p++) {
          launchStep=Math.max(launchStep,distance(feet[p],previous[p])/scale);
          if(!baseline && Math.max(feet[p][1],previous[p][1])<landing[1]+.109*scale) {
            const drift=Math.hypot(feet[p][0]-previous[p][0],feet[p][2]-previous[p][2])/scale;
            assert.ok(drift<1.8/fps+.003,`${skin}/${fps}/${degrees}: first stride slides ${drift} while low`);
          }
        }
        if(state.launchFromLanding)bodyDip=Math.min(bodyDip,(point('spine')[1]-state.position[1])/scale-state.launchHeight);
        const phase=(state.distance-state.launchDistance)/(state.launchStride*scale);
        const {catLaunchStep}=load('@/utils/native-cat-walk-launch');
        for(let p=0;p<4;p++)if(catLaunchStep(state.launchPhase,phase,p).progress===0)slip=Math.max(slip,distance(feet[p],state.launchFeet[p])/scale);
      }
      if(previous)for(let p=0;p<4;p++)step=Math.max(step,distance(feet[p],previous[p])/scale);
      previous=feet;
      if(preview&&frame%3===0&&frame<fps*2.5)poses.push({action:'landingWalk',time:frame/fps,nodes:actorBones(),position:[...state.position],scale,sofa:{modelId:sofa.modelId,position:sofa.position,heading:sofa.heading,scale:sofa.scale}});
      if(started&&frame===fps*1.4) {
        const frozen=actorBones();render({...props,active:false});drawCat(.5);
        for(const[name,m]of Object.entries(frozen))assert.ok(distance(actorBones()[name],m)<1e-6,'Pause retains the complete handoff pose');
        render(props);drawCat(0);
      }
    }
    if(!baseline) {
      assert.ok(launchFrames>3,'A landing joins a planted first stride');
      if(degrees===0)assert.ok(firstMove<.82+delay/fps,`Queued walking begins during recovery, at ${firstMove}s`);
      assert.ok(launchStep<8/fps+.01,`First-stride touchdown cannot snap: ${skin}/${fps}/${scale}/${degrees}/${delay}: ${launchStep}`);
      assert.ok(bodyDip>-.015,`Landing recovery cannot add another crouch: ${bodyDip}`);
      assert.ok(slip<.004,`${skin}/${fps}/${scale}/${degrees}/${delay}: paws stay planted until lift-off: ${slip}`);
      assert.ok(step<18/fps+.01,`No paw teleport at ${fps} FPS: ${step}`);
      assert.equal(complete,1,'The next task arrives once');
      assert.ok(distance(actorState().position,target)<1e-6,'Exact next-task destination');
    }
    metrics.push({skin,fps,scale,degrees,delay,firstMove,launchFrames,launchStep,bodyDip,slip,step});
  }
  console.log(`Verified ${skin}: landing-to-walk contacts, direction changes, first strides, pause and arrival.`);
}
if(!baseline)for(const fps of [30,60,120]) {
  openSkin('orange');resetCatActor();
  const floor=w.FLOOR_Y,world={width:390,height:420,catScale:.45,radius:.30,home:[-1.4,floor,0],objects:[{instanceId:'books',modelId:'booksPile',scale:1,heading:0,position:[0,floor,0],solid:true,movable:false,min:[-.12,floor,-2.5],max:[.12,floor+.20,2.5]}]};
  const target=[1.4,floor,0],step={animation:'walk',mood:'idle',durationMs:1000,position:w.catScreenPoint(target,world)};
  const travel=w.prepareNativeStep({kind:'wander',steps:[step]},step,w.catScreenPoint(world.home,world),world,floor).native;
  assert.ok(travel.legs.some(leg=>leg.landingWalk),'The actual route planner schedules a recovery-to-walk overlap');
  let clock=0;
  for(const leg of travel.legs){if(leg.landingWalk)assert.ok(Math.abs(motion.catMotionSample(travel.legs,clock+leg.duration-1e-6).progress-motion.CAT_LANDING_WALK_PHASE)<.0001,'Overlap retains the original airborne clock');clock+=leg.duration;}
  render({active:true,world,playback:idle,travel:{path:[world.home],duration:0,distance:0,jump:false,heading:Math.PI/2}});drawCat(0);
  let complete=0,launched=false;
  render({active:true,world,playback:walking,activityKey:'linked-hop',travel:{...travel,awaitCompletion:true},onRoomStepComplete:()=>complete++});
  for(let i=0;i<(travel.duration+2)*fps;i++){drawCat(1/fps);launched ||= actorState().launchFromLanding;}
  assert.ok(launched,'A hop inside a continuous route uses its actual landing contacts');
  assert.equal(complete,1);assert.ok(distance(actorState().position,target)<1e-6);
}
function trackCushionTurn(initial, surface, object, scale) {
  const held = [...initial.feet], raised = paws.map(()=>false), lifts = paws.map(()=>0);
  const bounds = object.modelId==='chairRockingOak' ? [-.306,.306,-.271,.341] : [-.301,.481,-.946,.946];
  return { lifts, sample(pose) {
    for (const [i,marks] of pose.feet.entries()) {
      const y = marks[0][1], high = y>surface+.025;
      if (high && !raised[i]) lifts[i]++;
      raised[i] = high;
      if (y>surface+.0001) { held[i]=undefined; continue; }
      for (const p of marks) {
        const x=p[0]*scale/object.scale, z=p[2]*scale/object.scale;
        assert.ok(bounds[0]<=x && x<=bounds[1] && bounds[2]<=z && z<=bounds[3],'The planted pad fits the cushion');
      }
      held[i] ??= marks;
      marks.forEach((p,k)=>assert.ok(distance(p,held[i][k])<.002,'Planted pad and sole stay fixed relative to the cushion'));
    }
  } };
}

if (!preview) {
  const { buildRoomActivity, buildRoomReturn } = load('@/utils/room-activities');
  const { advanceRockingChair, STILL_ROCKING_MOTION } = load('@/utils/native-rocking-chair');
  const { localPawPoint } = load('@/utils/native-cat-paw-placement');
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/rocking-chair-navigation.json', import.meta.url)));
  const options = { width:366, height:390, petSize:80, sizeScale:1.15, homeOffset:fixture.roomPetOffset,
    decorations:fixture.placedDecorations, toys:fixture.placedToys, ownedToyIds:[], nativeStepCompletion:true };
  const world = w.buildNativeRoomWorld(options), scale = world.catScale;
  const room = { ...options, nativeWorld:world };
  for (const model of ['chairRockingOak','sofaB']) {
    const object = world.objects.find(object => object.modelId === model), id = object.instanceId;
    const visit = buildRoomActivity(room,0,'sofaSit',id);
    let position = world.home;
    for (let index = 0; index <= 2; index++) {
      const step = w.prepareNativeStep(visit,visit.steps[index],w.catScreenPoint(position,world),world,position[1]);
      assert.ok(!step.native.blocked);
      visit.steps[index] = step;
      position = step.native.path.at(-1);
    }
    const seat = visit.steps[2], exit = buildRoomReturn(room,visit,2,seat.position);
    const jump = w.prepareNativeStep(exit,exit.steps[0],seat.position,world,position[1]);
    const landing = jump.native.path.at(-1);
    const walk = w.prepareNativeStep(exit,exit.steps[1],jump.position,world,landing[1]);
    const aimed = w.planLandingWalk(jump.native,walk.native,world,id);
    assert.ok(Number.isFinite(aimed.landingHeading), 'The jump anticipates the floor route');
    // A head-height obstruction at the turned landing must preserve the original flight.
    const head = [landing[0]+Math.sin(aimed.landingHeading)*.70*scale, landing[1]+scale,
      landing[2]+Math.cos(aimed.landingHeading)*.70*scale];
    const blocker = { modelId:'test-box',instanceId:'landing-blocker',solid:true,position:head,heading:0,scale:1,
      min:head.map(x=>x-.02*scale),max:head.map(x=>x+.02*scale) };
    const fallback = w.planLandingWalk(jump.native,walk.native,{ ...world, objects:[...world.objects,blocker] },id);
    assert.equal(fallback.landingHeading,undefined);
    assert.equal(fallback.arcHeight,jump.native.arcHeight);
    for (const skin of ['orange','grey','white']) for (const fps of [30,60,120]) {
      openSkin(skin);
      resetCatActor();
      const rockingMotion = {value:STILL_ROCKING_MOTION};
      const actor = {active:true,world,rockingMotion};
      function tick(travel) {
        rockingMotion.value = advanceRockingChair(rockingMotion.value,travel.rockingChair,actorState().position,1/fps);
        drawCat(1/fps);
      }
      const pose = () => readCushionPose(object,rockingMotion.value,scale);
      const surface = (position[1]-object.position[1])/scale+.10;
      render({...actor,playback:idle}); drawCat(0);
      for (const [index,step] of visit.steps.slice(0,3).entries()) {
        const playback = index === 0 ? walking : {kind:'segment',segment:{assetKey:step.animation,loop:index===2}};
        let arrived = false, forefeet, settled, push;
        const contacts = [];
        const pivot = index===2 ? trackCushionTurn(pose(),surface,object,scale) : undefined;
        render({...actor,playback,activityKey:`approach-${index}`,travel:{...step.native,awaitCompletion:true},onRoomStepComplete:()=>{arrived=true;}});
        for (let i=0;i<(index===2 ? 2.3 : 8)*fps && !arrived;i++) {
          tick(step.native);
          const state = actorState();
          if (index===1) {
            assert.ok(state.turnDuration===0 || Math.abs(state.turnAngle)<=Math.PI/3,'At most one pivot step per paw before takeoff');
            if (state.jumpPhase>0 && state.jumpPhase<=motion.CAT_JUMP_TAKEOFF) {
              const hind = paws.slice(2).map(point);
              push ??= hind;
              for (const [j,p] of hind.entries()) {
                assert.ok(Math.abs(p[1]-state.supportLift-w.FLOOR_Y-.10*scale)<.012*scale,'Both hind pads push from the rug');
                assert.ok(distance(p,push[j])<.003*scale,'A loaded hind paw stays in place until takeoff');
              }
            }
            if (state.jumpPhase>=motion.CAT_JUMP_TOUCHDOWN) {
              const root = actorBones()['Game cat rig'];
              for (const [j,paw] of paws.entries()) {
                if (j>=2 && state.jumpPhase<motion.CAT_JUMP_HIND_TOUCHDOWN) continue;
                const local = localPawPoint(root,point(paw));
                contacts[j] ??= local;
                assert.ok(distance(local,contacts[j])<.002,'Each pad stays at touchdown as the body compresses');
              }
            }
          } else if (pivot && state.turnElapsed<state.turnDuration) {
            pivot.sample(pose());
          } else if (index===2 && state.stopFeet.length) {
            const root = actorBones()['Game cat rig'], local = paws.map(paw=>localPawPoint(root,point(paw)));
            forefeet ??= local.slice(0,2);
            for (let j=0;j<2;j++) assert.ok(distance(forefeet[j],local[j])<.003,'Forepaws support the cat while it sits');
            if (state.stopTime>.4) {
              settled ??= local;
              for (let j=0;j<4;j++) assert.ok(distance(settled[j],local[j])<.002,'Seated paws follow the cushion');
            }
          }
        }
        if (index<2) assert.ok(arrived);
        if (index===0) {
          const held = paws.map(point);
          for (let j=0;j<4;j++) tick(step.native);
          assert.ok(paws.every((paw,j)=>distance(point(paw),held[j])<1e-6),'Dispatch delay adds no foot adjustment');
        }
        if (index===1) assert.ok(push && contacts.length===4);
        if (pivot) {
          assert.ok(settled);
          assert.deepEqual(pivot.lifts,paws.map(()=>model==='chairRockingOak' ? 2 : 1),'Purposeful steps into the sitting pose');
        }
      }
      const facing = actorState().heading;
      const slightTurn = {...seat.native,heading:facing+.12};
      render({...actor,playback:{kind:'segment',segment:{assetKey:'sit',loop:true}},activityKey:'adjust-seat',travel:slightTurn});
      for (let i=0;i<fps/5;i++) {
        tick(slightTurn);
        assert.equal(actorState().heading,facing,'A small change in resting direction needs no shuffle');
      }
      const seated = pose();
      const departure = trackCushionTurn(seated,surface,object,scale);
      let hindSupport = seated.feet.slice(2), landed = false, completed = 0;
      render({ ...actor,playback:{kind:'segment',segment:{assetKey:'jumpOff'}},activityKey:'drop',
        travel:{...aimed,walkAfterLanding:true,awaitCompletion:true},onRoomStepComplete:()=>{landed=true;} });
      const contacts = [];
      for (let i=0;i<3*fps && !landed;i++) {
        tick(aimed);
        const state = actorState();
        if (state.jumpPhase<=motion.CAT_JUMP_TAKEOFF) {
          const current = pose();
          if (i===0) {
            assert.ok(distance(current.chest,seated.chest)<1.2/fps,'The seated chest rises continuously');
            assert.ok(Math.abs(Math.sin(state.heading-facing))<1/fps,'A small exit angle eases into the push');
          }
          if (state.turnElapsed<state.turnDuration) {
            departure.sample(current);
            hindSupport=current.feet.slice(2);
          } else {
            current.feet.slice(2).forEach((marks,j)=>marks.forEach((p,k)=>
              assert.ok(distance(p,hindSupport[j][k])<.002,'Hind pads keep their final cushion contacts through push-off')));
          }
        }
        for (const [j,paw] of paws.entries()) {
          if (actorState().jumpPhase < (j<2 ? motion.CAT_JUMP_TOUCHDOWN : motion.CAT_JUMP_HIND_TOUCHDOWN)) continue;
          contacts[j] ??= point(paw);
          assert.ok(distance(contacts[j],point(paw)) < .002*scale, 'A loaded pad stays on its rug contact');
        }
      }
      assert.deepEqual(departure.lifts,paws.map(()=>model==='chairRockingOak' ? 0 : 1),'The aligned exit needs no extra step');
      assert.ok(landed && contacts.length === 4);
      render({ active:true,world,playback:walking,activityKey:'depart',
        travel:{...walk.native,awaitCompletion:true},onRoomStepComplete:()=>completed++ });
      let previous = contacts, heldFrames = 0;
      for (let i=0;i<5*fps && !completed;i++) {
        drawCat(1/fps);
        const state = actorState(), feet = paws.map(point);
        assert.equal(state.turnDuration,0,'Both descents continue into the first walking stride');
        if (i === Math.ceil(.15*fps)) assert.ok(distance(state.position,landing)>.02*scale,'The walk has started');
        if (state.launchFromLanding && (state.distance-state.launchDistance)/(state.launchStride*scale)<.9) {
          for (let j=0;j<feet.length;j++) {
            if (Math.max(feet[j][1],previous[j][1]) > contacts[j][1]+.001*scale) continue;
            heldFrames++;
            assert.ok(distance(feet[j],previous[j])<.012*scale,`${model}/${skin}/${fps}: planted paw ${j} slid`);
          }
        }
        previous = feet;
      }
      assert.ok(heldFrames>fps*.10);
      assert.equal(completed,1);
      assert.ok(distance(actorState().position,world.home)<1e-6);
    }
    console.log(`Verified ${model}: planted takeoff, cushion landing and sit, floor touchdown, first stride and walk home.`);
  }
}
if(preview)fs.writeFileSync(`/tmp/brainpet-landing-walk-${baseline?'before':'after'}.json`,JSON.stringify(poses));
fs.writeFileSync(`/tmp/brainpet-landing-walk-metrics-${baseline?'before':'after'}.json`,JSON.stringify(metrics,null,2));
