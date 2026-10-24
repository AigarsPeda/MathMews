(() => { if (!globalThis.__roomDragLatency) throw new Error('Drag latency probe is not installed'); globalThis.__roomDragLatency.start(); return 'Native drag measurement enabled'; })()
