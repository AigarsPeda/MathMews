"""Assemble the native gait review renders; requires Pillow. No game assets change."""
from pathlib import Path
import argparse, json
from PIL import Image, ImageDraw
parser=argparse.ArgumentParser()
parser.add_argument('--output',default='/tmp/brainpet-cat-gaits')
args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
source=Path('/tmp/brainpet-gait-review')
gaits=('walk','trot','run');labels=('Relaxed walk','Brisk trot','Playful run')
images={gait:[Image.open(path).convert('RGB') for path in sorted(source.glob(f'runtime-{gait}-*.png'))] for gait in gaits}
assert all(images.values()),'Run render-cat-gaits.py -- --runtime first'
frames=[]
for i in range(max(map(len,images.values()))):
    frame=Image.new('RGB',(864,330),'#fff5e9');draw=ImageDraw.Draw(frame)
    for column,gait in enumerate(gaits):
        frame.paste(images[gait][min(i,len(images[gait])-1)],(column*288,34))
        draw.text((column*288+14,12),labels[column],fill='#293638')
    draw.text((805,12),f'{i/10:.1f}s',fill='#293638')
    frames.append(frame)
frames[0].save(out/'cat-gaits.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True)
sheet=Image.new('RGB',(1152,972),'#fff5e9');draw=ImageDraw.Draw(sheet)
for row,gait in enumerate(gaits):
    for column,i in enumerate((12,18,24,30)):
        sheet.paste(images[gait][min(i,len(images[gait])-1)],(column*288,row*324+30))
        draw.text((column*288+12,row*324+10),f'{labels[row]} / {i/10:.1f}s',fill='#293638')
sheet.save(out/'cat-gaits-contact-sheet.jpg',quality=92)
(out/'index.html').write_text('''<!doctype html><meta charset="utf-8"><title>Cat movement comparison</title>
<style>body{margin:0;background:#fff5e9;color:#293638;font:16px system-ui;padding:36px}main{max-width:1000px;margin:auto}h1{font-size:28px}img{width:100%;border-radius:16px}p{line-height:1.5;color:#536268}</style>
<main><h1>Walk, trot and playful run</h1><p>The same journey, rendered from the game’s actual cat poses. Watch the first steps, changes in pace and the walking approach before each stop.</p><img src="cat-gaits.gif" alt="Side-by-side native cat movement comparison"><p><a href="cat-gaits-contact-sheet.jpg">Inspect individual poses</a></p></main>''')
print(out/'cat-gaits.gif')
