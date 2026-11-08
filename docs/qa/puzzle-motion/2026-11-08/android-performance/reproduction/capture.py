import pathlib
exec((pathlib.Path(__file__).with_name('android-ab.py')).read_text().split('\ntry:\n')[0])
OUT=pathlib.Path('/Users/aigarspeda/Desktop/BrainPet/docs/qa/puzzle-motion/2026-11-08/android-performance/captures');OUT.mkdir(parents=True,exist_ok=True)
meta={}
try:
 for mode,scale in [('normal',1),('reduced',0)]:
  for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:adb('shell','settings','put','global',key,str(scale))
  startup_app();set_mode('after',True)
  meta[mode]={'bar_bounds':box(wait('Probe 0')),'scales':scale}
  c=record(mode+'-bar');time.sleep(.5)
  for step in range(1,4):tap('QA Advance');time.sleep(.8)
  time.sleep(.4);stop_record(c);shot(mode+'-bar')
  set_mode('after',False);wait('Answer 10');tap('Answer 10');tap('Check answer');time.sleep(1.4);wait('Next puzzle')
  c=record(mode+'-entry');time.sleep(.4);tap('Next puzzle');time.sleep(1.5);wait('Puzzle 2 of 10');time.sleep(.3);stop_record(c)
  shot(mode+'-entry');assert_progress(1);assert box(wait('puzzle-question'))[1]==321
  meta[mode]['traces']=reports()
 meta['native_crashes']=adb('logcat','-d','-b','crash','-v','brief');assert PACKAGE not in meta['native_crashes']
 log('Normal and reduced-motion Android captures passed.')
finally:
 for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:adb('shell','settings','put','global',key,'1')
 (OUT/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
 (OUT/'events.json').write_text(json.dumps(events,indent=2)+'\n')
