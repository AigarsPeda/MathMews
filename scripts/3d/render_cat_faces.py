"""Preview the live Blender facial rig before rebuilding the gameplay clips."""
import os
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/art/cat-faces'
OUT.mkdir(parents=True,exist_ok=True)
os.environ['BRAINPET_BLENDER_ASSET_DIR']=str(OUT/'source')
sys.path.insert(0,str(Path(__file__).parent))
import render_assets as art
import bpy

poses=[('content','idle',0),('happy','correct',.5),('petted','excited',.5),
       ('curious','waiting',.5),('surprised','surprised',.5),('disappointed','incorrect',.4),
       ('sleepy','sleep',.5),('eating','eating',.5)]
for name,state,t in poses:
    scene=bpy.data.scenes.new('Cat face '+name)
    scene.world=bpy.data.worlds.new('Face lighting '+name)
    bpy.context.window.scene=scene
    art.setup(768)
    rig=art.cat('orange')
    art.configure_cat_camera(scene)
    if state=='eating': art.bowl()
    art.cat_pose(rig,state,t)
    art.key_cat_geometry(rig,1)
    for obj in art.animated_parts(rig):
        for prop in ('location','rotation_euler','scale'): obj.keyframe_insert(data_path=prop,frame=1)
    art.render(OUT/(name+'.png'))
    print('FACE_DONE',name,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/facial-expressions.blend'),compress=True)
