import json, gzip
from pathlib import Path
out=Path('docs/qa/home-store-profiling/2026-10-24/game-updates')
def frames(f):
 s=sorted(f)
 return dict(count=len(s),p95Ms=s[int((len(s)-1)*.95)],maxMs=max(s),over100Ms=sum(v>100 for v in s))
summary={'note':'Development simulator; inclusive parent/child durations overlap. Care commits exclude navigation/activity/layout changes; aggregate trace timings are not a controlled comparison.'}
for side in ['before','after']:
 d=json.loads(gzip.decompress((out/(side+'-react.json.gz')).read_bytes())); care=[]; allhome=[]
 for p in d['profiles']:
  name=lambda i:d['names'].get(str(p['rendererID'])+':'+str(i),'?')
  for root in p['dataForRoots']:
   for idx,c in enumerate(root['commitData']):
    durations=c['fiberActualDurations']; homes=[ms for i,ms in durations if name(i)=='Forget(HomeContent)']
    if not homes: continue
    changes=dict(c['changeDescriptions'] or []); stageids=[i for i,ms in durations if name(i)=='Forget(PetStage)']
    props=set(k for i in stageids for k in (changes.get(i,{}).get('props') or []))
    row=dict(commitIndex=idx,timestampMs=c['timestamp'],homeInclusiveMs=homes[0],stageProps=sorted(props))
    allhome.append(row)
    if 'stats' not in props or props.intersection({'roomEntry','catHomeRoomId','roomCommand','roomVisible','lastInteractionAt','sceneSlide','placedDecorations'}): continue
    components={}
    for i,ms in durations:
     n=name(i) or '?'
     if any(k in n for k in ['PetStage','NativeRoomScene','DraggableRoomPet','RoomActionMenu','PetStatsPanel','NativeRoomSurface']):
      a=components.setdefault(n,{'renders':0,'inclusiveMs':0});a['renders']+=1;a['inclusiveMs']+=ms
    care.append({**row,'components':components})
 cpu=json.loads(gzip.decompress((out/(side+'.cpuprofile.gz')).read_bytes()))
 summary[side]=dict(durationMs=d['duration'],careCommits=care,allHomeCommits=allhome,frameIntervals=frames(d['frames']),cpuWindow=dict(startTime=cpu['startTime'],endTime=cpu['endTime'],durationMs=(cpu['endTime']-cpu['startTime'])/1000,samples=len(cpu['samples'])))
idle=json.loads((out/'after-idle-frames.json').read_text());assert idle['done'];summary['afterIdle']=dict(durationMs=idle['duration'],**frames(idle['frames']))
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
