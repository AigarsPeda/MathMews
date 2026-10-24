(() => {
  const hook = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (globalThis.__roomNavProfile) throw new Error('Navigation capture already active');
  const startedAt = performance.now(), frames = [], states = [], names = {};
  let previousFrame, frame, previousState;
  const originalCommit = hook.onCommitFiberRoot;
  const layoutKeys = ['bedId','roomBedOffset','bedRotationDegrees','bedScale','bedFlipped','placedToys','placedDecorations','roomLayerOrder'];
  function snapshot() {
    const rooms = new Map();
    function scan(f) {
      if (!f) return;
      const p = f.memoizedProps;
      if (p?.savedRoom && p?.homeRoomId && p?.commitRoomEdit) rooms.set(p.homeRoomId, {
        id: p.homeRoomId, visible: p.roomVisible, slide: p.sceneSlide ? {outgoing:p.sceneSlide.outgoing,direction:p.sceneSlide.direction} : null,
        catRoom: p.catHomeRoomId, layout: Object.fromEntries(layoutKeys.map(k => [k,p.savedRoom[k]]))
      });
      scan(f.child); scan(f.sibling);
    }
    for (const [id] of hook.rendererInterfaces) for (const root of hook.getFiberRoots(id)) scan(root.current);
    return [...rooms.values()];
  }
  const initial = snapshot();
  function record() {
    const rooms=snapshot(), state=rooms.map(({id,visible,slide,catRoom})=>({id,visible,slide,catRoom}));
    const key=JSON.stringify(state);
    if(key!==previousState) {states.push({at:performance.now()-startedAt,rooms:state});previousState=key;}
  }
  hook.onCommitFiberRoot=function(...args) {const result=originalCommit.apply(this,args);record();return result;};
  record();
  function tick(time) {if(previousFrame!==undefined)frames.push({at:time-startedAt,ms:time-previousFrame});previousFrame=time;frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);
  for(const [,r]of hook.rendererInterfaces)r.startProfiling(true,false);
  globalThis.__roomNavProfile={finish(){
    cancelAnimationFrame(frame);hook.onCommitFiberRoot=originalCommit;
    const profiles=[];
    for(const [id,r]of hook.rendererInterfaces){r.stopProfiling();const p=r.getProfilingData();for(const root of p.dataForRoots)for(const c of root.commitData)for(const [fid]of c.fiberActualDurations)names[id+':'+fid]=r.getDisplayNameForElementID(fid);profiles.push(p);}
    const final=snapshot();delete globalThis.__roomNavProfile;
    return {dev:__DEV__,duration:performance.now()-startedAt,initial,final,states,frames,names,profiles};
  }};
  return {started:true,rooms:initial.map(({id,visible,catRoom})=>({id,visible,catRoom}))};
})()
