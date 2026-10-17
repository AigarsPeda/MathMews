import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness() {
  const cache = new Map();
  let response, requests = 0;
  function load(id) {
    if (id === '@/lib/supabase') return { supabase: { rpc: async name => {
      assert.equal(name,'get_store_catalog'); requests++;
      return response;
    } } };
    const file = path.resolve(id.replace('@/',''));
    const resolved = fs.existsSync(file) ? file : file + '.ts';
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} }; cache.set(resolved,module);
    if (resolved.endsWith('.json')) module.exports = JSON.parse(fs.readFileSync(resolved,'utf8'));
    else {
      const code = ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
      vm.runInNewContext(code,{module,exports:module.exports,require:load,Date,Map,Set,Promise});
    }
    return module.exports;
  }
  return { api:load('@/utils/store-catalog'), service:load('@/services/store-catalog'), load,
    reply(value) { response = value; }, get requests() { return requests; } };
}
const at = Date.parse('2026-10-17T12:00:00Z');
const item = (overrides = {}) => ({kind:'room',item_id:'room16',base_price:52,sale_price:null,sale_starts_at:null,sale_ends_at:null,sale_label:null,...overrides});
const snapshot = (...items) => ({server_time:new Date(at).toISOString(),items});

test('server prices replace bundled amounts for every kind and saved goals', () => {
  const h = harness();
  h.api.acceptStoreCatalog(snapshot(...['room','bed','toy','decoration','skin','life'].map((kind,i) => item({kind,item_id:kind==='room'?'room16':kind==='life'?'one':'fixture',base_price:80+i}))),at);
  assert.equal(h.api.getStoreCoinPrice('room','room16',at),80);
  assert.equal(h.api.getStoreCoinPrice('life','one',at),85);
  for (const kind of ['bed','toy','decoration','skin']) assert.ok(h.api.getStoreCoinPrice(kind,'fixture',at)>=81);
  const goal=h.load('@/utils/store-goal').getStoreGoalDetails({kind:'room',id:'room16'},60,key=>key);
  assert.equal(goal.amount,80); assert.equal(goal.remaining,20);
});

test('timed sale starts inclusively, expires exclusively and respects server time over phone clock', () => {
  const h=harness(), phone=at+86400000;
  h.api.acceptStoreCatalog(snapshot(item({sale_price:26,sale_starts_at:new Date(at+1000).toISOString(),sale_ends_at:new Date(at+5000).toISOString(),sale_label:'Weekend'})),phone);
  assert.equal(h.api.getStoreCoinPrice('room','room16',phone),52);
  assert.equal(h.api.nextStoreCatalogTransition(phone),phone+1000);
  assert.equal(h.api.getStoreCoinPrice('room','room16',phone+1000),26);
  assert.equal(h.api.getStoreCoinPrice('room','room16',phone+4999),26);
  assert.equal(h.api.getStoreCoinPrice('room','room16',phone+5000),52);
});

test('active promotions expose original price, allow zero coins and return to normal', () => {
  const h=harness();
  h.api.acceptStoreCatalog({server_time:new Date().toISOString(),items:[item({sale_price:0})]});
  const free=h.api.getCatalogStorePrice('room','room16');
  assert.equal(free.kind,'free'); assert.equal(free.originalAmount,52);
  h.api.acceptStoreCatalog({server_time:new Date().toISOString(),items:[item({base_price:70})]});
  const normal=h.api.getCatalogStorePrice('room','room16');
  assert.equal(normal.amount,70); assert.equal(normal.originalAmount,undefined);
});

test('malformed and duplicate responses retain the last usable catalog', () => {
  const h=harness(); h.api.acceptStoreCatalog(snapshot(item({base_price:61})),at);
  for (const items of [[item({sale_price:-1})],[item({sale_price:60})],[item({base_price:NaN})],
    [item({sale_starts_at:'tomorrow'})],[item(),item()]]) assert.throws(()=>h.api.acceptStoreCatalog(snapshot(...items),at));
  assert.equal(h.api.getStoreCoinPrice('room','room16',at),61);
});

test('network failure preserves prices and concurrent readers share one request', async () => {
  const h=harness(); h.reply({data:{server_time:new Date().toISOString(),items:[item({base_price:63})]}});
  const first=h.service.refreshStoreCatalog(), second=h.service.refreshStoreCatalog();
  assert.equal(first,second); assert.equal(await first,true); assert.equal(h.requests,1);
  h.reply({error:{message:'Offline'}}); assert.equal(await h.service.refreshStoreCatalog(),false);
  assert.equal(h.api.getStoreCoinPrice('room','room16'),63);
});

