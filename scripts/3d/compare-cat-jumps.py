"""Assemble rendered sofa jump comparisons. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--output',default='/tmp/brainpet-cat-jumps');args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True);source=Path('/tmp/brainpet-jump-review')
frames=[]
for action,label in [('jumpOn','Jump onto sofa'),('sit','Settle and turn on the cushion'),('jumpOff','Jump down')]:
    sets={v:[Image.open(p).convert('RGB') for p in sorted(source.glob(f'{v}-{action}-*.png'))] for v in ['before','after']}
    for i in range(max(map(len,sets.values()))):
        im=Image.new('RGB',(576,342),'#fff5e9');d=ImageDraw.Draw(im)
        for j,v in enumerate(sets):
            im.paste(sets[v][min(i,len(sets[v])-1)],(j*288,36));d.text((j*288+12,10),f'{v.title()} / {label}',fill='#293638')
        frames.append(im)
frames[0].save(out/'sofa-jumps.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True)
sheet=Image.new('RGB',(1152,1296),'#fff5e9');d=ImageDraw.Draw(sheet)
for row,(version,action) in enumerate([('before','jumpOn'),('after','jumpOn'),('before','jumpOff'),('after','jumpOff')]):
    for col,index in enumerate([2,5,7,9] if action=='jumpOn' else [10,13,16,19]):
        sheet.paste(Image.open(source/f'{version}-{action}-{index:02d}.png'),(col*288,row*324+30));d.text((col*288+12,row*324+10),f'{version.title()} {action} / {index/10:.1f}s',fill='#293638')
sheet.save(out/'sofa-jumps-contact-sheet.jpg',quality=94)
print(out/'sofa-jumps.gif')
