import pathlib
exec(pathlib.Path(__file__).with_name('android-ab.py').read_text().split('\ntry:\n')[0])
OUT=pathlib.Path('/Users/aigarspeda/Desktop/BrainPet/docs/qa/puzzle-motion/2026-11-08/android-performance/production');OUT.mkdir(exist_ok=True)
rows=[];adb('logcat','-c','-b','crash')
for run in range(3):
 adb('shell','am','force-stop',PACKAGE);s=time.monotonic();adb('shell','am','start','-W','-a','android.intent.action.MAIN','-c','android.intent.category.LAUNCHER','-n',PACKAGE+'/.MainActivity');end=s+60
 while time.monotonic()<end:
  nodes=ui()
  if any(find(nodes,label) is not None for label in ['Open settings','Meet your cat!']):
   import io
   from PIL import Image
   image=Image.open(io.BytesIO(adb('exec-out','screencap','-p',binary=True))).convert('RGB')
   if sum(r<110 and g<110 and b<110 for r,g,b in image.crop((50,100,1030,380)).getdata())>1000:break
  startup(nodes);time.sleep(.2)
 else:raise AssertionError('Production cold launch did not become ready')
 rows.append({'launch':run+1,'ready':True,'seconds':round(time.monotonic()-s,3)})
 shot('cold-launch-'+str(run+1));print(rows[-1],flush=True)
crashes=adb('logcat','-d','-b','crash','-v','brief');assert PACKAGE not in crashes and 'om.mathmews.app' not in crashes
(OUT/'checks.json').write_text(json.dumps(rows,indent=2)+'\n');(OUT/'native-crashes.log').write_text(crashes)
