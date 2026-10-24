(() => {
  const module = name => __r([...__r.getModules()].find(([id, m]) => m.verboseName === name)[0]);
  const surface = module('utils/room-drag-placement.ts');
  const { roomItemAnchor } = module('utils/room-item-placement.ts');
  const original = surface.createRoomDragPlacement, samples = [];
  let gesture = 0;
  surface.createRoomDragPlacement = (...args) => {
    const resolve = original(...args), id = ++gesture;
    if (!resolve) return resolve;
    return point => {
      const result = resolve(point), anchor = roomItemAnchor(result.object, args[2]);
      if (samples.length < 2000) samples.push({ gesture: id, item: args[0].instanceId, model: args[0].modelId, at: Date.now(), requested: { ...point }, anchor,
        error: Math.hypot(anchor.x - point.x, anchor.y - point.y), support: result.object.supportId,
        unsupported: result.unsupportedSurfaceId, height: result.object.min[1] });
      return result;
    };
  };
  globalThis.__dragPlacementCapture = { finish() { surface.createRoomDragPlacement = original; return samples; } };
  globalThis.__roomDragLatency.start();
  return 'Surface and native latency capture started';
})()
