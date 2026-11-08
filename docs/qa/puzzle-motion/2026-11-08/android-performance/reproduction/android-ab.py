import pathlib, subprocess, time, json, re, sys, xml.etree.ElementTree as ET
import uiautomator2
ADB='/Users/aigarspeda/Library/Android/sdk/platform-tools/adb';SERIAL='emulator-5580';PACKAGE='com.mathmews.app'
OUT=pathlib.Path('/Users/aigarspeda/Desktop/BrainPet/docs/qa/puzzle-motion/2026-11-08/android-performance/final');OUT.mkdir(parents=True,exist_ok=True)

def adb(*parts,check=True,binary=False):
 for attempt in range(4):
  r=subprocess.run([ADB,'-s',SERIAL,*parts],capture_output=True,timeout=60)
  if not check or r.returncode==0:return r.stdout if binary else r.stdout.decode(errors='replace').strip()
  if attempt<3 and (b'offline' in r.stderr or not r.stderr.strip()):
   subprocess.run([ADB,'-s',SERIAL,'wait-for-device'],capture_output=True,timeout=20);time.sleep(.3);continue
  raise RuntimeError(str(parts)+': '+r.stderr.decode(errors='replace'))
assert 'BrainPet_Motion_Perf_QA' in adb('emu','avd','name')
d=uiautomator2.connect(SERIAL);d.jsonrpc.setConfigurator({'waitForIdleTimeout':0,'waitForSelectorTimeout':0})
events=[];cases=[]
def log(message):print(message,flush=True);events.append({'at':time.time(),'message':message})
def ui():return list(ET.fromstring(d.dump_hierarchy(compressed=True)).iter('node'))
def find(nodes,label):
 hits=[n for n in nodes if label in (n.get('text'),n.get('content-desc'),n.get('resource-id')) or n.get('content-desc','').startswith(label+', ') or n.get('resource-id','').endswith('/'+label)]
 return next((n for n in hits if n.get('clickable')=='true'),hits[0] if hits else None)