test('discount percentages reflect the actual coin saving without rounding up', () => {
  const h=harness(),{getStorePromotion}=h.load('@/utils/store-promotion');
  assert.equal(getStorePromotion({kind:'coins',amount:42,originalAmount:56}).percent,25);
  assert.equal(getStorePromotion({kind:'coins',amount:2,originalAmount:3}).percent,33);
  assert.equal(getStorePromotion({kind:'free',originalAmount:56}).percent,100);
  assert.equal(getStorePromotion({kind:'coins',amount:999,originalAmount:1000}).percent,0,'Sub-percent discounts need a <1% label');
  for(const price of [{kind:'coins',amount:56},{kind:'coins',amount:56,originalAmount:56},{kind:'coins',amount:60,originalAmount:56},{kind:'free',originalAmount:0},{kind:'iap',productId:'pack'}]) assert.equal(getStorePromotion(price),null);
});

test('sale countdowns share the pricing clock and hide at expiry even with stale price props', () => {
  const h=harness(),phone=at+86400000,{getStorePromotion}=h.load('@/utils/store-promotion');
  h.api.acceptStoreCatalog(snapshot(item({sale_price:39,sale_ends_at:new Date(at+3600000).toISOString()})),phone);
  const price=h.api.getCatalogStorePrice('room','room16',phone);
  assert.equal(getStorePromotion(price,phone).remainingMs,3600000);
  assert.equal(getStorePromotion(price,phone+3599000).remainingMs,1000);
  assert.equal(getStorePromotion(price,phone+3600000),null);
  assert.equal(getStorePromotion({kind:'coins',amount:39,originalAmount:52},phone).remainingMs,undefined);
});

test('countdowns cover days, hours, minutes and the last fractional second', () => {
  const {getSaleCountdown}=harness().load('@/utils/store-promotion');
  const cases=[[7*86400000,{key:'days',days:7,hours:0}],[26*3600000,{key:'days',days:1,hours:2}],
    [3661000,{key:'hours',hours:1,minutes:1}],[61000,{key:'minutes',minutes:1,seconds:1}],[999,{key:'seconds',seconds:1}]];
  for(const [ms,expected] of cases) assert.deepEqual(JSON.parse(JSON.stringify(getSaleCountdown(ms))),expected);
});

test('promotion UI renders localized badges, labels and live countdowns without repeated screen-reader announcements',async()=>{
  const {createInstance}=await import('i18next');
  const h=harness(),base=Date.now();
  const resources=Object.fromEntries(['en','lv'].map(lang=>[lang,{translation:JSON.parse(fs.readFileSync(`locales/${lang}.json`,'utf8'))}]));
  for(const language of ['en','lv']){
    const i18n=createInstance();await i18n.init({lng:language,resources});
    let now=base;
    const module={exports:{}};
    const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/store/StorePromotion.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
      {module,exports:module.exports,Date,require:id=>{
        if(id==='react')return {useMemo:fn=>fn()};
        if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
        if(id==='react-native')return {View:'View',StyleSheet:{create:value=>value}};
        if(id==='react-i18next')return {useTranslation:()=>({t:i18n.t.bind(i18n),i18n})};
        if(id==='@/components/ui/IconText')return {IconText:'Text'};
        if(id==='@/hooks/use-world-clock-now')return {useWorldClockNow:()=>now};
        if(id==='@/utils/scale')return {moderateScale:n=>n};
        if(id==='@/constants/game')return {GameColors:{card:'#fff'}};
        return h.load(id);
      }});
    const price={kind:'coins',amount:42,originalAmount:56,promotion:'Autumn sale',promotionEndsAt:new Date(base+65000).toISOString()};
    const flatten=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(flatten):[node,...flatten(node.props?.children)];
    const text=node=>flatten(node).filter(n=>n.type==='Text').map(n=>n.props.children).join(' ');
    const render=()=>module.exports.StorePromotion({price});
    const first=render(),timer=flatten(first).find(n=>n.props.accessibilityRole==='timer');
    assert.ok(text(first).includes(i18n.t('store.discountPercent',{percent:25})));
    assert.ok(text(first).includes('Autumn sale'));
    assert.ok(text(first).includes(i18n.t('store.wasPrice',{cost:56})));
    assert.ok(text(first).includes(i18n.t('store.saleCountdown.minutes',{minutes:1,seconds:5})));
    assert.equal(timer.props.accessibilityLiveRegion,'none');assert.ok(timer.props.accessibilityLabel.includes(String(new Date(base).getFullYear())));
    now+=1000;assert.ok(text(render()).includes(i18n.t('store.saleCountdown.minutes',{minutes:1,seconds:4})));
    now=base+65000;assert.equal(render(),null);
    const permanent=module.exports.StorePromotion({price:{kind:'free',originalAmount:56}});
    assert.ok(text(permanent).includes(i18n.t('store.discountPercent',{percent:100})));
    assert.ok(text(permanent).includes(i18n.t('store.sale')));
    assert.ok(!flatten(permanent).some(n=>n.props.accessibilityRole==='timer'));
    const tiny=module.exports.StorePromotion({price:{kind:'coins',amount:999,originalAmount:1000}});
    assert.ok(text(tiny).includes(i18n.t('store.discountUnderOne')));
  }
});

