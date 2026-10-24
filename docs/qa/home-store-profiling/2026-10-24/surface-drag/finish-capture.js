(() => { const surface = globalThis.__dragPlacementCapture.finish(); delete globalThis.__dragPlacementCapture;
  return { surface, native: globalThis.__roomDragLatency.finish() }; })()
