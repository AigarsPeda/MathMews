/* eslint-disable react-hooks/rules-of-hooks -- Deterministic integration dispatcher, without native UI handles. */
/** Exercise Home routing, PetStage command delivery, four retained schedulers and real navigation together. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const homeSource=ts.createSourceFile('app/index.tsx',fs.readFileSync('app/index.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const stageSource=ts.createSourceFile('PetStage.tsx',fs.readFileSync('components/pet/PetStage.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function find(source,predicate){let result;function visit(node){if(predicate(node))result=node;ts.forEachChild(node,visit);}visit(source);assert.ok(result,'Find source callback');return result;}
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function homeCallback(name,context){const node=find(homeSource,n=>ts.isVariableDeclaration(n)&&n.name.getText(homeSource)===name);return vm.runInNewContext(compile(`(${node.initializer.arguments[0].getText(homeSource)})`),context);}
const propertyScripts=new Map();
function stageProperty(name,context){if(!propertyScripts.has(name)){const node=find(homeSource,n=>ts.isJsxAttribute(n)&&n.name.text===name&&n.initializer&&ts.isJsxExpression(n.initializer));propertyScripts.set(name,new vm.Script(compile(`(${node.initializer.expression.getText(homeSource)})`)));}return propertyScripts.get(name).runInNewContext(context);}
const delivery=find(stageSource,n=>ts.isCallExpression(n)&&n.expression.getText(stageSource)==='useEffect'&&n.arguments[0]?.getText(stageSource).includes('handledRoomCommand.current === roomCommand.id')).arguments[0].getText(stageSource);
const deliverCommand=new vm.Script(compile(`(${delivery})()`));

function harness({reduced=false,native=true,cold=false,targets={},doors=false}={}){
  let now=1_800_000_000_000, timerId=0, dirty=true, owner, effects=[], active=true, interaction=now;
  const timers=new Map(), cache=new Map(), rooms=new Map(), arrivals=[], completions=[], feeds=[], failures=[];
  const clock={now:()=>now};
  function slot(initial){const instance=owner,index=instance.cursor++;if(!(index in instance.slots))instance.slots[index]=initial();return [instance,index,instance.slots[index]];}
  const same=(a,b)=>a&&a.length===b.length&&b.every((v,i)=>Object.is(v,a[i]));
  const react={
    useRef:value=>slot(()=>({current:value}))[2],
    useState:initial=>{const [instance,index,value]=slot(()=>typeof initial==='function'?initial():initial);return [value,next=>{const result=typeof next==='function'?next(instance.slots[index]):next;if(!Object.is(result,instance.slots[index])){instance.slots[index]=result;dirty=true;}}];},
    useMemo:(fn,deps)=>{const [instance,index,old]=slot(()=>null);if(!old||!same(old.deps,deps))instance.slots[index]={deps,value:fn()};return instance.slots[index].value;},
    useCallback:(fn,deps)=>react.useMemo(()=>fn,deps),
    useEffect:(fn,deps)=>{const [instance,index,old]=slot(()=>null);if(!old||!same(old.deps,deps))effects.push(()=>{old?.cleanup?.();instance.slots[index]={deps,cleanup:fn()};});},
  };
  const shared=initial=>{let value=initial;return {get:()=>value,set:next=>{value=next;}};};
  const mocks={react,'@/hooks/use-animation-activity':{useAnimationActivity:()=>({active,reduceMotion:reduced})},
    'react-native-reanimated':{useSharedValue:value=>react.useRef(shared(value)).current,cancelAnimation(){},withTiming:value=>value,withDelay:(_,value)=>value,withSequence:(...values)=>values.at(-1),
      Easing:{linear:x=>x,quad:x=>x*x,inOut:fn=>fn,in:fn=>fn,out:fn=>fn}},
  };
  function load(id){
    if(id in mocks)return mocks[id];if(/\.(png|webp|glb|mp4)$/.test(id))return id;
    const file=path.resolve(id.startsWith('@/')?id.slice(2):id),resolved=fs.existsSync(file)?file:['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
    assert.ok(resolved,id);if(cache.has(resolved))return cache.get(resolved).exports;
    const module={exports:{}};cache.set(resolved,module);
    if(resolved.endsWith('.json'))module.exports=JSON.parse(fs.readFileSync(resolved,'utf8'));
    else vm.runInNewContext(compile(fs.readFileSync(resolved,'utf8')),{module,exports:module.exports,require:load,Date:clock,Math,Set,Map,
      setTimeout:(fn,delay=0)=>{const id=++timerId;timers.set(id,{at:now+delay,fn});return id;},clearTimeout:id=>timers.delete(id)});
    return module.exports;
  }
  const worldApi=load('@/utils/native-room-world'),motion=load('@/utils/native-cat-locomotion');
  const {useRoomActivity}=load('@/hooks/use-room-activity'),{useRoomTransition}=load('@/hooks/use-room-transition');
  const {previewHomeRoom,getCatHomeRoomId,sendCatToRoom,switchHomeRoom}=load('@/utils/home-rooms');
  const {roomActivityStepKey}=load('@/utils/room-activities');
  const {HOME_ROOM_IDS,roomTravelDirection}=load('@/constants/home-rooms');
  const fixtures={bedroom:['bedroomDoubleBed','bedSnuggle'],livingRoom:['sofaA','sofaSit'],kitchen:['bowlBlue','bowlEat'],bathroom:['bathroomBathAni','bathWash'],...targets};
  const saved=Object.fromEntries(HOME_ROOM_IDS.map(id=>[id,{roomId:'room1',placedDecorations:[{decorationId:fixtures[id][0],instanceId:id+'-target',offset:{x:0,y:-.25},
    ...(/Hide$/.test(fixtures[id][1])?{opened:true}:{}),...fixtures[id][2]}],placedToys:[],roomPetOffset:{x:.5,y:.6}}]));
  if(doors)saved.livingRoom.placedDecorations.push({decorationId:'japaneseDoorAni',instanceId:'passage',doorDestination:'kitchen',offset:{x:-.6,y:-.3}});
  const env={pet:{type:'cat',homeRoomId:'livingRoom',catHomeRoomId:'livingRoom',homeRooms:saved,...saved.livingRoom},
    transition:null,requestedRoomCommand:null,catEntry:null,entrySequence:{current:0},roomCommandSequence:{current:0},
    isCareBlocked:false,isCareAnimationPlaying:false,getCatHomeRoomId,roomTravelDirection,
    setRoomFailure:value=>{env.roomFailure=value;dirty=true;},
    setRequestedRoomCommand:update=>{env.requestedRoomCommand=typeof update==='function'?update(env.requestedRoomCommand):update;dirty=true;},
    setCatEntry:value=>{env.catEntry=value;dirty=true;},
    sendCatToRoom:(destination,follow)=>{arrivals.push({from:getCatHomeRoomId(env.pet),destination,at:now});env.pet=sendCatToRoom(env.pet,destination,follow);dirty=true;},
    slideToRoom:(destination,waitForCat)=>transitionApi.visit(destination,waitForCat),
  };
  env.handleVisitRoom=homeCallback('handleVisitRoom',env);
  env.handleCatRoomArrival=homeCallback('handleCatRoomArrival',env);
  env.handleRoomCommand=homeCallback('handleRoomCommand',env);
  env.handleRoomCommandAccepted=homeCallback('handleRoomCommandAccepted',env);
  const transitionOwner={slots:[],cursor:0};let transitionApi;
  const visit=destination=>{env.pet=switchHomeRoom(env.pet,destination);dirty=true;};
  for(const id of HOME_ROOM_IDS){
    const base={width:390,height:420,petSize:80,sizeScale:1.15,homeRoomId:id,homeOffset:saved[id].roomPetOffset,decorations:saved[id].placedDecorations,
      toys:[],ownedToyIds:[],hungry:false,asleep:false,period:'morning',nativeStepCompletion:native};
    base.nativeWorld=worldApi.buildNativeRoomWorld(base);
    const point=worldApi.catScreenPoint(base.nativeWorld.home,base.nativeWorld);
    rooms.set(id,{id,slots:[],cursor:0,base,options:base,x:shared(point.x),y:shared(point.y),handled:{current:0},api:null,props:null});
  }
  function render(){
    owner=transitionOwner;owner.cursor=0;effects=[];transitionApi=useRoomTransition(env.pet,visit);env.transition=transitionApi.transition;
    const pending=[];
    for(const room of rooms.values()){
      const roomPet=previewHomeRoom(env.pet,room.id),visible=env.pet.homeRoomId===room.id;
      const context={...env,roomPet,visible,transition:env.transition};
      const props=Object.fromEntries(['roomEntry','roomVisible','catHomeRoomId','roomCommand','onRoomCommandAccepted','onSendCatToRoom'].map(name=>[name,stageProperty(name,context)]));
      const entry=props.roomEntry;
      if(room.options.entry!==entry)room.options={...room.base,entry};
      room.props=props;owner=room;room.cursor=0;
      room.api=useRoomActivity(room.options,props.catHomeRoomId===room.id,interaction,room.x,room.y,(id,motion)=>{const door=room.options.decorations.find(item=>item.instanceId===id);if(door?.doorDestination)env.handleCatRoomArrival(door.doorDestination,undefined,motion);},
        ()=>feeds.push(room.id),props.onSendCatToRoom,props.roomVisible,false,undefined,(kind,id)=>completions.push({room:room.id,kind,id}),failure=>failures.push({room:room.id,...failure}));
      pending.push(()=>deliverCommand.runInNewContext({
        roomCommand:props.roomCommand,handledRoomCommand:room.handled,compact:true,usesNativeCat:true,catPresent:props.catHomeRoomId===room.id,
        decorating:false,roomActivityBlocked:false,graphicsMode:'native',viewport:{width:390,height:420},displayWidth:80,
        startActivity:room.api.startActivity,onRoomCommandAccepted:props.onRoomCommandAccepted,
      }));
    }
    const committed=effects;effects=[];committed.forEach(fn=>fn());pending.forEach(fn=>fn());
    // Warm native scenes paint once their incoming route exists. Cold fixtures
    // retain explicit readiness control for delayed-load and interruption tests.
    if(!cold && env.transition){
      const destination=rooms.get(env.transition.destination),state=destination.api.activity;
      if(state?.plan.steps[state.stepIndex].enteringRoom)transitionApi.ready(destination.id);
    }
  }
  function flush(){
    let count=0;
    while(dirty||[...timers.values()].some(t=>t.at<=now)){
      assert.ok(count++<100,'Room/command handoffs must settle without a render loop');
      if(dirty){dirty=false;render();}
      for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}
    }
  }
  function advance(ms){const until=now+ms;for(let count=0;;count++){
    assert.ok(count<500,'Activity timers cannot spin indefinitely');const timer=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
    if(!timer||timer[1].at>until)break;now=timer[1].at;timers.delete(timer[0]);timer[1].fn();flush();
  }now=until;flush();}
  const current=()=>rooms.get(getCatHomeRoomId(env.pet));
  function request(roomId,kind=fixtures[roomId][1],instanceId=roomId+'-target'){
    interaction=++now;env.handleRoomCommand(roomId,kind,instanceId,interaction);flush();
  }
  function finishStep(){
    const room=current(),state=room.api.activity;assert.ok(state,'A requested task must have an active scheduler');
    const step=state.plan.steps[state.stepIndex];assert.ok(!step.hold,'A held task needs a new command');
    assert.ok(!step.native?.blocked,`${room.id}/${state.plan.kind}/${step.animation} must be reachable`);
    const key=roomActivityStepKey(state),end=step.native.path.at(-1);
    const transit=step.native.through?{speed:1.8,phase:1.375,gait:'walk',tailYaw:[.03,.01,-.02,-.03],tailPitch:[0,0,0,0]}:undefined;
    assert.ok(end.every(Number.isFinite));
    if(step.native.awaitCompletion){room.api.updateNativeHeight(end,step.native.duration);room.api.completeNativeStep(key,end,transit);flush();
      // Delayed drawing callbacks from the previous step cannot advance a new task.
      room.api.completeNativeStep(key,end,transit);flush();
    }else advance(Math.max(1,state.startedAt+(reduced?600:step.durationMs)-now+1));
  }
  function until(predicate,limit=40){for(let i=0;i<limit;i++){flush();if(predicate())return;finishStep();}assert.fail('Task chain did not reach its requested state');}
  function atTask(roomId,kind=fixtures[roomId][1]){const room=current(),state=room.api.activity;return room.id===roomId&&state?.plan.kind===kind&&!state.plan.steps[state.stepIndex].enteringRoom;}
  function atInteraction(roomId){if(!atTask(roomId))return false;const state=current().api.activity,step=state.plan.steps[state.stepIndex];
    if(/Hide$/.test(fixtures[roomId][1]))return step.hold;
    return roomId==='bedroom'?step.bedPhase==='covered':roomId==='livingRoom'?step.hold:roomId==='kitchen'?step.mood==='eating':step.bathroomPhase==='wash';}
  function partial(fraction=.45){const room=current(),state=room.api.activity,step=state.plan.steps[state.stepIndex],travel=step.native;
    const elapsed=travel.duration*fraction,point=travel.legs?.length?motion.catMotionSample(travel.legs,elapsed).position:
      travel.jump?motion.catJumpPoint(travel.path[0],travel.path.at(-1),Math.max(0,Math.min(1,(fraction-.2)/.5)),.35*room.options.nativeWorld.catScale):motion.catPathPoint(travel.path,motion.catTravelProgress(elapsed,travel.duration),travel.paces);
    const screen=worldApi.catScreenPoint(point,room.options.nativeWorld);room.x.set(screen.x);room.y.set(screen.y);room.api.updateNativeHeight(point,elapsed);return point;
  }
  flush();if(!cold){for(const id of HOME_ROOM_IDS)transitionApi.ready(id);flush();}
  for(const room of rooms.values())room.api.updateNativeHeight(room.options.nativeWorld.home,0);
  return {env,rooms,arrivals,completions,feeds,failures,current,request,finishStep,until,atTask,atInteraction,partial,flush,advance,stepKey:roomActivityStepKey,
    ready(id){transitionApi.ready(id??env.transition?.destination??env.pet.homeRoomId);flush();},
    browse(id){env.handleVisitRoom(id);flush();},
    setActive(value){active=value;dirty=true;flush();},
    state(){const state=current().api.activity;return state&&{...state,step:state.plan.steps[state.stepIndex]};},
    assertSingleCat(){assert.equal([...rooms.values()].filter(room=>room.props.catHomeRoomId===room.id).length,1);},
    furnishings:()=>JSON.stringify(Object.fromEntries(HOME_ROOM_IDS.map(id=>[id,previewHomeRoom(env.pet,id).placedDecorations]))),
  };
}

// A room action must survive a complete departure, arrival, entry and immediate next task.
for(const reduced of [false,true])for(const native of [true,false]){
  const h=harness({reduced,native}),before=h.furnishings();
  for(const destination of ['bedroom','kitchen','bathroom','bedroom','livingRoom','kitchen','bedroom','bathroom','kitchen','livingRoom','bathroom','livingRoom']){
    h.request(destination);
    try{h.until(()=>h.atInteraction(destination));}catch(error){console.error({native,reduced,destination,cat:h.env.pet.catHomeRoomId,queued:h.env.requestedRoomCommand,state:h.state(),arrivals:h.arrivals,completions:h.completions});throw error;}
    assert.equal(h.state().plan.targetInstanceId,destination+'-target');
    assert.ok(!h.state().plan.steps.some(step=>step.native?.blocked));h.assertSingleCat();
  }
  assert.equal(h.furnishings(),before,'Task chains cannot move, remove or duplicate room furniture');
  assert.equal(new Set(h.arrivals.map(a=>`${a.from}->${a.destination}`)).size,12,'Exercise every directed journey between the four rooms');
}
console.log('Verified four-room action chains, exact targets, one cat, unchanged furnishings, native/timer completion and Reduce Motion.');

for(const reduced of [false,true]){
  const h=harness({reduced});
  h.request('bathroom');h.partial();h.request('bedroom');h.request('kitchen');
  h.until(()=>h.atInteraction('kitchen'));
  assert.deepEqual(h.arrivals.map(a=>a.destination),['kitchen'],'The newest destination replaces earlier requests during a floor walk');
  assert.equal(h.feeds.length,0,'Walking to a bowl cannot award feeding');
  h.until(()=>h.current().api.activity===null);
  assert.deepEqual(h.feeds,['kitchen'],'Completing the rendered meal awards feeding once');
  assert.equal(h.completions.filter(c=>c.kind==='bowlEat').length,1);
}
console.log('Verified rapid departure retargeting, cancelled destinations, actual meal completion and no duplicate rewards.');

{
  const h=harness();h.request('livingRoom');
  h.until(()=>h.state()?.step.animation==='jumpOn');h.partial();
  h.request('bathroom');h.request('bedroom');
  assert.equal(h.state().step.animation,'jumpOn','An airborne cat finishes its jump before changing rooms');
  h.until(()=>h.atInteraction('bedroom'));
  assert.deepEqual(h.arrivals.map(a=>a.destination),['bedroom']);
  h.request('kitchen');
  assert.ok(h.state().plan.steps.some(step=>step.bedPhase==='uncover'),'Leaving the bedroom gets the cat out of the covers');
  assert.ok(h.state().plan.steps.some(step=>step.animation==='jumpOff'),'The cat climbs down before its next departure');
  h.until(()=>h.atInteraction('kitchen'));
  assert.deepEqual(h.arrivals.map(a=>a.destination),['bedroom','kitchen']);
}
console.log('Verified latest-command priority during jumps, bedroom quilt exits and immediate travel to the next task.');

for(const reduced of [false,true]){
  const h=harness({reduced});h.request('bedroom');
  h.until(()=>h.current().id==='bedroom'&&h.state()?.step.enteringRoom);
  h.partial(.3);h.request('bathroom');h.request('kitchen');
  assert.ok(h.state().step.enteringRoom,'A new command cannot teleport the cat out of a room-entry animation');
  h.until(()=>h.atInteraction('kitchen'));
  assert.deepEqual(h.arrivals.map(a=>a.destination),['bedroom','kitchen']);
  assert.ok(!h.completions.some(c=>c.room==='bathroom'||c.kind==='bedSnuggle'));
}
console.log('Verified entry-time command replacement, safe entry completion and no stale tasks in skipped rooms.');

{
  const h=harness({cold:true});h.request('bedroom');
  h.until(()=>h.env.transition?.destination==='bedroom');
  h.request('kitchen');h.until(()=>h.atInteraction('kitchen'));
  h.ready('kitchen');
  assert.equal(h.env.transition,null,'A delayed scene-ready callback for a previous destination cannot keep the new room hidden');
  assert.equal(h.current().props.roomVisible,true,'The latest destination becomes visible');
  h.ready('bedroom');
  assert.equal(h.env.pet.catHomeRoomId,'kitchen','Late readiness from an old room never moves the cat back');
}
console.log('Verified rapid chained journeys while cold room scenes are loading and delayed readiness arrives out of order.');

{
  const h=harness({cold:true});h.request('livingRoom','roomTravel','bedroom');
  h.until(()=>h.current().id==='bedroom'&&h.env.transition?.destination==='bedroom');
  assert.equal(h.env.requestedRoomCommand,null,'A plain travel command has no destination task waiting to wake the scheduler');
  assert.ok(h.state()?.step.enteringRoom,'A hidden destination must prepare entry before its first painted frame can release the camera');
  assert.equal(h.current().props.roomVisible,false);
  h.ready('bedroom');
  assert.equal(h.current().props.roomVisible,true);
  h.until(()=>h.current().api.activity===null);
  h.assertSingleCat();
}
console.log('Verified plain room travel prepares entry behind the outgoing frame without a task request or readiness deadlock.');

for(const phase of ['departure','entry','jump','meal']){
  const h=harness();
  const destination=phase==='jump'?'livingRoom':phase==='meal'?'kitchen':'bathroom';
  h.request(destination);
  if(phase==='entry')h.until(()=>h.current().id===destination&&h.state()?.step.enteringRoom);
  if(phase==='jump')h.until(()=>h.state()?.step.animation==='jumpOn');
  if(phase==='meal')h.until(()=>h.atInteraction('kitchen'));
  h.partial();
  const room=h.current(),state=h.state(),key=h.stepKey(state),end=state.step.native.path.at(-1);
  const before={arrivals:h.arrivals.length,feeds:h.feeds.length,completions:h.completions.length};
  h.setActive(false);h.advance(60_000);
  room.api.completeNativeStep(key,end);h.flush();
  assert.deepEqual({arrivals:h.arrivals.length,feeds:h.feeds.length,completions:h.completions.length},before,`${phase}: background timers and late renderer callbacks cannot finish paused tasks`);
  assert.equal(h.state().plan.kind,state.plan.kind,`${phase}: pausing preserves the task`);
  assert.equal(h.state().stepIndex,state.stepIndex,`${phase}: pausing preserves the current step`);
  h.setActive(true);h.until(()=>h.atInteraction(destination));
  h.request('bedroom');h.until(()=>h.atInteraction('bedroom'));h.assertSingleCat();
}
console.log('Verified pause/resume during departure, entry, jumps and meals, followed immediately by a task in another room.');

{
  const h=harness();h.request('bathroom');h.partial();h.setActive(false);
  h.request('bedroom');h.request('kitchen');h.advance(30_000);
  assert.equal(h.arrivals.length,0,'Commands issued while paused cannot move the cat between rooms');
  h.setActive(true);h.until(()=>h.atInteraction('kitchen'));
  assert.deepEqual(h.arrivals.map(a=>a.destination),['kitchen'],'Only the latest paused command runs on resume');
}
console.log('Verified replacement of queued commands while the app is paused.');

for(const native of [true,false]){
  const h=harness({native});h.request('kitchen');h.until(()=>h.atInteraction('kitchen'));
  h.browse('bathroom');
  assert.equal(h.current().props.roomVisible,false,'Browsing keeps the cat in the room where its task runs');
  h.until(()=>h.current().api.activity===null);
  assert.deepEqual(h.feeds,['kitchen'],'An offscreen meal finishes exactly once');
  assert.equal(h.env.pet.homeRoomId,'bathroom','Offscreen task completion cannot force the view back');
  h.request('bedroom');h.until(()=>h.atInteraction('bedroom'));h.assertSingleCat();
}
console.log('Verified offscreen task completion while browsing elsewhere and subsequent travel to another task.');

{
  const h=harness();h.request('bedroom','bedSnuggle','removed-bed');
  h.until(()=>h.current().id==='bedroom'&&h.current().api.activity===null);
  assert.equal(h.completions.length,0,'A missing target cannot complete or reward the requested activity');
  h.request('kitchen');h.until(()=>h.atInteraction('kitchen'));
  assert.deepEqual(h.arrivals.map(a=>a.destination),['bedroom','kitchen']);
  assert.ok(!h.completions.some(c=>c.kind==='bedSnuggle'),'A failed earlier target cannot resurrect after leaving its room');
}
console.log('Verified missing destination targets fail without stale activity or rewards and allow the next journey.');

for(const [model,kind] of [['bedroomWardrobe','cupboardHide'],['bedroomDresser','drawerHide']]){
  const h=harness({targets:{bedroom:[model,kind]}});h.request('bedroom');
  h.until(()=>h.atInteraction('bedroom'));
  assert.ok(h.state().step.native.path.at(-1)[1]>h.current().options.nativeWorld.home[1],'The hiding cat occupies the actual cupboard or drawer');
  h.request('bathroom');
  assert.equal(h.state().step.animation,'jumpOff','A hidden cat jumps out before starting the next room journey');
  h.partial();h.request('kitchen');
  assert.equal(h.state().step.animation,'jumpOff','Retargeting mid-exit lets the cat reach the floor safely');
  try{h.until(()=>h.atInteraction('kitchen'));}catch(error){console.error({model,kind,state:h.state(),arrivals:h.arrivals});throw error;}
  assert.deepEqual(h.arrivals.map(a=>a.destination),['bedroom','kitchen'],'A queued task cannot send the cat to an obsolete destination after leaving a cupboard');
  h.assertSingleCat();
}
console.log('Verified cupboard/drawer hiding, safe exits and replacement of the next room command while jumping out.');

{
  const h=harness({targets:{bedroom:['bedroomWardrobe','cupboardHide',{scale:.7}]}});
  h.request('bedroom');h.until(()=>h.current().id==='bedroom'&&h.state()?.step.native?.blocked);
  const state=h.state(),room=h.current();
  assert.equal(room.api.blockedActivity?.instanceId,'bedroom-target','A failed user command identifies the item for its notice');
  assert.equal(room.api.blockedActivity?.kind,'cupboardHide');
  const notice=room.api.blockedActivity;
  assert.equal(state.step.hold,false,'An unreachable hiding place cannot trap the cat in a held pose');
  room.api.completeNativeStep(h.stepKey(state),state.step.native.path.at(-1));h.flush();
  assert.equal(room.api.activity,null,'A blocked destination ends cleanly after arrival');
  assert.equal(h.completions.length,0,'An unreachable interaction is not reported as completed');
  h.advance(5000);h.setActive(false);h.setActive(true);
  assert.equal(room.api.blockedActivity,notice,'A notice stays readable without reappearing on refresh or resume');
  assert.equal(h.failures.length,1,'The failed task reports to Home once, including after refresh/resume');
  room.api.clearBlockedActivity();h.flush();
  assert.equal(room.api.blockedActivity,null,'The player can dismiss the notice');
  h.request('bedroom');h.until(()=>h.state()?.step.native?.blocked);
  assert.ok(room.api.blockedActivity,'Trying the blocked item again produces a fresh notice');
  h.request('kitchen');
  assert.equal(room.api.blockedActivity,null,'A new room command clears the previous failure immediately');
  h.until(()=>h.atInteraction('kitchen'));h.assertSingleCat();
  assert.equal(h.current().api.blockedActivity,null,'A successful next task never inherits the old warning');
  assert.deepEqual(h.arrivals.map(a=>a.destination),['bedroom','kitchen']);
}
console.log('Verified an unreachable destination ends without a held pose or false completion and accepts the next room task.');

{
  const h=harness({targets:{livingRoom:['bedroomWardrobe','cupboardHide',{scale:.7}]}});
  const room=h.current();
  room.api.startActivity('cupboardHide','livingRoom-target',undefined,'morning');h.flush();
  h.until(()=>h.state()?.step.native?.blocked);
  assert.equal(room.api.blockedActivity,null,'Automatic activities cannot spam path warnings');
  assert.equal(h.failures.length,0,'Automatic failure never announces a notice to Home');
  room.api.startActivity('cupboardHide','livingRoom-target');h.flush();
  h.until(()=>h.state()?.step.native?.blocked);
  assert.equal(room.api.blockedActivity?.instanceId,'livingRoom-target','An explicit command reports the same blocked target');
  assert.equal(h.failures.length,1);
}
console.log('Verified readable item-specific failure notices, dismiss/retry, new-command cleanup and silent automatic activity failures.');

// Smoothness has semantic consequences too: enter toward the selected fixture,
// retain the source gait token, and replace an entry task at its current point.
{
  const h=harness();h.request('bedroom');
  h.until(()=>h.current().id==='bedroom'&&h.state()?.step.enteringRoom);
  const entry=h.state();
  assert.equal(entry.plan.kind,'bedSnuggle','Entry heads straight to the requested task');
  assert.ok(!entry.step.returnHome,'A selected task does not first visit the saved home');
  assert.equal(entry.step.native.entryMotion.phase,1.375,'Home forwards the renderer stride token into the new room');
  assert.equal(h.env.catEntry.entry.motion.speed,1.8);
  const before=h.partial(.3);h.request('kitchen');
  const redirected=h.state();
  assert.equal(redirected.plan.kind,'roomTravel','A floor entry can accept the latest destination immediately');
  assert.ok(redirected.step.enteringRoom&&redirected.step.entryFromCurrent);
  assert.ok(Math.hypot(...redirected.step.native.path[0].map((v,k)=>v-before[k]))<1e-6,'The entry handoff starts at the real reported position');
  assert.ok(!redirected.plan.steps.some(step=>step.returnHome),'Task changes do not take a detour home');
  h.until(()=>h.atInteraction('kitchen'));h.assertSingleCat();
  assert.deepEqual(h.arrivals.map(a=>a.destination),['bedroom','kitchen']);
}
{
  const h=harness({doors:true});h.request('livingRoom','doorTravel','passage');
  assert.ok(h.state().step.native.through,'An actual placed door has a walking threshold handoff');
  h.until(()=>h.current().id==='kitchen'&&h.state()?.step.enteringRoom);
  assert.equal(h.env.catEntry.entry.motion.phase,1.375,'A physical doorway preserves locomotion metadata');
  assert.equal(h.env.pet.catHomeRoomId,'kitchen','Using a door moves the cat as well as the view');
  h.assertSingleCat();
}
console.log('Verified direct entry-to-task routing, renderer gait transfer through Home, mid-entry destination replacement without home detours and physical door travel.');

{
  const node=find(stageSource,n=>ts.isVariableDeclaration(n)&&n.name.getText(stageSource)==='buildRoomItemMenuActions');
  const calls=[],door={instanceId:'passage',decorationId:'japaneseDoorAni',doorDestination:'kitchen'};
  const menu=vm.runInNewContext(compile(`(${node.initializer.arguments[0].getText(stageSource)})`),{
    decorating:false,catPresent:true,bedId:'basic',onRequestRoomCommand:undefined,onSendCatToRoom:()=>{},viewport:{width:390,height:420},displayWidth:80,
    roomPlacedDecorations:[door],roomActivityBlocked:false,HOME_ROOM_ICONS:{kitchen:'cooking-pot'},
    getRoomCommands:()=>[],isRoomDoor:id=>id==='japaneseDoorAni',isOpenableDecorationId:()=>false,
    isFridgeDecorationId:()=>false,isCurtainDecorationId:()=>false,isPoweredDecorationId:()=>false,
    startRoomCommand:(...args)=>calls.push(args),t:(key,values)=>key==='home.goToRoom'?`Go to ${values.room}`:key,
  });
  const actions=menu({kind:'decoration',...door});
  assert.equal(actions[0].label,'Go to home.rooms.kitchen');actions[0].onPress();
  assert.deepEqual(calls,[['doorTravel','passage']],'The real item menu dispatches physical-door travel');
}
console.log('Verified the placed-door menu sends the cat to its assigned room.');

// A queued user command acknowledges immediately without replacing the airborne step.
for(const reduced of [false,true]) {
  const h=harness({reduced});h.request('livingRoom');
  if(reduced){assert.equal(h.current().api.commandAttention,undefined,'Reduce Motion suppresses acknowledgment');continue;}
  h.until(()=>h.state()?.step.animation==='jumpOn');h.partial();
  const key=h.stepKey(h.current().api.activity),travel=h.state().step.native;
  const first=h.current().api.commandAttention;
  h.current().api.startActivity('sofaSleep','livingRoom-target');h.flush();
  const notice=h.current().api.commandAttention;
  assert.equal(h.stepKey(h.current().api.activity),key,'Acknowledgment leaves the active jump revision intact');
  assert.equal(h.state().step.native,travel,'Acknowledgment does not rebuild the airborne route');
  assert.ok(notice.id>first.id,'A queued request publishes its own acknowledgment immediately');
  const target=h.current().options.nativeWorld.objects.find(object=>object.instanceId==='livingRoom-target');
  assert.ok(Math.hypot(...notice.target.map((v,i)=>v-(target.seat??target.position)[i]))<1e-8);
  h.current().api.startActivity('sofaSit','livingRoom-target');h.flush();
  assert.ok(h.current().api.commandAttention.id>notice.id,'The latest queued tap replaces the previous acknowledgment');
  h.until(()=>h.state()?.step.hold);
  assert.equal(h.state().plan.kind,'sofaSit','The latest queued command runs after landing');
}
console.log('Verified immediate queued-command acknowledgment, unchanged airborne steps, latest-tap priority and Reduce Motion.');