def box(n):return tuple(map(int,re.findall(r'\d+',n.get('bounds',''))))
def click(n):
 x1,y1,x2,y2=box(n);assert x2>x1 and y2>y1,n.attrib;d.click((x1+x2)//2,(y1+y2)//2)
def startup(nodes):
 close=find(nodes,'Close')
 if close is not None and find(nodes,'Reload') is not None:click(close);return True
 for label in ['Continue','Allow','While using the app']:
  n=find(nodes,label)
  if n is not None:click(n);return True
 return False
def wait(label,timeout=30,press=False):
 until=time.monotonic()+timeout
 while time.monotonic()<until:
  nodes=ui();n=find(nodes,label)
  if n is not None:
   if press:click(n)
   return n
  startup(nodes);time.sleep(.1)
 raise AssertionError('Missing '+label+'; labels '+str([n.get('text') or n.get('content-desc') for n in nodes if n.get('text') or n.get('content-desc')]))
def tap(label):log('Tap '+label);return wait(label,press=True)
def shot(name):(OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p',binary=True))
def record(name):
 remote='/sdcard/brainpet-'+name+'.mp4';adb('shell','rm','-f',remote)
 proc=subprocess.Popen([ADB,'-s',SERIAL,'shell','screenrecord','--bit-rate','6000000','--time-limit','40',remote],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 time.sleep(.4);return proc,remote,name

def stop_record(clip):
 proc,remote,name=clip;pid=adb('shell','pidof','screenrecord',check=False)
 if pid:adb('shell','kill','-2',pid)
 proc.wait(timeout=10);adb('pull',remote,str(OUT/(name+'.mp4')));adb('shell','rm','-f',remote)
def assert_progress(expected):
 import io
 from PIL import Image
 n=bar(ui());assert n is not None
 x1,y1,x2,y2=box(n)
 im=Image.open(io.BytesIO(adb('exec-out','screencap','-p',binary=True))).convert('RGB')
 green=sum(g>r*1.3 and g>bl*1.4 for r,g,bl in im.crop((x1,(y1+y2)//2,x2,(y1+y2)//2+1)).getdata())
 assert abs(green-(x2-x1)*expected/10)<8,('Visible progress must survive delayed sync and React renders',green,expected)

def answer(index, value):
 if index not in [1,2,4]:tap('Answer '+value);return
 written=''
 for key in value:
  label='response-key-'+key
  n=find(ui(),label);dock=box(wait('Check answer'))
  if n is None or box(n)[3]>dock[1] or box(n)[1]<240:
   d.swipe(540,1740,540,940,duration=.25);time.sleep(.7)
  n=wait(label);assert box(n)[3]<=box(wait('Check answer'))[1],('Key must be above the dock',label,box(n))
  tap(label);written+=key
  until=time.monotonic()+10
  while time.monotonic()<until:
   field=wait('response-value')
   if field.get('text')==written:break
   time.sleep(.1)
  else:raise AssertionError(('The keypad must paint each entered character',written,field.attrib))

def bar(nodes):return next((n for n in nodes if re.fullmatch(r'Puzzle \d+ of \d+',n.get('content-desc','')) is not None),None)
def fixture():
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','mathmews://android-motion-qa','-n',PACKAGE+'/.MainActivity')
 wait('QA Play',timeout=60)
 until=time.monotonic()+60
 while time.monotonic()<until:
  nodes=ui()
  if find(nodes,'Math Mews') is None and find(nodes,'Loading game') is None:break
  startup(nodes);time.sleep(.1)
 wait('Answer 10');return

def startup_app():
 adb('shell','am','force-stop',PACKAGE)
 adb('shell','am','start','-W','-a','android.intent.action.MAIN','-c','android.intent.category.LAUNCHER','-n',PACKAGE+'/.MainActivity')
 until=time.monotonic()+120
 while time.monotonic()<until:
  nodes=ui()
  if any(find(nodes,x) is not None for x in ['Open settings','Meet your cat!','QA Play']):break
  startup(nodes);time.sleep(.2)
 else:raise AssertionError('App startup failed')
 fixture()

def reports():
 n=wait('qa-trace');return json.loads(n.get('content-desc'))
def wait_report(label,timeout=8):
 time.sleep(.65)
 until=time.monotonic()+timeout
 while time.monotonic()<until:
  rows=reports();hit=next((r for r in reversed(rows) if r['label']==label),None)
  if hit is not None:return hit
  time.sleep(.08)
 raise AssertionError(('Missing frame trace',label,rows))

def set_mode(variant,probe):
 tap('QA '+variant.title());tap('QA '+('Bar' if probe else 'Play'));time.sleep(1)

try:
 startup_app();adb('logcat','-c','-b','crash')
 # Alternate the order so warmed shaders and host scheduling favor neither implementation.
 probes=[]
 for batch,variant in enumerate(['before','after','after','before']):
  set_mode(variant,True)
  adb('shell','dumpsys','gfxinfo',PACKAGE,'reset')
  for step in range(1,8):
   tap('QA Advance');row=wait_report(f'{variant}-bar-{step}')
   if step>1:probes.append({'batch':batch,**row})
  (OUT/f'bar-{batch}-{variant}-frames.txt').write_text(adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats'))
 (OUT/'bar-traces.json').write_text(json.dumps(probes,indent=2)+'\n')
 for run,variant in enumerate(['after','before']):
  set_mode(variant,False);wait('Answer 10');answers=['10','5','11:00','8','600'];cases=[]
  for index in range(4):
   label=f'run{run}-{variant}-{index+1}-to-{index+2}';before=ui();b=bar(before);bounds=box(b);dock=box(wait('Check answer'))
   time.sleep(2);assert_progress(index);answer(index,answers[index]);time.sleep(.5)
   adb('shell','dumpsys','gfxinfo',PACKAGE,'reset')
   tap('Check answer');time.sleep(1.1);wait('Next puzzle');time.sleep(.3)
   (OUT/(label+'-answer-frames.txt')).write_text(adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats'))
   adb('shell','dumpsys','gfxinfo',PACKAGE,'reset')
   tap('Next puzzle');time.sleep(1.4);wait(f'Puzzle {index+2} of 10');time.sleep(.2)
   assert_progress(index+1);assert box(bar(ui()))==bounds;assert box(wait('Check answer'))==dock
   assert wait('Check answer').get('enabled')=='false'
   question=wait('puzzle-question');assert box(question)[1]==321,('New content must reset scroll before painting',box(question))
   from PIL import Image
   shot(label);im=Image.open(OUT/(label+'.png')).convert('RGB');assert sum(r<120 and g<140 and bl<170 for r,g,bl in im.crop(box(question)).getdata())>300
   if index+1 in [2,3]:assert sum(r>190 and 100<g<220 and bl<130 for r,g,bl in im.getdata())>2000,'The clock/shape artwork must actually be painted'
   (OUT/(label+'-entry-frames.txt')).write_text(adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats'))
   cases.append({'scenario':label,'bar_bounds':bounds,'dock_bounds':dock,'question_bounds':box(question),'answer_reset':True})
   log('Passed '+label)
  (OUT/(f'run{run}-'+variant+'-traces.json')).write_text(json.dumps(reports(),indent=2)+'\n');(OUT/(f'run{run}-'+variant+'-cases.json')).write_text(json.dumps(cases,indent=2)+'\n')
 crashes=adb('logcat','-d','-b','crash','-v','brief');(OUT/'native-crashes.log').write_text(crashes);assert PACKAGE not in crashes and 'om.mathmews.app' not in crashes
 log('Native A/B performance and regression checks passed.')
except Exception:
 shot('failure');(OUT/'failure.xml').write_text(d.dump_hierarchy(compressed=True));raise
finally:(OUT/'events.json').write_text(json.dumps(events,indent=2)+'\n')
