/** The first native scroll view mounts at the current stop, with final content bounds. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const layoutModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/topic-path-layout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: layoutModule, exports: layoutModule.exports });
let viewport;
const jsx = (type, props, key) => ({ type, props, key });
const shared = value => ({ get: () => value, set: next => { value = next; } });
const mocks = {
  react: { createElement: (type, { key, ...props }) => jsx(type, props, key),
    useState: initial => [viewport ??= initial, next => { viewport = typeof next === 'function' ? next(viewport) : next; }], useMemo: fn => fn() },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: styles => styles } },
  'react-native-reanimated': { __esModule: true, default: { ScrollView: 'ScrollView' }, useSharedValue: shared, useAnimatedScrollHandler: fn => fn },
  'react-i18next': { useTranslation: () => ({ t: (key, args) => key === 'puzzlePathDesign.level' ? `Level ${args.number}` : key }) },
  '@shopify/react-native-skia': { Canvas: 'Canvas', Path: 'Path', Skia: { Path: { MakeFromSVGString: value => value } } },
  '@expo/vector-icons': { Feather: 'Feather' },
  '@/components/puzzle/PuzzleText': { PuzzleText: 'Text' },
  '@/components/puzzle/PuzzleGradient': { PuzzleGradient: 'PuzzleGradient' },
  '@/contexts/LocaleProvider': { useLocale: () => ({ locale: 'en' }) },
  '@/hooks/use-animation-activity': { useAnimationActivity: () => ({ active: false, reduceMotion: false }) },
  '@/constants/puzzle-theme': { TopicPathColors: { current: {}, locked: {}, completed: {} } },
  '@/constants/puzzle-path': { getPathProgress: () => ({ solved: 0, total: 10, complete: false }), isPathAvailable: () => true },
  '@/utils/topic-path-layout': layoutModule.exports,
  '@/utils/border-radius': { insetRadius: (radius, inset) => Math.max(0, radius - inset) },
  '@/utils/scale': { moderateScale: n => n },
};
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/TopicLevelPath.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { module, exports: module.exports, require: id => { assert.ok(id in mocks, id); return mocks[id]; } });
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const topics = JSON.parse(fs.readFileSync('data/puzzle-curriculum.json', 'utf8')).topics.map(topic => topic.id);
let cases = 0;
for (const topicId of topics) for (const width of [232, 276, 320, 390, 768]) for (const height of [300, 550, 900]) {
  const count = topicId === 'cat-plans' ? 3 : 10;
  const lessons = Array.from({ length: count }, (_, i) => ({ id: `lesson-${i}`, topicId, title: { en: `Lesson ${i + 1}` } }));
  for (let current = 0; current < count; current++) {
    viewport = undefined;
    const props = { lessons, progress: {}, currentLessonId: lessons[current].id, onPlay() {}, entryKey: 0 };
    let root = module.exports.TopicLevelPath(props);
    assert.equal(root.props.children, null, 'No top-of-path frame appears before the viewport is measured');
    root.props.onLayout({ nativeEvent: { layout: { width, height } } });
    root = module.exports.TopicLevelPath(props);
    const mounted = root.props.children;
    const scroll = mounted.type(mounted.props);
    assert.equal(scroll.type, 'ScrollView');
    assert.equal(scroll.props.onContentSizeChange, undefined, 'Content arrival never triggers a later scroll');
    const offset = scroll.props.contentOffset;
    const content = scroll.props.children;
    const tile = nodes(content).find(node => node.type === 'Pressable' && node.props.accessibilityState.selected);
    assert.equal(tile.props.accessibilityLabel, `Level ${current + 1}`);
    const position = Object.assign({}, ...tile.props.style({ pressed: false }).filter(Boolean));
    assert.ok(position.top >= offset.y, 'The current tile is visible from the first native commit');
    assert.ok(position.top + position.height <= offset.y + height, 'The current tile is fully inside the viewport');
    assert.ok(offset.y >= 0 && offset.y <= Math.max(0, content.props.style[1].height + scroll.props.contentContainerStyle.paddingBottom - height));
    const halo = nodes(tile).find(node => node.props.scrollOffset);
    assert.equal(halo.props.scrollOffset.get(), offset.y, 'Visibility tracking starts at the same native offset');
    scroll.props.onScroll({ contentOffset: { y: offset.y + 20 } });
    assert.equal(halo.props.scrollOffset.get(), offset.y + 20, 'Manual scrolling remains available after entry');
    const repeatedLayout = viewport;
    root.props.onLayout({ nativeEvent: { layout: { width, height } } });
    assert.equal(viewport, repeatedLayout, 'Unchanged layout does not restart the scroll view');
    const returned = module.exports.TopicLevelPath({ ...props, entryKey: 1 }).props.children;
    assert.notEqual(returned.key, mounted.key, 'Returning from play remounts at the current stop without a scroll command');
    assert.equal(viewport, repeatedLayout, 'Returning reuses the measured viewport');
    cases++;
  }
}
console.log(`Verified ${cases} topic entries: current tile visible on the first native commit, no delayed scroll, narrow/tablet bounds, manual scrolling and immediate return positioning.`);
