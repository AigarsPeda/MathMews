import pathlib
exec(pathlib.Path(__file__).with_name('android-ab.py').read_text().split('\ntry:\n')[0])
OUT=pathlib.Path('/Users/aigarspeda/Desktop/BrainPet/docs/qa/puzzle-motion/2026-11-08/android-performance/captures')
set_mode('after',False);tap('Answer 10');tap('Check answer');wait('Next puzzle');time.sleep(3);n=wait('Next puzzle');x1,y1,x2,y2=box(n)
c=record('normal-entry-no-poll');time.sleep(.4);adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(7);stop_record(c);assert wait('Puzzle 2 of 10') is not None
print('No-poll entry captured.',flush=True)