test('store-wide discovery advertises only active, supported discounts and separates campaign deadlines',()=>{
  const h=harness(),phone=at+86400000;
  h.api.acceptStoreCatalog(snapshot(
    item({sale_price:39,sale_label:'Autumn',sale_ends_at:new Date(at+10000).toISOString()}),
    item({item_id:'room17',sale_price:26,sale_label:'Autumn',sale_ends_at:new Date(at+10000).toISOString()}),
    item({item_id:'room18',sale_price:39,sale_label:'Autumn',sale_ends_at:new Date(at+20000).toISOString()}),
    item({item_id:'room19',sale_price:26,sale_starts_at:new Date(at+1000).toISOString()}),
    item({item_id:'room20',sale_price:26,sale_ends_at:new Date(at).toISOString()}),
    item({item_id:'room999',sale_price:0}),item({kind:'life',item_id:'one',sale_price:0}),
    item({item_id:'room21',sale_price:52})
  ),phone);
  const sales=h.api.getActiveStoreSales(phone);
  assert.equal(sales.length,2);
  assert.deepEqual(Array.from(sales[0].itemIds),['room16','room17']);
  assert.equal(sales[0].minPercent,25);assert.equal(sales[0].maxPercent,50);
  assert.equal(sales[0].endsAt,new Date(at+10000).toISOString());
  assert.deepEqual(Array.from(sales[1].itemIds),['room18']);
  assert.ok(h.api.getActiveStoreSales(phone+1000).some(sale=>sale.itemIds.includes('room19')));
  assert.ok(!h.api.getActiveStoreSales(phone+10000).some(sale=>sale.itemIds.includes('room16')));
  assert.ok(h.api.getActiveStoreSales(phone+10000).some(sale=>sale.itemIds.includes('room18')));
});

test('sale discovery UI is visible from other categories, routes on tap, and labels only discounted tabs',async()=>{
  const {createInstance}=await import('i18next'),h=harness(),base=Date.now();
  const resources=Object.fromEntries(['en','lv'].map(lang=>[lang,{translation:JSON.parse(fs.readFileSync(`locales/${lang}.json`,'utf8'))}]));
  for(const lng of ['en','lv']){
    const i18n=createInstance();await i18n.init({lng,resources});let now=base,opened;
    const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
    const ui=file=>{const module={exports:{}};
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
        {module,exports:module.exports,Date,require:id=>{
          if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
          if(id==='react-native')return {View:'View',Text:'Text',ScrollView:'ScrollView',Pressable:'Pressable',StyleSheet:{create:s=>s}};
          if(id==='react-i18next')return {useTranslation:()=>({t:i18n.t.bind(i18n),i18n})};
          if(id==='@/components/ui/AppIcon')return {AppIcon:'AppIcon'};
          if(id==='@/hooks/use-world-clock-now')return {useWorldClockNow:()=>now};
          if(id==='@/utils/scale')return {moderateScale:n=>n};
          if(id==='@/constants/game')return {GameColors:{}};
          return h.load(id);
        }});return module.exports;};
    const {StoreSaleBanner}=ui('components/store/StoreSaleBanner.tsx'),{StoreTabBar}=ui('components/store/StoreTabBar.tsx');
    const flatten=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(flatten):[n,...flatten(n.props?.children)];
    const text=n=>flatten(n).filter(node=>node.type==='Text').map(node=>node.props.children).join(' ');
    const sale={kind:'room',itemIds:['room2'],minPercent:25,maxPercent:25,label:'Autumn sale',endsAt:new Date(base+60000).toISOString()};
    const render=()=>StoreSaleBanner({sales:[sale],activeTab:'living',onOpenSale:s=>{opened=s;}});
    const banner=render();
    assert.ok(text(banner).includes(i18n.t('store.tabRooms')));
    assert.ok(text(banner).includes(i18n.t('store.discountPercent',{percent:25})));
    assert.ok(text(banner).includes(i18n.t('store.viewDeals')));
    banner.props.onPress();assert.equal(opened,sale);
    const tabs=flatten(StoreTabBar({active:'living',onChange(){},sales:[sale]})).filter(n=>n.props.accessibilityRole==='tab');
    assert.ok(tabs.find(tab=>tab.props.accessibilityLabel.startsWith(i18n.t('store.tabRooms'))).props.accessibilityLabel.includes(i18n.t('store.sale')));
    assert.equal(tabs.find(tab=>tab.props.accessibilityLabel.startsWith(i18n.t('store.tabDecorations'))).props.accessibilityLabel,i18n.t('store.tabDecorations'));
    now=base+60000;assert.equal(render(),null);
    assert.equal(StoreSaleBanner({sales:[],activeTab:'living',onOpenSale(){}}),null);
    now=base;
    const mixed=StoreSaleBanner({sales:[{...sale,minPercent:10,maxPercent:50}],activeTab:'living',onOpenSale(){}});
    assert.ok(text(mixed).includes(i18n.t('store.discountUpTo',{percent:50})));
  }
});
