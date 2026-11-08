/** Validate level routes, lesson callouts and narrow-screen bounds. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/topic-path-layout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports });
const { getTopicPathLayout, getTopicPathConnection, getTopicPathCallout } = module.exports;
let cases = 0;
const topics = [...new Set(JSON.parse(fs.readFileSync('data/puzzle-curriculum.json', 'utf8')).lessons.map(lesson => lesson.topicId))];
for (const width of [232, 320, 390, 460]) {
  const shapes = topics.map(topic => {
    const { points, finish } = getTopicPathLayout(width, 10, -1, topic);
    const gaps = points.slice(1).map((point, index) => point.y - points[index].y);
    // Cat plans have three stops; the full topic trails include longer loops.
    if (topic !== 'cat-plans') {
      assert.ok(new Set(gaps).size >= 3, 'Each trail mixes short hops and longer stretches');
      assert.ok(gaps.some(gap => gap >= 320), 'Each topic includes winding stretches');
      assert.ok(gaps.some(gap => gap < 300), 'Winding stretches leave room for simpler connections');
      const windingIndex = gaps.findIndex(gap => gap >= 320);
      const winding = getTopicPathConnection(width, points[windingIndex], points[windingIndex + 1], topic);
      assert.ok((winding.match(/ Q /g) ?? []).length >= 6, 'Long stretches have extra rounded turns');
    }
    return [...points.slice(1), finish].map((to, index) => getTopicPathConnection(width, points[index], to, topic)).join(' ');
  });
  assert.equal(new Set(shapes).size, topics.length, 'Every topic has a distinct trail, including on narrow screens');
}
for (const topic of topics) for (const width of [232, 276, 299, 300, 320, 360, 390, 460]) for (const count of [0, 1, 3, 10, 40]) for (let current = -1; current < count; current++) {
  const { points, height, finish } = getTopicPathLayout(width, count, current, topic);
  const caption = current >= 0 ? getTopicPathCallout(width, points[current]) : undefined;
  if (finish) {
    assert.ok(finish.y > points.at(-1).y + points.at(-1).radius + 60);
    assert.ok(finish.y + 60 < height, 'Finish label remains reachable above the fixed action');
  }
  const baseline = getTopicPathLayout(width, count, -1, topic).points;
  points.forEach((point, index) => {
    assert.equal(point.x, baseline[index].x); assert.equal(point.y, baseline[index].y);
    assert.ok(point.x - point.radius >= 12 && point.x + point.radius <= width - 12);
    if (index) assert.ok(point.y - point.radius >= points[index-1].y + points[index-1].radius + 24);
    if (caption) assert.ok(caption.left + caption.width <= point.x - point.radius
      || caption.left >= point.x + point.radius || caption.top + caption.height <= point.y - point.radius
      || caption.top >= point.y + point.radius, 'Lesson caption never overlaps a playable tile');
  });
  if (caption) assert.ok(caption.left >= 0 && caption.left + caption.width <= width);
  for (const [index, destination] of [...points.slice(1), ...(finish ? [finish] : [])].entries()) {
    const source = points[index];
    const route = getTopicPathConnection(width, source, destination, topic);
    assert.ok(!/NaN|Infinity/.test(route));
    const coordinates = route.match(/-?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?/g).map(Number);
    let previousY = source.y;
    for (let i = 0; i < coordinates.length; i += 2) {
      const x = coordinates[i], y = coordinates[i + 1];
      assert.ok(x >= 0 && x <= width, 'Route stays inside the viewport');
      assert.ok(y >= previousY && y <= destination.y, 'Route never doubles back or crosses itself');
      previousY = y;
    }
    if (caption && count === 10 && source.y <= caption.top + caption.height && destination.y >= caption.top) {
      const tokens = route.split(' ');
      let previous;
      for (let i = 0; i < tokens.length;) {
        const command = tokens[i++];
        const control = { x: Number(tokens[i++]), y: Number(tokens[i++]) };
        if (command === 'M') { previous = control; continue; }
        const end = command === 'Q' ? { x: Number(tokens[i++]), y: Number(tokens[i++]) } : control;
        for (let step = 0; step <= 40; step++) {
          const t = step / 40, u = 1 - t;
          const x = command === 'Q' ? u*u*previous.x + 2*u*t*control.x + t*t*end.x : u*previous.x + t*end.x;
          const y = command === 'Q' ? u*u*previous.y + 2*u*t*control.y + t*t*end.y : u*previous.y + t*end.y;
          assert.ok(x <= caption.left - 2 || x >= caption.left + caption.width + 2
            || y <= caption.top - 2 || y >= caption.top + caption.height + 2,
          `${topic} at ${width}: the road stays clear of the lesson title`);
        }
        previous = end;
      }
    }
  }
  cases++;
}
console.log(`Verified ${cases} route layouts across ${topics.length} distinct topics.`);
