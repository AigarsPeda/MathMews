(() => {
 const hook = __REACT_DEVTOOLS_GLOBAL_HOOK__;
 const moduleByName = name => [...__r.getModules()].find(([id,m])=> m.verboseName === name);
 const puzzles = __r(moduleByName('constants/puzzles.ts')[0]);
 const originalWisdom = puzzles.computePetWisdom;
 const sample = globalThis.__homeStoreProfile = {startedAt:performance.now(), frames:[], marks:[], wisdom:[], names:{}};
 puzzles.computePetWisdom = function(...args) { const start=performance.now(); const value=originalWisdom(...args); sample.wisdom.push({at:start-sample.startedAt,ms:performance.now()-start}); return value; };
 let frame, previous;
 function tick(time) { if (previous !== undefined) sample.frames.push(time-previous); previous=time; frame=requestAnimationFrame(tick); }
 frame=requestAnimationFrame(tick);
 for (const [id,r] of hook.rendererInterfaces) r.startProfiling(true,false);
 sample.mark = label => {
  const counts={};
  for(const [id,r] of hook.rendererInterfaces) for(const root of r.getProfilingData().dataForRoots) for(const commit of root.commitData) for(const [fid] of commit.fiberActualDurations) {
    const name=r.getDisplayNameForElementID(fid);
    if(/HomeScreen|HomeContent|StoreScreen|GameHeaderStats|HomeAchievementsStat|StoreCard/.test(name||'')) counts[name]=(counts[name]||0)+1;
  }
  sample.marks.push({label,at:performance.now()-sample.startedAt,frames:sample.frames.length,counts,wisdom:sample.wisdom.length});
 };
 sample.finish = () => {
  cancelAnimationFrame(frame); puzzles.computePetWisdom=originalWisdom;
  const profiles=[];
  for (const [id,r] of hook.rendererInterfaces) {r.stopProfiling(); const profile=r.getProfilingData(); for(const root of profile.dataForRoots) for(const commit of root.commitData) for(const [fid] of commit.fiberActualDurations) sample.names[id+':'+fid]=r.getDisplayNameForElementID(fid); profiles.push(profile);}
  return {dev:__DEV__,duration:performance.now()-sample.startedAt,frames:sample.frames,marks:sample.marks,wisdom:sample.wisdom,names:sample.names,profiles};
 };
 return {started:true,dev:__DEV__,headerIsMemo:typeof __r(moduleByName('components/economy/GameHeaderStats.tsx')[0]).GameHeaderStats === 'object'};
})()
