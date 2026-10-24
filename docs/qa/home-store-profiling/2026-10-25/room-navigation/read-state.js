(() => {
const hook = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  const layoutKeys = ['bedId','roomBedOffset','bedRotationDegrees','bedScale','bedFlipped','placedToys','placedDecorations','roomLayerOrder'];
  function snapshot() {
    const rooms = new Map();
    function scan(f) {
      if (!f) return;
      const p = f.memoizedProps;
      if (p?.savedRoom && p?.homeRoomId && p?.commitRoomEdit) rooms.set(p.homeRoomId, {
        id: p.homeRoomId, visible: p.roomVisible, slide: p.sceneSlide ? {outgoing:p.sceneSlide.outgoing,direction:p.sceneSlide.direction} : null,
        catRoom: p.catHomeRoomId, layout: Object.fromEntries(layoutKeys.map(k => [k,p.savedRoom[k]]))
      });
      scan(f.child); scan(f.sibling);
    }
    for (const [id] of hook.rendererInterfaces) for (const root of hook.getFiberRoots(id)) scan(root.current);
    return [...rooms.values()];
  }

return snapshot();
})()
