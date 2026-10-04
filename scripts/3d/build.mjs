/** Rebuild the original 3D art, atlases and app branding. */
import { spawnSync } from 'node:child_process';
const blender=process.env.BLENDER_BIN||(process.platform==='darwin'?'/Applications/Blender.app/Contents/MacOS/Blender':'blender');
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);}
run(blender,['--background','--python-exit-code','1','--python','scripts/3d/render_assets.py','--',...process.argv.slice(2)]);
run(blender,['--background','--python-exit-code','1','--python','scripts/3d/render_assets.py','--','--only','branding']);
run(process.execPath,['scripts/3d/pack.mjs']);
run(process.execPath,['scripts/3d/measure-room-depth.mjs']);
run(process.execPath,['scripts/generate-branding.mjs']);
run(process.execPath,['scripts/3d/verify.mjs']);
