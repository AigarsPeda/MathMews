/** Exercise the real draw worklet against each shipped GLB skeleton, including IK. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function multiply(a,b) { return Array.from({length:16},(_,i)=>[0,1,2,3].reduce((s,k)=>s+a[k*4+i%4]*b[Math.floor(i/4)*4+k],0)); }
function matrix(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]) {
  const [x,y,z,w]=q;
  return [(1-2*y*y-2*z*z)*s[0],(2*x*y+2*z*w)*s[0],(2*x*z-2*y*w)*s[0],0,
    (2*x*y-2*z*w)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*x*w)*s[1],0,
    (2*x*z+2*y*w)*s[2],(2*y*z-2*x*w)*s[2],(1-2*x*x-2*y*y)*s[2],0,...t,1];
}
class Transform {
  constructor(data=identity) { this.data=[...data]; }
  get translation() { return this.data.slice(12,15); }
  translate(t) { return new Transform(multiply(matrix(t),this.data)); }
  scaling(s) { return new Transform(multiply(matrix(undefined,undefined,s),this.data)); }
  rotate(angle,axis) { const sine=Math.sin(angle/2);return new Transform(multiply(matrix(undefined,[...axis.map(v=>v*sine),Math.cos(angle/2)]),this.data)); }
}
let slots=[],cursor=0,effects=[],draw,asset,animator,rootTransform=new Transform(),locals,parents,model,read;
const rootEntity={root:true};
function world(i) { return new Transform(multiply(parents.has(i)?world(parents.get(i)).data:rootTransform.data,locals[i].data)); }
const transforms={createIdentityMatrix:()=>new Transform(),
  getWorldTransform:e=>e.root?rootTransform:world(e.i), getTransform:e=>e.root?rootTransform:locals[e.i],
  setTransform(e,m) { if(e.root)rootTransform=m;else locals[e.i]=m; } };
function memo(fn,deps) { const i=cursor++,old=slots[i];if(!old||deps.some((v,k)=>!Object.is(v,old.deps[k])))slots[i]={deps,value:fn()};return slots[i].value; }
const mocks={
  react:{useMemo:memo,useCallback:(fn,deps)=>memo(()=>fn,deps),useRef:v=>memo(()=>({current:v}),[]),
    useEffect(fn,deps) { const i=cursor++,old=slots[i];if(!old||deps.some((v,k)=>!Object.is(v,old.deps[k]))){slots[i]={deps};effects.push(fn);} }},
  'react-native-worklets-core':{useSharedValue:v=>memo(()=>({value:v}),[]),Worklets:{createRunOnJS:fn=>fn}},
  'react-native-filament':{useModel:()=>({state:'loaded',asset,rootEntity}),useAnimator:()=>animator,
    useFilamentContext:()=>({transformManager:transforms}),RenderCallbackContext:{useRenderCallback:fn=>{draw=fn;}}},
  './use-model-shadows':{useModelShadows(){}},
};
const cache=new Map();
function load(id) {
  if(id in mocks)return mocks[id];if(/\.(glb|png|webp)$/.test(id))return id;
  const base=path.resolve(id.startsWith('@/')?id.slice(2):id),file=fs.existsSync(base)?base:['.ts','.tsx','.json'].map(ext=>base+ext).find(fs.existsSync);
  assert.ok(file,id);if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  if(file.endsWith('.json'))module.exports=JSON.parse(fs.readFileSync(file,'utf8'));
  else vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
    {module,exports:module.exports,require:load,Math,Date,Map,Set});
  return module.exports;
}
function openSkin(skin) {
  const bytes=fs.readFileSync(`assets/3d/native/cat-${skin}.glb`),length=bytes.readUInt32LE(12),binary=bytes.subarray(28+length);
  model=JSON.parse(bytes.subarray(20,20+length));parents=new Map();model.nodes.forEach((node,i)=>node.children?.forEach(child=>parents.set(child,i)));
  read=index=>{const a=model.accessors[index],v=model.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3,VEC4:4}[a.type];
    return Array.from({length:a.count},(_,row)=>Array.from({length:width},(_,k)=>binary.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+row*(v.byteStride??width*4)+k*4)));};
  const channels=model.animations.map(animation=>animation.channels.map(channel=>{const s=animation.samplers[channel.sampler];return {...channel,times:read(s.input).flat(),output:read(s.output)};}));
  animator={getAnimationCount:()=>model.animations.length,getAnimationName:i=>model.animations[i].name,
    getAnimationDuration:i=>Math.max(...channels[i][0].times),applyCrossFade(){},updateBoneMatrices(){},
    applyAnimation(index,time) {
      const nodes=model.nodes.map(n=>({...n}));
      for(const channel of channels[index]) {
        const {times,output}=channel;let end=times.findIndex(t=>t>=time);if(end<0)end=times.length-1;
        const start=Math.max(0,end-1),t=start===end?0:Math.max(0,Math.min(1,(time-times[start])/(times[end]-times[start])));
        let next=output[end];if(channel.target.path==='rotation'&&output[start].reduce((s,v,k)=>s+v*next[k],0)<0)next=next.map(v=>-v);
        let value=output[start].map((v,k)=>v+(next[k]-v)*t);if(channel.target.path==='rotation'){const d=Math.hypot(...value);value=value.map(v=>v/d);}
        nodes[channel.target.node][channel.target.path]=value;
      }
      locals=nodes.map(n=>new Transform(n.matrix??matrix(n.translation,n.rotation,n.scale)));
    }};
  asset={getFirstEntityByName:name=>{const i=model.nodes.findIndex(n=>n.name===name);return i<0?undefined:{i};}};
  animator.applyAnimation(model.animations.findIndex(a=>a.name==='idle'),0);rootTransform=new Transform();
}
const {NativeCatActor}=load('@/components/pet/native/NativeCatActor');
const {catTurnDuration,catTurnPose,catTurnPaw,catTurnPawOrientation}=load('@/utils/native-cat-turn');
const {FLOOR_Y}=load('@/utils/native-room-world');
const idle={kind:'segment',segment:{assetKey:'idle',loop:true}},walking={kind:'segment',segment:{assetKey:'walk',loop:true}};
const pawNames=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
function render(props) { cursor=0;effects=[];NativeCatActor(props);effects.forEach(fn=>fn()); }
function point(name) { return world(asset.getFirstEntityByName(name).i).translation; }
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const poses=[];
for(const skin of ['orange','grey','white']) {
  openSkin(skin);
  for(const fps of [30,60,120])for(const degrees of [-180,-135,-90,-70,-45,-23,23,45,70,90,110,135,179,180])for(const scale of [.3,.8]) {
    slots=[];rootTransform=new Transform();
    const room={width:390,height:420,catScale:scale,radius:.3,home:[0,FLOOR_Y,0],objects:[]};
    render({active:true,world:room,playback:idle});draw({timeSinceLastFrame:1/fps});
    const startHeading=Math.PI/4,heading=startHeading+degrees*Math.PI/180;
    const facing=Math.atan2(Math.sin(heading),Math.cos(heading)),angle=Math.atan2(Math.sin(facing-startHeading),Math.cos(facing-startHeading)),duration=catTurnDuration(angle);
    const initial=pawNames.map(point),neutral=initial.map(p=>{const x=(p[0]-room.home[0])/scale,z=(p[2]-room.home[2])/scale,c=Math.cos(startHeading),s=Math.sin(startHeading);return [x*c-z*s,(p[1]-FLOOR_Y)/scale,z*c+x*s];});
    const soles=pawNames.map(name=>transforms.getWorldTransform(asset.getFirstEntityByName(name)).data);
    const end=[Math.sin(heading),FLOOR_Y,Math.cos(heading)];
    const props={active:true,world:room,playback:walking,activityKey:'pivot',travel:{path:[room.home,end],duration:2,distance:1,jump:false}};
    render(props);
    for(let frame=1;frame<=Math.floor(duration*fps);frame++) {
      draw({timeSinceLastFrame:1/fps});
      const t=frame/fps/duration,body=catTurnPose(angle,t);
      assert.ok(distance(rootTransform.translation,room.home)<1e-7,'Turning keeps the root in place');
      let grounded=0;
      for(let i=0;i<4;i++) {
        const p=catTurnPaw(neutral[i],neutral[i],angle,t,i),c=Math.cos(startHeading),s=Math.sin(startHeading);
        const expected=[(p[0]*c+p[2]*s)*scale,FLOOR_Y+p[1]*scale,(p[2]*c-p[0]*s)*scale];
        assert.ok(distance(point(pawNames[i]),expected)<.004*scale,`${skin}/${degrees}/${fps} frame=${frame} t=${t}: ${pawNames[i]} reaches its planted/lifted target (${distance(point(pawNames[i]),expected)/scale})`);
        const orientation=catTurnPawOrientation(angle,t,i),basis=transforms.getWorldTransform(asset.getFirstEntityByName(pawNames[i])).data;
        for(const column of [0,4,8]) {
          const x=soles[i][column],y=soles[i][column+1],z=soles[i][column+2],c=Math.cos(orientation.heading),s=Math.sin(orientation.heading);
          assert.ok(distance(basis.slice(column,column+3),[x*c+z*s,y,z*c-x*s])<.002*scale,`${degrees} frame=${frame} paw=${i} axis=${column} sole error=${distance(basis.slice(column,column+3),[x*c+z*s,y,z*c-x*s])/scale}`);
        }
        if(Math.abs(p[1]-neutral[i][1])<1e-6)grounded++;
      }
      assert.ok(grounded>=3,'Three feet support every step');
      const head=transforms.getWorldTransform(asset.getFirstEntityByName('head')).data;
      const headYaw=Math.atan2(head[8],head[10]);
      const error=Math.atan2(Math.sin(headYaw-startHeading-body.heading-body.head),Math.cos(headYaw-startHeading-body.heading-body.head));
      assert.ok(Math.abs(error)<.02,`head ${degrees}/${fps} t=${t} error=${error} actual=${headYaw} expected=${startHeading+body.heading+body.head}`);
      if(frame===Math.round(duration*fps*.4)) {
        const before=model.nodes.map((_,i)=>world(i).data);
        render({...props,active:false});draw({timeSinceLastFrame:.5});
        before.forEach((m,i)=>assert.deepEqual(world(i).data,m,'Pausing freezes the head, every leg and the root mid-turn'));
        render(props);
      }
      if(skin==='orange'&&fps===60&&scale===.8&&[-90,90,180].includes(degrees)&&frame%6===0)poses.push({degrees,progress:t,
        nodes:Object.fromEntries(model.nodes.map((n,i)=>[n.name,world(i).data]))});
    }
  }
  for(const phase of [.3,.65]) {
    slots=[];rootTransform=new Transform();
    const room={width:390,height:420,catScale:.8,radius:.3,home:[0,FLOOR_Y,0],objects:[]};
    render({active:true,world:room,playback:idle});draw({timeSinceLastFrame:1/60});
    const travel={path:[room.home,[-1,FLOOR_Y,0]],duration:2,distance:1,jump:false};
    render({active:true,world:room,playback:walking,activityKey:'first-turn',travel});
    for(let i=0;i<Math.round(phase*60);i++)draw({timeSinceLastFrame:1/60});
    const before=pawNames.map(point),head=transforms.getWorldTransform(asset.getFirstEntityByName('head')).data;
    const yaw=Math.atan2(head[8],head[10]),spine=point('spine');
    render({active:true,world:room,playback:walking,activityKey:'interrupted',travel:{...travel,path:[room.home,[1,FLOOR_Y,0]]}});
    draw({timeSinceLastFrame:1/60});
    before.forEach((p,i)=>assert.ok(distance(p,point(pawNames[i]))<.004,'An interrupted turn keeps each visible paw contact'));
    const after=transforms.getWorldTransform(asset.getFirstEntityByName('head')).data;
    const change=Math.atan2(Math.sin(Math.atan2(after[8],after[10])-yaw),Math.cos(Math.atan2(after[8],after[10])-yaw));
    assert.ok(Math.abs(change)<.04,`Changing commands carries the head pose into the new anticipation: ${change} at ${phase}`);
    assert.ok(distance(spine,point('spine'))<.003,'Changing commands preserves the current body crouch');
  }
  for(const fps of [30,60,120])for(const sign of [-1,1]) {
    slots=[];rootTransform=new Transform();
    const room={width:390,height:420,catScale:.8,radius:.3,home:[0,FLOOR_Y,0],objects:[]};
    render({active:true,world:room,playback:idle});draw({timeSinceLastFrame:1/fps});
    const takeoff=[.4,FLOOR_Y,.4],angle=Math.PI/4+sign*Math.PI/2;
    const landing=[takeoff[0]+.5*Math.sin(angle),FLOOR_Y,takeoff[2]+.5*Math.cos(angle)],turnDuration=catTurnDuration(Math.PI/2);
    const travel={path:[room.home,takeoff,landing],duration:.6+turnDuration+1,distance:1,jump:false,legs:[
      {kind:'walk',path:[room.home,takeoff],duration:.6},
      {kind:'hop',path:[takeoff,landing],duration:turnDuration+1,turnDuration,arcHeight:.2},
    ]};
    let props={active:true,world:room,playback:walking,activityKey:'walk-turn-hop',travel},samples=0,resumed=false;
    render(props);
    for(let frame=0;frame<Math.ceil((.6+turnDuration+.1)*fps);frame++) {
      draw({timeSinceLastFrame:1/fps});
      const state=slots.find(s=>s?.value?.value?.turnLeg!==undefined).value.value;
      if(state.elapsed>=.6&&state.elapsed<.6+turnDuration) {
        samples++;
        assert.ok(distance(rootTransform.translation,takeoff)<1e-7,'The turn before a hop stays on the takeoff point');
        assert.equal(state.turnLeg,1,'The hop approach uses the signed stepping turn');
        const progress=(state.elapsed-.6)/turnDuration,c=Math.cos(state.turnFrom),s=Math.sin(state.turnFrom);
        pawNames.forEach((name,i)=>{
          const p=catTurnPaw(state.turnNeutral[i],state.turnFeet[i],state.turnAngle,progress,i);
          const expected=[takeoff[0]+(p[0]*c+p[2]*s)*room.catScale,takeoff[1]+p[1]*room.catScale,takeoff[2]+(p[2]*c-p[0]*s)*room.catScale];
          assert.ok(distance(point(name),expected)<.004*room.catScale,'Pre-hop steps reach the same stable foot targets');
        });
        if(progress>.35&&!resumed) {
          const before=model.nodes.map((_,i)=>world(i).data);
          render({...props,active:false});draw({timeSinceLastFrame:.3});
          props={...props,travel:{...travel,elapsed:state.elapsed-.03}};
          render(props);draw({timeSinceLastFrame:0});
          before.forEach((m,i)=>assert.ok(distance(world(i).data,m)<1e-6,'A delayed resume preserves the full pre-hop turn pose and foot anchors'));
          resumed=true;
        }
      }
    }
    assert.ok(samples>fps*.5&&resumed,'The real route exercised and resumed a complete pre-hop turn');
  }
  console.log(`Verified ${skin}: left/right 23–180 degree turns, exact paw contacts and level soles, three supports, head anticipation, interruption and mid-turn pause at 30/60/120 FPS and two sizes.`);
}
// The foot trajectory itself has no slip while planted and zero lift at contact.
for(const angle of [-Math.PI,Math.PI/2])for(let i=0;i<4;i++) {
  const rest=[i%2?.22:-.22,.05,i<2?.38:-.44];let previous=catTurnPaw(rest,rest,angle,0,i);
  for(let frame=1;frame<=1200;frame++) {
    const p=catTurnPaw(rest,rest,angle,frame/1200,i);
    if(Math.abs(previous[1]-rest[1])<1e-10&&Math.abs(p[1]-rest[1])<1e-10)assert.ok(distance(previous,p)<1e-10,'A planted paw never slides');
    previous=p;
  }
}
for(let frame=0;frame<=240;frame++)for(let i=0;i<4;i++) {
  const left=[i%2?.22:-.22,.05,i<2?.38:-.44],right=[-left[0],left[1],left[2]];
  const a=catTurnPaw(left,left,-Math.PI*.7,frame/240,i),b=catTurnPaw(right,right,Math.PI*.7,frame/240,i%2?i-1:i+1);
  assert.ok(distance(a,[-b[0],b[1],b[2]])<1e-8,'Left/right steps mirror with the inside forepaw leading');
}
if(process.argv.includes('--poses'))fs.writeFileSync('/tmp/brainpet-turn-poses.json',JSON.stringify(poses));
