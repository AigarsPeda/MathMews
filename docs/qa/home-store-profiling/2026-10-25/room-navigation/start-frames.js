(() => {
 const startedAt=performance.now(),frames=[];let handle,previous;
 function tick(time){if(previous!==undefined)frames.push({at:time-startedAt,ms:time-previous});previous=time;handle=requestAnimationFrame(tick);}
 handle=requestAnimationFrame(tick);
 globalThis.__roomNavFrames={finish(){cancelAnimationFrame(handle);delete globalThis.__roomNavFrames;return {dev:__DEV__,duration:performance.now()-startedAt,frames};}};
 return 'Frame-only recording started; CPU and React profiling are off';
})()
