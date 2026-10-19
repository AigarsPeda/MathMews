"""Assemble rendered sofa jump comparisons. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--output',default='/tmp/brainpet-cat-jumps');parser.add_argument('--landing-walk',action='store_true');args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True);source=Path('/tmp/brainpet-landing-walk-review' if args.landing_walk else '/tmp/brainpet-jump-review')
frames=[]
actions=[('landingWalk','Landing into the next task')] if args.landing_walk else [('jumpOn','Jump onto sofa'),('sit','Settle and turn on the cushion'),('jumpOff','Jump down')]
for action,label in actions:
    sets={v:[Image.open(p).convert('RGB') for p in sorted(source.glob(f'{v}-{action}-*.png'))] for v in ['before','after']}
    width,height=sets['before'][0].size
    for i in range(max(map(len,sets.values()))):
        im=Image.new('RGB',(width*2,height+54),'#fff5e9');d=ImageDraw.Draw(im)
        for j,v in enumerate(sets):
            im.paste(sets[v][min(i,len(sets[v])-1)],(j*width,36));d.text((j*width+12,10),f'{v.title()} / {label}',fill='#293638')
        frames.append(im)
name='landing-walk' if args.landing_walk else 'sofa-jumps'
frames[0].save(out/(name+'.gif'),save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True)
rows=[('before','landingWalk'),('after','landingWalk')] if args.landing_walk else [('before','jumpOn'),('after','jumpOn'),('before','jumpOff'),('after','jumpOff')]
sheet=Image.new('RGB',(width*4,(height+36)*len(rows)),'#fff5e9');d=ImageDraw.Draw(sheet)
for row,(version,action) in enumerate(rows):
    for col,index in enumerate([7,9,11,14] if action=='landingWalk' else [1,3,4,5] if action=='jumpOn' else [12,14,15,16]):
        sheet.paste(Image.open(source/f'{version}-{action}-{index:02d}.png'),(col*width,row*(height+36)+30));d.text((col*width+12,row*(height+36)+10),f'{version.title()} {action} / {index/10:.1f}s',fill='#293638')
sheet.save(out/(name+'-contact-sheet.jpg'),quality=94)
print(out/(name+'.gif'))
