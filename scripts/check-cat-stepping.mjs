import assert from 'node:assert/strict';
import {openSkin,resetCatActor,render,drawCat,actorState,actorBones,sampleCatClip,load,idle,walking,enableActorCrossfade} from './check-cat-turning.mjs';

const {CAT_GAITS}=load('@/utils/native-cat-gaits');
const {catPacedPath,catWalkTiming}=load('@/utils/native-cat-locomotion');
const {FLOOR_Y}=load('@/utils/native-room-world');
const names=['L.front.paw','R.front.paw','L.rear.paw','R.rear.paw'];
const distance=(first,second)=>Math.hypot(...first.map((value,index)=>value-second[index]));
const skins=process.argv.includes('--all-skins')?['orange','grey','white']:['orange'];
enableActorCrossfade();

for(const skin of skins) {
  openSkin(skin);
  const rest=sampleCatClip('idle',0);
  const axis=(matrix,original,direction)=>{
    const local=[0,1,2].map(column=>direction.reduce((sum,value,index)=>sum+value*original[column*4+index],0)/Math.hypot(...original.slice(column*4,column*4+3)));
    return [0,1,2].map(row=>local.reduce((sum,value,column)=>sum+value*matrix[column*4+row]/Math.hypot(...matrix.slice(column*4,column*4+3)),0));
  };
  const footprint=(matrix,name)=>{
    const forward=axis(matrix,rest[name],[0,0,1]),up=axis(matrix,rest[name],[0,1,0]),right=axis(matrix,rest[name],[1,0,0]);
    const vertices=[];
    for(const across of [-.15,.15])for(const along of [-.14,.23])for(const height of [-.1,.1]) {
      vertices.push([0,1,2].map(index=>matrix[12+index]+across*right[index]+along*forward[index]+height*up[index]));
    }
    return {vertices,axes:[forward,up,right]};
  };
  const clearance=(first,second)=>Math.max(...[...first.axes,...second.axes].map(direction=>{
    const project=point=>point.reduce((sum,value,index)=>sum+value*direction[index],0);
    const left=first.vertices.map(project),right=second.vertices.map(project);
    return Math.max(Math.min(...left)-Math.max(...right),Math.min(...right)-Math.max(...left));
  }));
  for(const gait of ['walk','trot','run']) {
    const spec=CAT_GAITS[gait];
    let gap=Infinity;
    for(let frame=0;frame<240;frame++) {
      const bones=sampleCatClip(gait,frame/240);
      for(const name of names) {
        const bottom=Math.min(...footprint(bones[name],name).vertices.map(vertex=>vertex[1]));
        assert.ok(bottom>-.005,`${skin}/${gait}/${name}/${frame}: the rotating mitten clears the floor (${bottom})`);
      }
      for(const side of ['L','R'])gap=Math.min(gap,clearance(footprint(bones[`${side}.front.paw`],`${side}.front.paw`),footprint(bones[`${side}.rear.paw`],`${side}.rear.paw`)));
    }
    assert.ok(gap>.005,`${skin}/${gait}: same-side mitten volumes clear throughout the entire cycle (${gap})`);
    for(const [index,name] of names.entries()) {
      const recovery=(spec.offsets[index]+spec.stance+(1-spec.stance)*.55)%1;
      const paw=sampleCatClip(gait,recovery)[name];
      assert.ok(axis(paw,rest[name],[0,0,1])[1]>.20,`${skin}/${gait}/${name}: toes lift during recovery, rather than pointing into the floor`);
    }
    console.log(`${skin}/${gait}: minimum authored mitten clearance ${gap.toFixed(4)}`);
  }
  for(const fps of [30,60,120]) {
    resetCatActor();
    const scale=.4,home=[0,FLOOR_Y,0],end=[0,FLOOR_Y,1.92];
    const world={width:390,height:420,catScale:scale,radius:.16,home,objects:[]};
    render({active:true,world,playback:idle,travel:{path:[home],heading:0,distance:0,duration:0,jump:false}});
    for(let frame=0;frame<fps*.8;frame++)drawCat(1/fps);
    const path=catPacedPath([home,end],scale),travel={path,...catWalkTiming(path,scale,'walk'),distance:1.92,jump:false};
    render({active:true,world,playback:walking,activityKey:'stepping',travel});
    let previous,slip=0,corrections=0,contacts=0;
    for(let frame=0;frame<Math.ceil((travel.duration+.5)*fps);frame++) {
      drawCat(1/fps);
      const state=actorState(),bones=actorBones();
      const anchors=state.gaitContacts.map(anchor=>anchor&&[...anchor]);
      if(state.distance>scale&&state.distance<1.92-scale) {
        corrections+=state.gaitSwings.filter(Boolean).length;
        if(previous)for(const [index,name] of names.entries()) {
          if(anchors[index]&&previous.anchors[index]&&distance(anchors[index],previous.anchors[index])<1e-7) {
            slip=Math.max(slip,distance(bones[name].slice(12,15),previous.bones[name].slice(12,15))/scale);
            contacts++;
          }
        }
      }
      previous={anchors,bones};
    }
    assert.equal(corrections,0,`${skin}/${fps}: a steady straight walk never inserts corrective hops`);
    assert.ok(contacts>fps&&slip<.004,`${skin}/${fps}: support contacts remain fixed (${slip})`);
    assert.ok(distance(actorState().position,end)<1e-7,'The stepping changes preserve exact arrival');
  }
}
console.log('Verified lifted recovery toes, full-cycle mitten volumes and correction-free planted walking at 30/60/120 FPS.');
