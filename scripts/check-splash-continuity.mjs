/** Check exact startup pixels and delayed Canvas readiness using the real component. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

// Hold the system splash before loading the rest of the React tree. Removing
// this early side effect can expose a blank root before branding can paint.
const rootLayout = ts.createSourceFile('app/_layout.tsx', fs.readFileSync('app/_layout.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const firstImport = rootLayout.statements.find(ts.isImportDeclaration);
assert.equal(firstImport.moduleSpecifier.text, '@/lib/init-splash-screen', 'Native auto-hide must be prevented before loading the app');
let prevented = 0, splashOptions;
const initModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/init-splash-screen.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  module: initModule, exports: initModule.exports,
  require: name => {
    assert.equal(name, 'expo-splash-screen');
    return {
      setOptions: options => { splashOptions = options; },
      preventAutoHideAsync: () => { prevented++; return Promise.resolve(); },
    };
  },
});
assert.equal(prevented, 1, 'The native splash must remain visible until its replacement is ready');
assert.equal(splashOptions.fade, false);
assert.equal(splashOptions.duration, 0);

const portrait = await sharp('assets/3d/cat-splash.png').ensureAlpha().raw().toBuffer();
const firstCell = await sharp('assets/3d/atlases/cat-orange-idle.png')
  .extract({ left: 0, top: 0, width: 192, height: 192 }).ensureAlpha().raw().toBuffer();
assert.deepEqual(portrait, firstCell, 'The startup portrait must be the exact first animation cell');

// The OS launch image must preserve the same centered branding and the empty
// track's position, even before React can mount or decode its animation sheet.
const launch = sharp('assets/images/splash-launch.png');
const launchMetadata = await launch.metadata();
assert.equal(launchMetadata.width, 960);
assert.equal(launchMetadata.height, 960);
const launchBrand = await launch.clone().extract({ left: 120, top: 120, width: 720, height: 720 }).ensureAlpha().raw().toBuffer();
const scaledBrand = await sharp('assets/images/splash-brand.png').resize(720, 720).ensureAlpha().raw().toBuffer();
// Alpha compositing can round an RGB channel by one. Position, dimensions and
// alpha must match exactly, with only that rounding allowed in the color.
let largestColorDifference = 0;
let alphaMatches = true;
for (let index = 0; index < launchBrand.length; index++) {
  if (index % 4 === 3) alphaMatches &&= launchBrand[index] === scaledBrand[index];
  else largestColorDifference = Math.max(largestColorDifference, Math.abs(launchBrand[index] - scaledBrand[index]));
}
assert.ok(alphaMatches && largestColorDifference <= 1, 'Native launch must preserve the existing cat/title at exactly the React size and center');
const trackPixel = await launch.clone().extract({ left: 480, top: 948, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
assert.deepEqual([...trackPixel], [255, 224, 204, 255], 'The initial track must match the live progress bar');

// Optionally verify a built .app, since a correct prebuild config alone does
// not prove that Xcode actually copied the launch PNGs into the product.
if (process.argv[2]) {
  const app = process.argv[2];
  const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(app, 'Info.plist')], { encoding: 'utf8' }));
  assert.equal(plist.UILaunchStoryboardName, undefined);
  assert.equal(plist.UILaunchScreen.UIImageName, 'MewsLaunch');
  assert.equal(plist.UILaunchScreen.UIColorName, 'SplashScreenBackground');
  assert.equal(plist.UILaunchScreen.UIImageRespectsSafeAreaInsets, false);
  for (const [scale, suffix] of [[1, ''], [2, '@2x'], [3, '@3x']]) {
    // Xcode writes Apple-optimized CgBI PNGs that libpng cannot decode. Read
    // their standard IHDR dimensions without depending on a desktop decoder.
    const bundled = fs.readFileSync(path.join(app, `MewsLaunch${suffix}.png`));
    assert.equal(bundled.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    let header = -1;
    for (let offset = 8; offset + 12 <= bundled.length; offset += bundled.readUInt32BE(offset) + 12) {
      if (bundled.toString('ascii', offset + 4, offset + 8) === 'IHDR') { header = offset + 8; break; }
    }
    assert.ok(header >= 0, 'Every bundled launch PNG must contain an image header');
    assert.equal(bundled.readUInt32BE(header), 320 * scale, 'The launch image must be copied into the app bundle at every scale');
    assert.equal(bundled.readUInt32BE(header + 4), 320 * scale);
  }
  console.log('Verified packaged native launch configuration and all three PNG resources.');
}

let texture = null, playing = false, slots = [], cursor = 0, effects = [], readyPages;
let nextId = 1, readyCalls = 0;
const frames = new Map();
const isMounted = { current: true };
function memo(fn, deps) {
  const index = cursor++;
  const old = slots[index];
  if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
    slots[index] = { value: fn(), deps };
  }
  return slots[index].value;
}
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useCallback: (fn, deps) => memo(() => fn, deps),
  useState: initial => {
    const index = cursor++;
    slots[index] ??= { value: initial };
    return [slots[index].value, value => { slots[index].value = value; }];
  },
  useEffect: (fn, deps) => {
    const index = cursor++;
    const old = slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      old?.cleanup?.();
      slots[index] = { deps };
      effects.push(() => { slots[index].cleanup = fn(); });
    }
  },
};
const mocks = {
  react: React,
  'react-native': { View: 'View', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } } },
  'react-native-reanimated': { useDerivedValue: fn => ({ get: fn }) },
  '@shopify/react-native-skia': { Canvas: 'Canvas', Group: 'Group', Image: 'SkiaImage', FilterMode: { Linear: 1 }, MipmapMode: { None: 0 }, useImage: () => texture },
  '@/constants/cat-skins': { CAT_SKIN_SOURCES: { orange: 1 }, CAT_SKIN_SHEET: { frameSize: 192, width: 1536, height: 2304, cols: 8 } },
  '@/constants/cat-sprite-catalog': { CAT_SPRITE_CATALOG: { idle: { frameCount: 96, fps: 24 } } },
  '@/pet-display/media/sprite/use-sprite-clock': { useSpriteClock: options => { readyPages = options.readyPages; return { get: () => 0 }; } },
  '@/constants/game': { GameColors: {} },
  '@/hooks/use-is-mounted': { useIsMounted: () => isMounted },
  '@/utils/scale': { moderateScale: value => value },
};
const module = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('components/branding/AnimatedSplashCat.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
vm.runInNewContext(code, { module, exports: module.exports, React,
  require: id => { assert.ok(id in mocks, id); return mocks[id]; },
  requestAnimationFrame: fn => { const id = nextId++; frames.set(id, fn); return id; },
  cancelAnimationFrame: id => frames.delete(id),
});
const onReady = () => { readyCalls++; playing = true; };
function render() {
  cursor = 0; effects = [];
  const result = module.exports.AnimatedSplashCat({ size: 192, playing, onReady });
  effects.forEach(fn => fn());
  return result;
}
function paint() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); }
const pending = render();
pending.props.onLayout();
render();
assert.equal(readyCalls, 0, 'A missing sheet must retain the portrait');
texture = { id: 'idle' };
const tree = render();
assert.equal(readyCalls, 0, 'A decoded sheet alone must not remove the portrait');
const canvas = tree.props.children[0];
assert.equal(canvas.type, 'Canvas');
assert.equal(canvas.props.onLayout, undefined, 'Fabric Canvas layout must come from its native wrapper');
assert.equal(canvas.props.colorSpace, 'srgb', 'Canvas and startup PNG must use the same color space');
render();
assert.equal(readyPages.length, 0, 'Playback holds frame zero beneath the portrait');
paint();
assert.equal(readyCalls, 0, 'Layout must get a drawing turn before handoff');
paint();
assert.equal(readyCalls, 1);
render();
assert.equal(readyPages[0], 0, 'Playback starts only after the static portrait handoff');
slots.forEach(slot => slot.cleanup?.());
assert.equal(frames.size, 0, 'Unmount cancels pending handoff callbacks');
console.log('Verified identical startup/animation pixels, decoded-and-laid-out readiness, and frame-zero playback handoff.');

// Unmount during the drawing handoff, while its second callback is pending.
slots = []; frames.clear(); readyCalls = 0; playing = false;
render().props.onLayout();
render(); paint();
assert.equal(frames.size, 1, 'The test must unmount with a pending drawing callback');
slots.forEach(slot => slot.cleanup?.());
assert.equal(frames.size, 0, 'Unmount must cancel the pending portrait handoff');
paint();
assert.equal(readyCalls, 0, 'A cancelled drawing callback must not report animation readiness');

// If the Canvas wins the decode race, the removed fallback must not leave the
// gate waiting forever for that Image's onLoad callback.
slots = []; frames.clear();
React.useRef = initial => memo(() => ({ current: initial }), []);
React.useSyncExternalStore = (_subscribe, get) => get();
const timers = new Map();
let hidden = 0;
let authReady = true, localReady = true, cloudReady = true;
let assetSnapshot = { mayContinue: true, completed: 1, failed: 0, total: 1 };
const gateMocks = {
  ...mocks,
  'react-native': { ...mocks['react-native'], Image: 'NativeImage' },
  '@/components/branding/AnimatedSplashCat': { AnimatedSplashCat: 'AnimatedSplashCat', SplashBackdrop: 'SplashBackdrop' },
  '@/components/ui/ProgressBar': { ProgressBar: 'ProgressBar' },
  '@/contexts/AuthProvider': { useAuth: () => ({ isAuthReady: authReady }) },
  '@/contexts/GameProvider': { useGame: () => ({ isReady: localReady, cloudRestoreCheckComplete: cloudReady }) },
  '@/lib/init-game-asset-prefetch': { subscribeGameAssetLoading: () => () => {}, getGameAssetLoadingSnapshot: () => assetSnapshot },
  'expo-constants': { default: { expoConfig: { name: 'Math Mews' } } },
  'expo-splash-screen': { hideAsync: async () => { hidden++; } },
  'react-i18next': { useTranslation: () => ({ t: value => value }) },
  '@/assets/images/splash-brand.png': 'logo',
  '@/assets/3d/cat-splash.png': 'portrait',
};
const gateModule = { exports: {} };
const gateCode = ts.transpileModule(fs.readFileSync('components/branding/SplashGate.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
vm.runInNewContext(gateCode, { module: gateModule, exports: gateModule.exports, React,
  require: id => { assert.ok(id in gateMocks, id); return gateMocks[id]; },
  requestAnimationFrame: fn => { const id = nextId++; frames.set(id, fn); return id; },
  setTimeout: (fn, delay) => { const id = nextId++; timers.set(id, { fn, delay }); return id; },
  clearTimeout: id => timers.delete(id),
});
function renderGate() {
  cursor = 0; effects = [];
  const result = gateModule.exports.SplashGate({ children: 'gameplay' });
  effects.forEach(fn => fn());
  return result;
}
const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...node.props.children.flat().flatMap(flatten)];
let gateTree = renderGate();
let nodes = flatten(gateTree);
// Native Image starts with the bundled PNG's intrinsic size. Yoga's absolute
// offsets do not replace those dimensions, so explicit styles must override it.
const dimensions = {
  logo: await sharp('assets/images/splash-brand.png').metadata(),
  portrait: await sharp('assets/3d/cat-splash.png').metadata(),
};
function imageSize(node) {
  const source = dimensions[node.props.source];
  const styles = [node.props.style].flat(Infinity).filter(Boolean);
  return Object.assign({ width: source.width, height: source.height }, ...styles);
}
const logo = nodes.find(node => node.props.source === 'logo');
const fallback = nodes.find(node => node.props.source === 'portrait');
assert.equal(imageSize(logo).width, 240, 'Branding must override its intrinsic 640 px width');
assert.equal(imageSize(logo).height, 240, 'Branding must override its intrinsic 640 px height');
assert.equal(imageSize(fallback).width, 192);
assert.equal(imageSize(fallback).height, 192);
const content = nodes.find(node => node.props.accessibilityRole === 'header');
assert.equal(content.props.style.overflow, 'hidden', 'Branding must not spill outside its native-size box');
const catWindow = nodes.find(node => node.props.style?.left === 24);
assert.equal(catWindow.props.style.overflow, 'hidden');
assert.equal(catWindow.props.style.width, imageSize(fallback).width);
assert.equal(catWindow.props.style.height, imageSize(fallback).height);
const progressBar = nodes.find(node => node.type === 'ProgressBar');
const loading = nodes.find(node => node.props.style?.marginTop === 152);
assert.equal(loading.props.style.width, 240);
assert.equal(progressBar.props.style.height, 8, 'The native and live loading tracks must have identical bounds');
nodes.find(node => node.type === 'AnimatedSplashCat').props.onReady();
renderGate(); paint();
assert.equal(hidden, 0, 'Native launch must wait for its replacement logo');
nodes.find(node => node.props.source === 'logo').props.onLoad();
nodes.find(node => node.props.accessibilityRole === 'header').props.onLayout();
renderGate(); paint();
assert.equal(hidden, 1, 'A ready Canvas can replace a portrait whose onLoad never fired');
for (const [id, timer] of [...timers]) if (timer.delay === 1200) { timers.delete(id); timer.fn(); }
renderGate();
for (const [id, timer] of [...timers]) if (timer.delay === 250) { timers.delete(id); timer.fn(); }
gateTree = renderGate();
assert.equal(gateTree.props.children[0], 'gameplay', 'The decode race must not strand the gate');
slots.forEach(slot => slot.cleanup?.());
console.log('Verified explicit native-size image bounds, clipping, native-logo readiness and gameplay continuation when the Canvas decodes before the fallback image.');

// The portrait can win the race while the Canvas or network takes much longer.
// Reveal usable branding early, but never open gameplay without the local save.
slots = []; frames.clear(); timers.clear(); hidden = 0;
authReady = false; localReady = false; cloudReady = false;
assetSnapshot = { mayContinue: false, completed: 0, failed: 0, total: 4 };
nodes = flatten(renderGate());
assert.ok(nodes.some(node => node.props.source === 'portrait'), 'The very first React render must contain the static cat');
assert.equal(nodes.find(node => node.type === 'ProgressBar').props.progress, 0);
nodes.find(node => node.props.source === 'logo').props.onLoad();
nodes.find(node => node.props.accessibilityRole === 'header').props.onLayout();
renderGate(); paint();
assert.equal(hidden, 0, 'Layout and title alone must not expose an empty cat window');
nodes.find(node => node.props.source === 'portrait').props.onLoad();
nodes = flatten(renderGate()); paint();
assert.equal(hidden, 1, 'The static cat must replace the native splash even before Canvas or data readiness');
assert.equal(nodes.find(node => node.type === 'AnimatedSplashCat').props.playing, false);
assert.ok(nodes.some(node => node.props.source === 'portrait'), 'A slow Canvas must retain the exact still cat');

for (const [id, timer] of [...timers]) if (timer.delay === 1200 || timer.delay === 12000) { timers.delete(id); timer.fn(); }
assetSnapshot = { mayContinue: true, completed: 4, failed: 1, total: 4 };
nodes = flatten(renderGate());
assert.ok(![...timers.values()].some(timer => timer.delay === 250), 'Even after the deadline, gameplay must wait for the local save');
localReady = true;
nodes = flatten(renderGate());
assert.ok(Math.abs(nodes.find(node => node.type === 'ProgressBar').props.progress - .625) < 1e-9, 'Failed assets and timed-out remote checks must not claim full progress');
nodes.find(node => node.type === 'AnimatedSplashCat').props.onReady();
nodes = flatten(renderGate()); paint();
assert.equal(hidden, 1, 'Canvas readiness must not hide the native splash twice');
assert.equal(nodes.find(node => node.type === 'AnimatedSplashCat').props.playing, true);
assert.ok(!nodes.some(node => node.props.source === 'portrait'), 'Only a ready Canvas can remove the portrait');
for (const [id, timer] of [...timers]) if (timer.delay === 250) { timers.delete(id); timer.fn(); }
assert.equal(renderGate().props.children[0], 'gameplay', 'Slow remote checks and a failed asset must not strand a loaded local game');
slots.forEach(slot => slot.cleanup?.());
assert.equal(timers.size, 0, 'Unmount must release loading timers');
console.log('Verified immediate static branding, delayed animation, local-save gating and honest progress after failure or timeout.');
