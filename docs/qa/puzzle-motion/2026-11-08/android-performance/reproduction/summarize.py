import pathlib,json,re,sys,math
p=pathlib.Path(sys.argv[1]); result={}
for variant in ['before','after']:
 rows=[r for f in p.glob(f'run*-{variant}-traces.json') for r in json.loads(f.read_text()) if r['label'].startswith(variant+'-entry-')]
 # One initial entry per run is setup, not a puzzle transition.
 rows=[r for r in rows if not r['label'].endswith('-step-1')]
 frames=[t for r in rows for t in r['frames']]
 bars=[r for r in json.loads((p/'bar-traces.json').read_text()) if r['label'].startswith(variant+'-bar-')]
 bf=[t for r in bars for t in r['frames']]
 def gfx(pattern):
  pairs=[]
  for f in p.glob(pattern):
   s=f.read_text();a=re.search(r'Total frames rendered: (\d+)',s);b=re.search(r'Janky frames: (\d+)',s)
   if a and b:pairs.append((int(a[1]),int(b[1])))
  n=sum(a for a,b in pairs);j=sum(b for a,b in pairs)
  return dict(frames=n,janky_frames=j,janky_percent=j/n*100 if n else 0)
 result[variant]=dict(entry_samples=len(rows),entry_frame_intervals=len(frames),entry_worst_gap_ms=max(frames,default=0),entry_gaps_over_50ms=sum(t>50.1 for t in frames),entry_interval_p95_ms=sorted(frames)[min(len(frames)-1,int(len(frames)*.95))] if frames else 0,bar_intervals=len(bf),bar_worst_gap_ms=max(bf,default=0),bar_intervals_over_25ms=sum(t>25 for t in bf),bar_gfx=gfx(f'bar-*-{variant}-frames.txt'),entry_gfx=gfx(f'run*-{variant}-*-entry-frames.txt'),answer_gfx=gfx(f'run*-{variant}-*-answer-frames.txt'))
print(json.dumps(result,indent=2))
