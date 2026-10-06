/** Measure each shipped object's floor contact within its padded sprite frame. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
const entries=JSON.parse(await fs.readFile('scripts/3d/inventory.json','utf8')).entries;
const anchors={};
for(const entry of entries){
 if(entry.kind==='room')continue;
 const animated=entry.animated||['toy-orangeBall','toy-blueBall','toy-pinkBall','toy-mouse'].includes(entry.id);
 const file=animated?`assets/3d/atlases/${entry.id}.png`:`assets/3d/${entry.kind}/${entry.thumbnailId??entry.id}.png`;
 let image=sharp(file);
 if(animated)image=image.extract({left:0,top:0,width:192,height:192});
 const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let bottom=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32)bottom=Math.max(bottom,y);
 if(bottom<0)throw new Error(`Empty object sprite: ${entry.id}`);
 anchors[entry.id]=Math.round(((bottom+.5)/info.height-.5)*10000)/10000;
}
await fs.writeFile('constants/room-depth-anchors.ts',`/** Ground contacts measured from padded Blender renders. Generated. */\nexport const ROOM_DEPTH_ANCHORS: Record<string, number> = ${JSON.stringify(anchors,null,2)};\n`);
console.log(`Measured floor contacts for ${Object.keys(anchors).length} room objects.`);
