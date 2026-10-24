(() => {
 const start=performance.now(), frames=[]; let previous, id;
 const sample=globalThis.__idleFrames={dev:__DEV__,frames,done:false};
 const tick=now=>{if(previous!==undefined)frames.push(now-previous);previous=now;id=requestAnimationFrame(tick);};
 id=requestAnimationFrame(tick);
 setTimeout(()=>{cancelAnimationFrame(id);sample.duration=performance.now()-start;sample.done=true;},15000);
 return 'Sampling 15 seconds';
})()
