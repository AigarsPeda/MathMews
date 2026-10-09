import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAnimationActivity } from '@/hooks/use-animation-activity';

/** A stalled loader must release startup/room-transition holds too. */
export function SceneLoadGuard({ ready, children }: { ready: boolean; children: ReactNode }) {
  const [expiredWindow, setExpiredWindow] = useState<object>();
  const { active } = useAnimationActivity();
  // Each foreground visit gets its own deadline. A stale timer cannot fail a resumed scene.
  const loadingWindow = useMemo(() => ({ active }), [active]);
  useEffect(() => {
    if (ready || !active) return;
    const timer = setTimeout(() => setExpiredWindow(loadingWindow), 20000);
    return () => clearTimeout(timer);
  }, [active, loadingWindow, ready]);
  if (active && expiredWindow === loadingWindow && !ready) throw new Error('The 3D scene did not become ready within 20 seconds');
  return children;
}
