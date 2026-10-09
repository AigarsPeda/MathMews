"""Normalize animation clocks and share duplicate binary data in exported GLBs."""
import json, struct
from pathlib import Path

def compact_buffer_views(path):
 """Share identical binary data without changing accessor or buffer-view indices."""
 data=Path(path).read_bytes();json_size=struct.unpack_from('<I',data,12)[0]
 document=json.loads(data[20:20+json_size]);binary_header=20+json_size
 assert len(document['buffers'])==1 and 'uri' not in document['buffers'][0]
 binary_size=struct.unpack_from('<I',data,binary_header)[0]
 source=data[binary_header+8:binary_header+8+binary_size]
 binary=bytearray();offsets={}
 for view in document.get('bufferViews',[]):
  assert view['buffer']==0
  start=view.get('byteOffset',0);chunk=source[start:start+view['byteLength']]
  assert len(chunk)==view['byteLength']
  if chunk not in offsets:
   offsets[chunk]=len(binary)
   binary.extend(chunk);binary.extend(b'\0'*((-len(binary))%4))
  # Keep each view's stride, target and references; only its storage moves.
  view['byteOffset']=offsets[chunk]
 document['buffers'][0]['byteLength']=len(binary)
 encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 body=struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
 Path(path).write_bytes(struct.pack('<III',0x46546c67,2,12+len(body))+body)

def normalize_animation_times(path):
 data=Path(path).read_bytes();json_size=struct.unpack_from('<I',data,12)[0]
 document=json.loads(data[20:20+json_size]);binary_header=20+json_size
 if not document.get('animations'):return
 binary_size=struct.unpack_from('<I',data,binary_header)[0]
 binary=bytearray(data[binary_header+8:binary_header+8+binary_size]);processed=set()
 # Filament derives a normal transform for every skin slot, even when its
 # weight is zero. Padding must not reference a prop hidden with zero scale.
 for mesh in document.get('meshes', []):
  for primitive in mesh['primitives']:
   attributes=primitive['attributes']
   if 'JOINTS_0' not in attributes:continue
   joints=document['accessors'][attributes['JOINTS_0']];jview=document['bufferViews'][joints['bufferView']]
   weights=document['accessors'][attributes['WEIGHTS_0']];wview=document['bufferViews'][weights['bufferView']]
   assert weights['componentType']==5126
   fmt={5121:'B',5123:'H'}[joints['componentType']];size=struct.calcsize(fmt)
   for i in range(joints['count']):
    jo=jview.get('byteOffset',0)+joints.get('byteOffset',0)+i*jview.get('byteStride',size*4)
    wo=wview.get('byteOffset',0)+weights.get('byteOffset',0)+i*wview.get('byteStride',16)
    row=list(struct.unpack_from('<'+fmt*4,binary,jo));influences=struct.unpack_from('<ffff',binary,wo)
    stable=row[influences.index(max(influences))]
    row=[stable if weight==0 else joint for joint,weight in zip(row,influences)]
    struct.pack_into('<'+fmt*4,binary,jo,*row)
 indices={sampler['input'] for animation in document['animations'] for sampler in animation['samplers']}
 for index in indices:
  accessor=document['accessors'][index];view=document['bufferViews'][accessor['bufferView']]
  assert accessor['componentType']==5126 and accessor['type']=='SCALAR'
  offset=view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',4)
  start=accessor['min'][0]
  if start==0:continue
  key=(offset,accessor['count'],stride)
  if key not in processed:
   for i in range(accessor['count']):
    t=struct.unpack_from('<f',binary,offset+i*stride)[0]
    struct.pack_into('<f',binary,offset+i*stride,max(0,t-start))
   processed.add(key)
  accessor['min']=[0];accessor['max']=[accessor['max'][0]-start]
 encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 body=struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
 Path(path).write_bytes(struct.pack('<III',0x46546c67,2,12+len(body))+body)

if __name__=='__main__':
 import sys
 for path in Path(sys.argv[1]).glob('*.glb'):
  normalize_animation_times(path)
  compact_buffer_views(path)
