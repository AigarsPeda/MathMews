/** Render real family JSX at default and enlarged text metrics and compare the learner's information. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { readPuzzles } from './puzzles/catalog.mjs';

const jsx = (type, props) => ({ type, props });
const flatten = style => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const compiled = new Map();
const locales = Object.fromEntries(['en', 'lv', 'ru'].map(language =>
  [language, JSON.parse(fs.readFileSync(`locales/${language}.json`, 'utf8'))]));

// Record the line segments Skia receives so tests can inspect actual painted ticks.
function makePath() {
  const segments = [];
  let x, y;
  return { segments, moveTo(a, b) { x = a; y = b; },
    lineTo(a, b) { segments.push([x, y, a, b]); x = a; y = b; },
    quadTo() {}, close() {}, arcToOval() {}, addCircle() {} };
}

function renderer({ fontScale, locale, beat, width, markPrefix, adapt }) {
  const state = new Map(), modules = new Map();
  let frame, hook, dirty;
  const layoutQueue = [];
  const styleSheet = { create: s => s, flatten, absoluteFill: { position: 'absolute' } };
  const animation = { delay: () => animation, duration: () => animation, reduceMotion: () => animation };
  const translate = (key, args = {}) => key.split('.').reduce((node, part) => node[part], locales[locale])
    .replace(/{{(\w+)}}/g, (_, name) => String(args[name]));
  const proofCaption = { PlayProofCaption: 'Fragment', useProofViewport: () => null };
  const revealSurface = { RevealSurface: 'View' };
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    react: { Fragment: 'Fragment', createContext: value => ({ value }), useContext: context => context.value, useCallback: fn => fn, useRef: current => ({ current }), useMemo: fn => fn(), useEffect() {}, useLayoutEffect() {}, useState(initial) {
      const id = frame + '#' + hook++;
      if (!state.has(id)) state.set(id, initial);
      return [state.get(id), update => {
        const previous = state.get(id);
        const value = typeof update === 'function' ? update(previous) : update;
        if (value !== previous) { state.set(id, value); dirty = true; }
      }];
    } },
    'react-native': { Pressable: 'Pressable', View: 'View', ScrollView: 'ScrollView', StyleSheet: styleSheet,
      useWindowDimensions: () => ({ width, height: 852, fontScale }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'View' }, FadeIn: animation, FadeOut: animation, LinearTransition: animation,
      ReduceMotion: {}, withTiming: target => target, useSharedValue: value => ({ value }), useReducedMotion: () => false, useAnimatedStyle: fn => fn(), useDerivedValue: fn => ({ get value() { return fn(); }, get: fn }) },
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/contexts/LocaleProvider': { useLocale: () => ({ locale }) },
    '@/components/puzzle/PuzzleText': { PuzzleText: 'Text' },
    './PuzzleText': { PuzzleText: 'Text' },
    '@/utils/scale': { moderateScale: n => n }, '@/utils/puzzle-motion': {},
    './kit/PracticeAffordances': { EntryBuild: 'Fragment' },
    '../kit/PracticeAffordances': { EntryBuild: 'Fragment', IdleHint: () => null, MovablePiece: 'View', DropTargetOutline: 'View' },
    '../kit/proofHaptics': { landTick: () => {} },
    './kit/PuzzleKit': { UnknownWell: () => jsx('Text', { children: '?' }) },
    'expo-haptics': { selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: { Success: 'success', Error: 'error' } },
    '@shopify/react-native-skia': { Skia: { Path: { Make: makePath }, XYWHRect: (...args) => args },
      ...Object.fromEntries(['Canvas', 'Path', 'Rect', 'Group', 'Circle', 'Line'].map(k => [k, k])) },
    './kit/useRevealBeats': { useRevealBeats: count => {
      const landed = Math.min(beat, count);
      return { landed, position: { value: landed, get: () => landed }, settled: landed === count, reduced: false };
    } },
    '@/components/puzzle/PlayProofCaption': proofCaption,
    './PlayProofCaption': proofCaption,
    '@/components/puzzle/kit/ProofFeedback': { ProofLanding: 'Fragment', ProofFinale: 'Fragment', ProofGeometry: 'Fragment' },
    './kit/ProofFeedback': { ProofLanding: 'Fragment', ProofFinale: 'Fragment', ProofGeometry: 'Fragment' },
    '../kit/RevealSurface': revealSurface,
    '@/components/puzzle/kit/RevealSurface': revealSurface,
    './counting/announcements': {}, './Focus': { Caption: 'Text' }, './kit/Focus': { Caption: 'Text', Focus: 'View' },
    '@/constants/game': { GameColors: {} },
  };
  mocks['@/constants/puzzle-theme'] = load('constants/puzzle-theme.ts');
  for (const key of ['./Focus', './kit/Focus']) mocks[key].ProofCaption = ({ text }) => jsx('Text', { children: text });
  adapt?.(mocks, beat);
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText);
    const module = { exports: {} };
    vm.runInNewContext(compiled.get(file), { module, exports: module.exports, require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      const base = id.startsWith('@/') ? id.slice(2) : path.join(path.dirname(file), id);
      const resolved = [base + '.tsx', base + '.ts'].find(f => fs.existsSync(f));
      assert.ok(resolved, `Provide a native adapter for ${id}`);
      return load(resolved);
    } });
    modules.set(file, module.exports);
    return module.exports;
  }
  function walk(node, address, info, visible = true) {
    if (Array.isArray(node)) { node.forEach((child, i) => walk(child, address + '.' + i, info, visible)); return; }
    if (typeof node === 'string' || typeof node === 'number') { if (visible) info.labels.push(String(node)); return; }
    if (!node?.props) return;
    const { type, props } = node;
    if (typeof type === 'function') {
      if (visible && type.name === 'Vessel') info.vessels++;
      frame = address + '/' + type.name; hook = 0;
      walk(type(props), frame, info, visible);
      return;
    }
    const style = flatten(props.style);
    visible &&= style.opacity !== 0;
    if (props.onLayout) {
      // Only the native boundary is simulated. Production probes and their callbacks still run.
      const size = (style.fontSize ?? 16) * fontScale;
      const layout = type === 'Text' ? { width: String(props.children).length * size * .62, height: size * 1.4 } : { width, height: 800 };
      layoutQueue.push(() => props.onLayout({ nativeEvent: { layout } }));
    }
    if (visible && props.testID?.startsWith(markPrefix)) info.marks.push(props.testID.slice(markPrefix.length));
    if (visible && markPrefix === 'bar-tick-' && type === 'View' && style.position === 'absolute' &&
        style.backgroundColor === mocks['@/constants/puzzle-theme'].Quantity.amber.fill && style.bottom > 0 && style.height > 0) info.barCaps++;
    if (visible && (props.testID === 'clock-given-start' || props.testID === 'clock-elapsed-end')) info.clockMarkers.push(props.testID);
    if (visible && props.accessibilityLabel) info.spoken.push(props.accessibilityLabel);
    if (visible && props.testID?.startsWith('clock-dial-tick-')) {
      assert.ok(style.width > 0 && style.height > 0 && style.backgroundColor);
      info.drawn.push([style.left, style.top, style.width, style.height, style.transform[0].rotate]);
    }
    // Fraction tracks paint their rail and vertical ticks as native Views.
    if (visible && markPrefix === 'line-tick-' && type === 'View' && style.position === 'absolute' &&
        style.backgroundColor === mocks['@/constants/puzzle-theme'].Quantity.violet.onFill && style.height > style.width && style.width > 0) {
      const centre = style.left + style.width / 2;
      info.drawn.push([centre, style.top, centre, style.top + style.height]);
    }
    if (visible && type === 'Line') info.drawn.push([props.p1.x, props.p1.y, props.p2.x, props.p2.y]);
    if (visible && markPrefix === 'line-tick-' && type === 'Path') info.drawn.push(...(props.path?.segments ?? []));
    walk(type === 'Pressable' && typeof props.children === 'function' ? props.children({ pressed: false }) : props.children, address + '/children', info, visible);
  }
  return (file, name, props) => {
    const componentProps = typeof props === 'function' ? props(load) : props;
    for (let i = 0; i < 5; i++) {
      const info = { labels: [], marks: [], spoken: [], drawn: [], clockMarkers: [], vessels: 0, barCaps: 0 };
      dirty = false;
      walk(jsx(load(file)[name], componentProps), 'root', info);
      layoutQueue.splice(0).forEach(dispatch => dispatch());
      if (!dirty) {
        if (markPrefix === 'line-tick-') {
          const rail = info.drawn.find(([x, y, x2, y2]) => x !== x2 && y === y2);
          const first = rail ? rail[0] : info.drawn[0]?.[0];
          const last = rail ? rail[2] : info.drawn.at(-1)?.[0];
          assert.ok(last > first, 'The number line paints a span between distinct ticks');
          const min = Number(info.marks[0]), max = Number(info.marks.at(-1));
          const spacing = (last - first) / (max - min);
          info.drawn = info.drawn.filter(([x, y, x2, y2]) => x === x2 && y !== y2)
            .map(([x]) => min + Math.round((x - first) / spacing)).sort((a, b) => a - b);
        }
        return info;
      }
    }
    assert.fail('Measurement failed to settle');
  };
}

const modelProps = (puzzle, reveal) => ({ model: puzzle.everyday.model, onSolutionShown: reveal ? () => {} : undefined });
// Each registry entry verifies the actual labels and drawing nodes from one family.
const families = [{
  file: 'components/puzzle/JugPour.tsx', component: 'JugPour', markPrefix: 'jug-tick-',
  ids: ['v2-medium-capacity-lesson-10-4', 'v2-medium-capacity-lesson-2-4', 'v2-easy-capacity-lesson-1-7',
    'v2-medium-capacity-lesson-7-1', 'v2-easy-capacity-lesson-6-4', 'v2-easy-capacity-lesson-9-4', 'v2-hard-capacity-lesson-5-1'],
  props: modelProps,
  check({ model }, beat, normal, locale) {
    const portionStrip = model.task === 'servings' || model.task === 'containers';
    assert.equal(normal.vessels, portionStrip ? 0 : 1, 'Jug scenes use one receiver and portion scenes use one strip throughout');
    if (portionStrip) {
      const cells = Math.ceil(model.amounts[0] / model.portion);
      assert.deepEqual(normal.marks, Array.from({ length: cells }, (_, i) => `portion-${i}`));
    }
    if (beat === 1 && model.task === 'total') {
      assert.equal(normal.labels.filter(s => s.startsWith('800\u00a0')).length, 1, 'One committed 800 ml readout');
    }
    if (beat === Infinity && model.task === 'containers') {
      const full = Math.floor(model.amounts[0] / model.portion);
      const extra = Number(model.amounts[0] % model.portion !== 0);
      const equation = locales[locale].jugSolution.bottleCount.replace('{{full}}', String(full))
        .replace('{{extra}}', String(extra)).replace('{{count}}', String(full + extra));
      assert.ok(normal.labels.includes(equation), `Missing bottle-count equation ${equation}`);
    }
    if (beat === Infinity && model.task === 'servings') {
      const amount = model.amounts[0];
      const full = Math.floor(amount / model.portion);
      const remainder = amount % model.portion;
      const ml = value => locales[locale].jugSolution.ml.replace('{{value}}', String(value));
      const equation = remainder
        ? `${ml(amount)} = ${full} × ${ml(model.portion)} + ${ml(remainder)}`
        : `${ml(amount)} ÷ ${ml(model.portion)} = ${full}`;
      const labels = normal.labels.map(text => text.replace(/\u00a0/g, ' '));
      assert.ok(labels.includes(equation), `Missing settled serving equation: ${equation}`);
    }
    if (beat === null && model.task === 'read') {
      assert.deepEqual(normal.marks.map(Number), Array.from({ length: 11 }, (_, i) => i * 100));
      assert.deepEqual(normal.labels.filter(v => /^\d+$/.test(v)), ['0', '200', '400', '600', '800', '1000']);
      assert.ok(!normal.spoken.join(' ').includes('700'), 'Read question discloses the answer');
    }
    if (beat === null && model.task === 'litres') {
      assert.deepEqual(normal.marks.map(Number), Array.from({ length: 13 }, (_, i) => i * 250));
      assert.ok(normal.labels.some(s => s.startsWith('2750\u00a0')));
    }
  },
}, {
  file: 'components/puzzle/BarChart.tsx', component: 'BarChart', markPrefix: 'bar-tick-', props: modelProps,
  ids: ['v2-medium-data-lesson-7-1', 'v2-hard-data-lesson-3-7', 'v2-medium-data-lesson-1-7', 'v2-medium-data-lesson-10-4', 'v2-hard-data-lesson-5-7'],
  check({ model }, beat, info) {
    assert.ok(info.marks.includes('major-0'));
    if (model.task === 'read') {
      const ticks = info.marks.map(mark => Number(mark.split('-')[1])).sort((a, b) => a - b);
      ticks.forEach((value, index) => assert.equal(value, index * model.step));
    }
    if (model.task === 'difference' && beat === Infinity) {
      const [a, b] = model.values;
      assert.equal(info.barCaps, 1, 'The taller bar highlights its excess above the shorter one');
      assert.ok(!info.labels.some(label => /^\+\s*\d+$/u.test(label)), 'The subtraction supplies the difference once');
      assert.ok(info.labels.includes(`${Math.max(a, b)} − ${Math.min(a, b)} = ${Math.abs(a - b)}`));
    }
  },
}, {
  file: 'components/puzzle/ClockDiagram.tsx', component: 'ClockDiagram', markPrefix: 'clock-dial-tick-', props: modelProps,
  ids: ['v2-medium-time-lesson-4-4', 'v2-easy-time-lesson-10-10', 'v2-medium-time-lesson-7-7', 'v2-easy-time-lesson-3-4', 'v2-easy-time-lesson-1-1'],
  check({ model }, beat, info, locale) {
    assert.equal(info.drawn.length, 12);
    assert.equal(new Set(info.drawn.map(line => line.join(','))).size, 12);
    assert.deepEqual(info.labels.slice(0, 12), Array.from({ length: 12 }, (_, i) => String(i + 1)));
    assert.deepEqual(info.marks.map(Number), Array.from({ length: 12 }, (_, i) => i * 5));
    if (model.task === 'read' && beat !== null) {
      const hour = Math.floor(model.minutes / 60) % 12 || 12;
      const minutes = model.minutes % 60;
      const key = minutes === 0 ? 'onHour' : beat === Infinity ? 'minutesPast' : 'pastHour';
      const text = locales[locale].clockSolution[key].replace('{{hour}}', String(hour)).replace('{{minutes}}', String(minutes));
      assert.ok(info.labels.includes(text), `Missing clock caption ${text}`);
    }
    if (model.task !== 'elapsed') return;
    if (beat === null) {
      assert.deepEqual(info.clockMarkers, ['clock-given-start', 'clock-elapsed-end']);
      assert.equal(info.labels.slice(12).join('').trim(), '', 'The elapsed-time givens are marked on the dial');
    }
    if (beat === 1) assert.ok(info.labels.includes('12:00'), 'The first landing is at noon');
    if (beat === Infinity) {
      const captions = info.labels.slice(12);
      assert.equal(captions.length, 1, 'Only the elapsed-time equation remains below the dial');
      assert.ok(captions[0].startsWith('5 + 40 = 45'));
    }
  },
}];
// Number lines exercise the actual Play tasks and solution route.
const lineFixtures = {
  NumberLineTask: ['v2-easy-subtraction-explore-10-4', 'v2-medium-subtraction-lesson-9-boss-2'],
  FractionNumberLineTask: ['v2-easy-fractions-explore-6-2', 'v2-medium-fractions-equivalent-2'],
};
const adaptNumberLine = (mocks, beat) => {
  const native = mocks['react-native'];
  native.Pressable = props => jsx('Pressable', {
    ...props, children: typeof props.children === 'function' ? props.children({ pressed: false }) : props.children,
  });
  native.Dimensions = { get: native.useWindowDimensions };
  native.PixelRatio = { roundToNearestPixel: x => x };
  mocks.react.useRef = current => ({ current });
  Object.assign(mocks['react-native-reanimated'], {
    useSharedValue: value => ({ value, get: () => value }),
    useReducedMotion: () => false,
  });
  const lineBeat = mocks['./kit/useRevealBeats'].useRevealBeats;
  mocks['./kit/useRevealBeats'].useRevealBeats = count => ({
    ...lineBeat(count), done: beat >= count,
  });
  const path = makePath;
  Object.assign(mocks['@shopify/react-native-skia'], { Circle: 'Circle', Skia: { Path: { Make: path } } });
  mocks['@/components/puzzle/kit/useRevealBeats'] = mocks['./kit/useRevealBeats'];
  mocks['@/utils/puzzle-motion'] = { countingCadence: n => n };
  mocks['@/components/puzzle/kit/PuzzleKit'] = { ValueChip: props => jsx('Text', { children: props.label }) };
  mocks['@/components/puzzle/kit/Focus'] = mocks['./kit/Focus'];
};
for (const [component, ids] of Object.entries(lineFixtures)) {
  const fraction = component === 'FractionNumberLineTask';
  families.push({
    component, ids, file: `components/puzzle/${component}.tsx`, markPrefix: 'line-tick-',
    props: puzzle => ({ puzzle, value: fraction ? Math.min(2, puzzle.payload.divisions) : null, selectedValue: null,
      onSelectValue() {}, onChange() {}, answered: false, isCorrect: false }),
    check({ puzzle }, _, normal) {
      const min = fraction ? 0 : puzzle.payload.min;
      const max = fraction ? puzzle.payload.divisions : puzzle.payload.max;
      const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      assert.deepEqual(normal.marks.map(Number), ticks);
      assert.deepEqual(normal.drawn, ticks);
    },
  });
}
families.push({
  component: 'NumberLineReveal', file: 'components/puzzle/NumberLineReveal.tsx', markPrefix: 'reveal-line-tick-',
  ids: Object.values(lineFixtures).flat(),
  props: puzzle => load => ({ route: load('utils/number-line-reveal.ts').numberLineRoute(puzzle), onSolutionShown() {} }),
});

let comparisons = 0;
for (const locale of Object.keys(locales)) {
  const puzzles = ['easy', 'medium', 'hard'].flatMap(tier => readPuzzles(locale, tier));
  for (const family of families) for (const id of family.ids) {
    const puzzle = puzzles.find(p => p.id === id);
    assert.ok(puzzle, id);
    for (const beat of [null, 0, 1, Infinity]) {
      const props = family.props(puzzle, beat !== null);
      const render = (fontScale, width) => renderer({ fontScale, width, locale, beat: beat ?? 0, markPrefix: family.markPrefix,
        adapt: family.markPrefix.includes('line-tick-') ? adaptNumberLine : undefined })(family.file, family.component, props);
      const normal = render(1, 350);
      assert.ok(normal.labels.length && (normal.marks.length || normal.drawn.length), id + ' has visible information');
      for (const [size, width] of [[2, 350], [2.4, 310]]) {
        assert.deepEqual(render(size, width), normal, `${id} / ${locale} / ${beat} / ${size}`);
        comparisons++;
      }
      family.check?.(props, beat, normal, locale);
    }
  }
}
console.log(`Verified ${comparisons} rendered information comparisons in English, Latvian and Russian.`);
