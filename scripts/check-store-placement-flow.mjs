/** Exercise shop actions without changing the user's save or spending coins. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = process.cwd(), cache = new Map();
let states = [], index = 0, game, events = [], purchaseResult = 'purchased', focusEffect;
const jsx = (type, props) => ({ type, props });
const react = {
  useMemo: fn => fn(), useCallback: fn => fn, useEffect() {},
  useState: initial => { const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
  useRef: current => { const i = index++; return states[i] ??= { current }; },
};
function load(id) {
  if (id === 'react') return react;
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (id === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
  if (id === 'react-native') return { Platform: { OS:'web' }, View:'View', Text:'Text', Pressable:'Pressable', FlatList:'FlatList', ScrollView:'ScrollView', StyleSheet:{ create:s=>s }, useWindowDimensions:()=>({height:800}) };
  if (id === 'react-native-safe-area-context') return { SafeAreaView:'SafeAreaView', useSafeAreaInsets:()=>({top:0,bottom:0}) };
  if (id === 'expo-router') return { useFocusEffect: fn => { focusEffect=fn; }, useRouter:()=>({ dismissTo:route=>events.push(['route', route]) }) };
  if (id === 'expo-haptics') return {};
  if (id === '@/contexts/GameProvider') return { useGame:()=>game };
  if (id === '@/utils/scale') return { moderateScale:n=>n };
  if (id.startsWith('@/components/')) { const name=path.basename(id); return { [name]:name, IconText:'Text' }; }
  if (/\.(png|webp|mp4)$/.test(id)) return id;
  const file = id.startsWith('@/') ? path.join(root,id.slice(2)) : path.resolve(root,id);
  const resolved = fs.existsSync(file) ? file : ['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved,'utf8'));
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module={exports:{}}; cache.set(resolved,module);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {module,exports:module.exports,require:load,setTimeout:()=>1,clearTimeout(){},Date,Math,Map,Set});
  return module.exports;
}
const StoreScreen = load('app/store.tsx').default;
const { roomDecorationEntry } = load('@/utils/room-decoration-entry');
function flatten(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node,...flatten(node.props?.children)]; }
function render() { index=0; return flatten(StoreScreen()); }
function setup() {
  states=[]; events=[]; purchaseResult='purchased';
  game={ isReady:true,hasCompletedOnboarding:true,pet:{homeRoomId:'kitchen',placedDecorations:[{decorationId:'kitchenModernFloorShelfNavy',instanceId:'old-copy'}]},wallet:{coins:1000},progress:{roomsUnlocked:[],bedsUnlocked:[],toysUnlocked:[],decorationsUnlocked:[],skinsUnlocked:[]},recordInteraction() {},
    requestRoomDecoration:target=>events.push(['entry',roomDecorationEntry(game.pet,target)]) };
  for(const [kind,verb] of [['decoration','place'],['toy','place'],['bed','equip']]) {
    const name=kind[0].toUpperCase()+kind.slice(1);
    const commit=id=>{ if(kind==='bed') game.pet.bedId=id;
      else { const key=kind==='toy'?'placedToys':'placedDecorations'; game.pet[key]=[...(game.pet[key]??[]),{[`${kind}Id`]:id,instanceId:'new-copy'}]; } };
    game[`purchase${name}`]=async id=>{events.push(['buy',kind]);if(purchaseResult==='purchased')commit(id);return purchaseResult;};
    game[`${verb}${name}${kind==='bed'?'':'InRoom'}`]=id=>{commit(id);return true;};
  }
}
function card(tab,id) { const nodes=render();nodes.find(n=>n.type==='StoreTabBar').props.onChange(tab);return render().find(n=>n.type==='FlatList').props.renderItem({item:id}); }
for(const [kind,tab,id] of [['decoration','kitchen','kitchenModernFloorShelfNavy'],['toy','toys','orangeBall'],['bed','beds','brown']]) {
  setup();const item=card(tab,id);await item.props.onBuy();
  assert.equal(events[0][0],'buy');assert.equal(events[1][1].item.kind,kind);
  assert.equal(events[1][1].roomId,'kitchen');
  if(kind!=='bed')assert.equal(events[1][1].item.instanceId,'new-copy','Selection reads the committed purchase, not stale render props');
  assert.deepEqual(events[2],['route','/']);
  await item.props.onBuy();assert.equal(events.length,3,'A repeated tap during navigation cannot buy a second copy');
  setup();const previewCard=card(tab,id);previewCard.props.onPreview();
  await render().find(n=>n.type==='StorePreviewSheet').props.item.onBuy();
  assert.deepEqual(events.at(-1),['route','/'],'Preview purchases use the same handoff');
  setup();purchaseResult='insufficient_funds';await card(tab,id).props.onBuy();
  assert.equal(events.length,1,'Failed purchases remain in the shop');
  setup();const owned=card(tab,id);owned.props[kind==='bed'?'onEquip':'onPlace']();
  assert.equal(events[0][1].item.kind,kind,'Placing owned items enters the editor too');
  assert.deepEqual(events[1],['route','/']);
}
setup();const nodes=render();assert.equal(nodes.find(n=>n.type==='StoreTabBar').props.active,'kitchen','The shop starts in the current room category');
nodes.find(n=>n.type==='Pressable' && flatten(n).some(child=>child.props?.children==='store.decorateRoom')).props.onPress();
assert.equal(events[0][1].item,undefined,'The decoration shortcut opens the editor without buying or selecting an unrelated item');
assert.deepEqual(events[1],['route','/']);
console.log('Verified buy/place/preview handoffs, purchase failures, repeat-tap protection and current-room browsing.');

setup();let shop=render();
assert.equal(shop.some(n=>n.type==='AppBottomSheet'),false,'Closed categories do not mount a hidden native sheet');
assert.equal(shop.find(n=>n.type==='FlatList').props.initialNumToRender,2,'First mount draws only two visible rows, four cards');
shop.find(n=>n.type==='Pressable' && flatten(n).some(child=>child.props?.children==='store.tabKitchen')).props.onPress();
shop=render();assert.equal(shop.find(n=>n.type==='AppBottomSheet').props.visible,true,'Categories remain accessible on demand');
shop.find(n=>n.type==='AppBottomSheet').props.onClose();
assert.equal(render().find(n=>n.type==='AppBottomSheet').props.visible,false,'Native sheet remains mounted for its dismissal animation');
setup();render();game.pet={...game.pet,homeRoomId:'bedroom'};render();focusEffect();
assert.equal(render().find(n=>n.type==='StoreTabBar').props.active,'bedroom','A prefetched shop opens in the current room category');
console.log('Verified bounded first card mount, lazy categories with native dismissal, and fresh category selection after prefetch.');
