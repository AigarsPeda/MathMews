/** Actual catalog geometry arranged with clear support-to-support jumps. */
const rotate=(p,h)=>[Math.cos(h)*p[0]+Math.sin(h)*p[2],p[1],Math.cos(h)*p[2]-Math.sin(h)*p[0]];
export function relocate(object,x,z,angle=0) {
  const offset=[x-object.position[0],0,z-object.position[2]],at=p=>rotate(p.map((v,i)=>v+offset[i]),angle);
  const bounds=box=>{const corners=[box.min[0],box.max[0]].flatMap(x=>[box.min[1],box.max[1]].flatMap(y=>[box.min[2],box.max[2]].map(z=>at([x,y,z]))));
    return {...box,min:[0,1,2].map(i=>Math.min(...corners.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...corners.map(p=>p[i])))};};
  return {...bounds(object),position:at(object.position),heading:object.heading+angle,seatHeading:object.seatHeading+angle,
    seat:at(object.seat),approach:at(object.approach),collisionBoxes:object.collisionBoxes.map(bounds),
    bed:object.bed&&{surface:at(object.bed.surface),covered:at(object.bed.covered)},
    cupboard:object.cupboard&&at(object.cupboard),drawer:object.drawer&&at(object.drawer),
    interactionBoxes:object.interactionBoxes?.map(bounds)};
}
export function furnitureTransferScene(w,getDecorationRotationGroup,id='tablePurple',degrees=0) {
  const group=getDecorationRotationGroup(id);
  const options={width:390,height:420,petSize:80,sizeScale:1.15,homeOffset:{x:0,y:.4},decorations:[
    {decorationId:'sofaA',instanceId:'sofa',offset:{x:0,y:0},scale:id==='chairOfficeA'?1.3:1.5},
    {decorationId:group?.[0]??id,rotationIndex:group?.indexOf(id)??0,instanceId:'target',offset:{x:.8,y:.3},scale:/^chair/.test(id)?2:1.8},
  ],toys:[],ownedToyIds:[],hungry:false,asleep:false};
  const original=w.buildNativeRoomWorld(options),angle=degrees*Math.PI/180;
  const source=relocate(original.objects[0],id==='chairOfficeA'?-1.05:-.4,-.25,angle),target=relocate(original.objects[1],id==='chairOfficeA'?.35:1.1,id==='chairRockingOak'?-.15:0,angle);
  const world={...original,objects:[source,target]};world.home=w.nearestFree(rotate([-.8,w.FLOOR_Y,1.5],angle),world);
  return {options:{...options,nativeWorld:world},world,source,target};
}

export function furnitureExplorationScene(w,getDecorationRotationGroup) {
  const scene=furnitureTransferScene(w,getDecorationRotationGroup);
  const third={...relocate(scene.target,1.5,1),instanceId:'third'};
  const world={...scene.world,objects:[...scene.world.objects,third]};
  return {...scene,world,third,options:{...scene.options,nativeWorld:world,decorations:[
    ...scene.options.decorations,{...scene.options.decorations[1],instanceId:'third'},
  ]}};
}
