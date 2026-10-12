/** Inspect the shipped animation channels, including contact, landing and cleanup. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const counts = { feedingTile: 6, feedingPebble: 6, foodTrailTray: 9, kibbleDispenser: 8, lickingPad: 6 };
const [frames, fps] = JSON.parse(fs.readFileSync('scripts/3d/clips.json')).eating;
for (const [id, count] of Object.entries(counts)) {
  const bytes = fs.readFileSync(`assets/3d/native/${id}-eating-effect.glb`);
  const length = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.subarray(20, 20 + length));
  const binary = bytes.subarray(28 + length);
  const values = index => {
    const accessor = model.accessors[index], view = model.bufferViews[accessor.bufferView];
    const width = accessor.type === 'VEC3' ? 3 : accessor.type === 'VEC4' ? 4 : 1;
    assert.equal(accessor.componentType, 5126);
    return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: width }, (_, axis) =>
      binary.readFloatLE((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + i * (view.byteStride ?? width * 4) + axis * 4)));
  };
  assert.equal(model.meshes.length, count, `${id}: only the effect, without another feeder`);
  assert.equal(model.animations.length, 1);
  const clip = model.animations[0];
  assert.equal(Math.max(...clip.samplers.map(s => model.accessors[s.input].max[0])), frames / fps);
  const births = [], origins = [];
  for (const node of model.nodes.filter(node => node.mesh !== undefined)) {
    const channels = clip.channels.filter(channel => channel.target.node === model.nodes.indexOf(node));
    const sampler = kind => {
      const channel = channels.find(channel => channel.target.path === kind);
      return channel ? clip.samplers[channel.sampler] : undefined;
    };
    const translations = values(sampler('translation').output);
    const sizes = values(sampler('scale').output), times = values(sampler('scale').input);
    const rotation = sampler('rotation');
    for (const rows of [translations, sizes, rotation ? values(rotation.output) : [node.rotation ?? [0, 0, 0, 1]]])
      assert.ok(rows.flat().every(Number.isFinite), `${id}: finite transforms throughout the meal`);
    assert.ok(sizes[0].every(v => v === 0) && sizes.at(-1).every(v => v === 0), `${id}: invisible before and after eating`);
    const visible = sizes.findIndex(size => size[0] > 0);
    const first = times[visible][0];
    births.push(first); origins.push(translations[0]);
    assert.ok(first >= 1 && first <= 3.2, `${id}: begins after muzzle contact`);
    assert.ok(sizes.some(size => size[0] > .025), `${id}: visible food motion`);
    const end = translations.at(-1);
    if (id === 'lickingPad' && node.name.startsWith('Food smear')) {
      assert.ok(translations.every(p => Math.abs(p[0]) < .3 && Math.abs(p[2]) < .27 && p[1] > .063), 'Smears stay within the pad grooves');
      assert.ok(end[0] - translations[0][0] > .08, 'A lick spreads food along the groove');
      assert.ok(Math.max(...sizes.map(size => size[0])) > .10, 'Smears stretch rather than bounce');
    } else {
      assert.ok(end[1] >= .006 && end[1] <= .04, `${id}: lands at floor height`);
      assert.ok(Math.max(...translations.map(p => p[1])) > translations[0][1] + .025, `${id}: visible flight before landing`);
      if (id === 'feedingTile') {
        assert.ok(Math.max(Math.abs(end[0]), Math.abs(end[2])) > .4, 'Wet splashes land beyond the tile edge');
        const settled = sizes.findIndex((size, i) => size[0] > .06 && translations[i][1] < .01);
        assert.ok(settled >= 0 && sizes[settled][1] < .006, 'Wet droplets flatten into floor splats');
      } else if (id === 'lickingPad') {
        assert.ok(end[0] > .4 && Math.abs(end[2]) < .2, 'A tiny wet flick clears the pad lip');
        assert.ok(sizes.some(size => size[0] > .03 && size[1] < .006), 'Pad flicks flatten when they land');
      } else if (id === 'feedingPebble') {
        assert.ok((end[0] / .42) ** 2 + (end[2] / .35) ** 2 > 1, 'Crumbs clear the pebble rim');
      } else if (id === 'foodTrailTray') {
        assert.ok(Math.abs(end[2]) > .3, 'Crumbs fall off the tray');
      } else {
        assert.ok(Math.abs(translations[0][0]) < .025 && Math.abs(translations[0][2] - .185) < 1e-6, 'Dispenser spills start at its outlet');
        assert.ok(end[2] > .4, 'Dispenser kibble rolls forward');
      }
    }
  }
  assert.ok(Math.min(...births) <= 1.1 && Math.max(...births) - Math.min(...births) > .8, `${id}: several eating beats, not one simultaneous burst`);
  if (id === 'foodTrailTray') assert.equal(new Set(origins.map(p => p[0].toFixed(2))).size, 3, 'Each feeding spot sheds crumbs');
}
console.log('Verified five distinct eating effects: muzzle timing, splashes and smears, dispenser outlet, three tray spots, floor landings and cleanup.');
