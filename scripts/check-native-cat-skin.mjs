/** Check the actual mobile GLB, rather than only the Blender authoring objects. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const coat of ['orange', 'grey', 'white']) {
  const file = fs.readFileSync(`assets/3d/native/cat-${coat}.glb`);
  const jsonLength = file.readUInt32LE(12);
  const model = JSON.parse(file.subarray(20, 20 + jsonLength));
  const binary = file.subarray(28 + jsonLength);
  function accessor(index) {
    const a = model.accessors[index], view = model.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const [bytes, read] = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] }[a.componentType];
    const stride = view.byteStride ?? bytes * size, offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, j) => binary[read](offset + i * stride + j * bytes)));
  }
  const node = model.nodes.find(n => n.name === 'Game cat skin');
  assert.ok(node, `${coat}: a single connected body skin is exported`);
  const mesh = model.meshes[node.mesh];
  assert.equal(mesh.primitives.length, 1, 'One continuous coat surface');
  const primitive = mesh.primitives[0], positions = accessor(primitive.attributes.POSITION);
  const weights = accessor(primitive.attributes.WEIGHTS_0), joints = accessor(primitive.attributes.JOINTS_0);
  for (let i = 0; i < weights.length; i++) {
    assert.ok(Math.abs(weights[i].reduce((a, b) => a + b, 0) - 1) < 1e-5, `${coat}: normalized skin weights`);
    assert.ok(joints[i].every(j => j < model.skins[node.skin].joints.length));
    const stable = joints[i][weights[i].indexOf(Math.max(...weights[i]))];
    weights[i].forEach((weight, k) => {
      if (weight === 0) assert.equal(joints[i][k], stable, 'Unused influence slots never reference hidden prop bones');
    });
  }
  // GLB splits vertices at attribute seams; weld their positions for topology.
  const welded = new Map(), ids = positions.map(p => {
    const key = p.map(v => Math.round(v * 100000)).join(',');
    if (!welded.has(key)) welded.set(key, welded.size);
    return welded.get(key);
  });
  const edges = new Map(), adjacent = Array.from({ length: welded.size }, () => new Set());
  const indices = accessor(primitive.indices).flat();
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3).map(index => ids[index]);
    if (new Set(triangle).size < 3) continue;
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);adjacent[a].add(b);adjacent[b].add(a);
    }
  }
  assert.ok([...edges.values()].every(count => count === 2), `${coat}: no open seams or internal branching faces`);
  const visited = new Set(), components = [];
  for (let id = 0; id < welded.size; id++) {
    if (visited.has(id)) continue;
    const component = new Set([id]), pending = [id]; visited.add(id);
    while (pending.length) for (const next of adjacent[pending.pop()]) if (!visited.has(next)) {
      visited.add(next); component.add(next); pending.push(next);
    }
    components.push(component);
  }
  components.sort((a,b) => b.size-a.size);
  const body = components[0], bodyJoints = new Set();
  assert.ok(body.size > welded.size*.75, `${coat}: the torso is a continuous main skin`);
  const jointNames = model.skins[node.skin].joints.map(index => model.nodes[index].name);
  for (let i = 0; i < ids.length; i++) {
    if (body.has(ids[i])) weights[i].forEach((weight,k) => { if (weight > .01) bodyJoints.add(jointNames[joints[i][k]]); });
    else weights[i].forEach((weight,k) => {
      if (weight > .01) assert.ok(['head','neck'].includes(jointNames[joints[i][k]]), 'Separate ear/nose inserts stay attached to the head');
    });
  }
  for (const joint of ['spine','head','neck','L.forelegjoint0','R.forelegjoint0','L.hindlegjoint0','R.hindlegjoint0','tailjoint0'])
    assert.ok(bodyJoints.has(joint), `${coat}: ${joint} deforms the same connected body`);
  const named = new Map(model.nodes.map((n, i) => [n.name, i]));
  for (const [parent, child] of [['spine', 'chest'], ['chest', 'neck'], ['neck', 'head'], ['chest', 'L.forelegjoint0'], ['pelvis', 'L.hindlegjoint0'], ['L.forelegjoint1', 'L.front.paw'], ['spine', 'tailjoint0']]) {
    assert.ok(model.nodes[named.get(parent)]?.children?.includes(named.get(child)), `${coat}: anatomical ${parent} → ${child} hierarchy`);
  }
  console.log(`${coat}: connected body and sealed ear inserts, ${welded.size} vertices, safe normalized four-joint weights and anatomical hierarchy.`);
}
