(() => {
 const hook=__REACT_DEVTOOLS_GLOBAL_HOOK__, originalCommit=hook.onCommitFiberRoot;
 const samples=[], diffs=[], restores=[];
 const wrap=(file,name)=>{const entry=[...__r.getModules()].find(([id,m])=>m.verboseName===file);const module=__r(entry[0]), original=module[name];module[name]=function(...args){const start=performance.now();try{return original(...args);}finally{samples.push({name,at:start,ms:performance.now()-start});}};restores.push(()=>module[name]=original);};
 for(const [file,name]of [['utils/room-edit.ts','applyRoomObjectEdits'],['utils/room-placement-access.ts','roomPlacementAccess'],['utils/native-room-world.ts','buildNativeRoomWorld']])wrap(file,name);
 hook.onCommitFiberRoot=function(...args){function scan(f){if(!f)return;const p=f.memoizedProps,o=f.alternate?.memoizedProps;if(p?.homeRoomId&&p?.onCommitRoomEdit&&o){const keys=Object.keys(p).filter(k=>!Object.is(p[k],o[k]));if(keys.length)diffs.push({at:performance.now(),room:p.homeRoomId,keys});}scan(f.child);scan(f.sibling);}scan(args[1].current);return originalCommit.apply(this,args);};
 globalThis.__furnitureSaveCapture={finish(){hook.onCommitFiberRoot=originalCommit;restores.forEach(fn=>fn());return{samples,diffs};}};
 return 'Save capture started';
})()
