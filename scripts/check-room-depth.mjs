/** Exercise real animated layer styles against a foreground plant and menu. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const shared = initial => { let value=initial; return { get:()=>value, set:next=>{value=next;} }; };
const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useCallback:fn=>fn,useMemo:fn=>fn(),useRef:current=>({current}),useState:initial=>[initial,()=>{}],useEffect:()=>{},useLayoutEffect:fn=>fn()};
const mocks={
  react:React, 'react-i18next':{useTranslation:()=>({t:key=>key})},
  'react-native':{View:'View',StyleSheet:{create:value=>value,absoluteFill:{}},PanResponder:{create:handlers=>({panHandlers:handlers})}},
  'react-native-reanimated':{default:{View:'AnimatedView'},useSharedValue:shared,useAnimatedStyle:read=>({read}),useDerivedValue:read=>({get:read})},
  '@shopify/react-native-skia':{Canvas:'Canvas',Group:'Group',Image:'Image',FilterMode:{Linear:1},MipmapMode:{None:0}},
  '@/utils/scale':{moderateScale:x=>x},
  '@/components/pet/RoomActionMenu':{RoomActionMenu:'RoomActionMenu'},
};
function load(file){
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,React,require:id=>mocks[id]??load(id.replace('@/', '')+'.ts')});
 return module.exports;
}
const depth=load('utils/room-depth.ts');
mocks['@/utils/room-depth']=depth;
mocks['@/utils/room-layer-order']={ROOM_MENU_OPEN_Z_INDEX:600100};
const {DraggableRoomPet}=load('components/pet/DraggableRoomPet.tsx');
const {RoomPlayPropLayer}=load('components/pet/RoomPlayPropLayer.tsx');
const style=value=>Object.assign({},...[value].flat(Infinity).filter(Boolean).map(part=>part.read?part.read():part));
const y=shared(-30),x=shared(0),scale=shared(1),facing=shared(1);
const toy=DraggableRoomPet({petSize:48,depthAnchor:.3,layerZIndex:5,animatedPosition:{x,y}});
const plant=depth.getRoomDepthZIndex(120*.38,1);
assert.ok(style(toy.props.style).zIndex<plant,'A toy behind the plant must be obscured by its pot and leaves');
y.set(70);
assert.ok(style(toy.props.style).zIndex>plant,'A toy rolling toward the viewer must move in front of the plant without a React render');
assert.ok(depth.getRoomDepthZIndex(100,1)>depth.getRoomDepthZIndex(99,127),'Saved layer order must not overpower physical floor depth');
const menu=DraggableRoomPet({petSize:48,depthAnchor:.3,layerZIndex:600100,animatedPosition:{x,y}});
assert.equal(style(menu.props.style).zIndex,600100,'Open item menus must stay above animated room layers');
const sofaSeat=shared(120*.38+.5);
const seatedCat=DraggableRoomPet({petSize:200,depthAnchor:.3,depthY:sofaSeat,layerZIndex:100,animatedPosition:{x,y}});
assert.ok(style(seatedCat.props.style).zIndex>plant,'An elevated seat must keep the cat above its supporting sofa');
for(const id of ['carpetTile','portraitCat','livingAirCon','windowJapaneseL'])assert.equal(depth.isRoomBackgroundDecoration(id),true,id);
for(const id of ['plantB','sofaA','livingTable','yarnBlue'])assert.equal(depth.isRoomBackgroundDecoration(id),false,id);
const frame=shared({image:{id:'yarn'},col:2,row:1,groundY:.7});
y.set(-30);
const prop=RoomPlayPropLayer({frame,x,y,scale,facing,size:200,width:400,height:400});
assert.ok(style(prop.props.style).zIndex<plant,'The independently drawn yarn must pass behind the plant');
frame.set({...frame.get(),groundY:.95});
assert.ok(style(prop.props.style).zIndex>plant,'Projected toy contact must control its own depth');
frame.set({...frame.get(),image:null});
assert.equal(style(prop.props.style).opacity,0,'An inactive prop must not leave a phantom toy in the room');
console.log('Verified floor depth during movement, independent play props, background walls/rugs, stable ties and menu priority.');
