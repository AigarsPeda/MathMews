import pathlib,sys,json
p=pathlib.Path(sys.argv[1]);out=[]
for f in sorted(p.glob('*-entry-frames.txt')):
 s=f.read_text();headers=next((l.split(',') for l in s.splitlines() if l.startswith('Flags,')),None)
 if not headers:continue
 rows=[dict(zip(headers,map(int,l.strip(',').split(',')))) for l in s.splitlines() if l.startswith('0,')]
 if not rows:continue
 r=max(rows,key=lambda r:r['FrameCompleted']-r['IntendedVsync'])
 out.append({'scenario':f.name,'slowest_frame_ms':(r['FrameCompleted']-r['IntendedVsync'])/1e6,'main_to_sync_ms':(r['SyncQueued']-r['IntendedVsync'])/1e6,'layout_to_draw_ms':(r['DrawStart']-r['PerformTraversalsStart'])/1e6,'issue_to_swap_ms':(r['SwapBuffers']-r['IssueDrawCommandsStart'])/1e6})
print(json.dumps(out,indent=2))
