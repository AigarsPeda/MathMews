"""Build the three approved sets as genuine editable Blender scenes and RGBA renders."""
import argparse
import importlib
import json
import sys
from pathlib import Path
import bpy

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE/'trail_collections'))
from common import ROOT, normalize_and_studio

parser=argparse.ArgumentParser()
parser.add_argument('--collection',choices=['easy','medium','hard'],required=True)
parser.add_argument('--only',type=int,nargs='*')
parser.add_argument('--samples',type=int,default=48)
parser.add_argument('--resume',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
module=importlib.import_module(args.collection)
prefix={'easy':'e','medium':'m','hard':'h'}[args.collection]
dest=ROOT/'prototypes/trail-collections'/args.collection
(dest/'renders').mkdir(parents=True,exist_ok=True)
for index,builder in enumerate(module.BUILDERS,1):
    if args.only and index not in args.only:continue
    asset=f'{prefix}{index:02}'
    render=dest/'renders'/f'{asset}.png'
    if args.resume and render.exists():continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    builder()
    normalize_and_studio(render,args.samples)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(dest/f'{asset}.blend'),compress=True)
    bpy.ops.render.render(write_still=True)
    (dest/f'{asset}.json').write_text(json.dumps({'id':asset,'collection':args.collection,'builder':builder.__name__,'meshObjects':sum(o.type=='MESH' for o in bpy.context.scene.objects),'samples':args.samples,'renderSize':640},indent=2)+'\n')
    print('TRAIL_COLLECTION_DONE',asset,builder.__name__,flush=True)
