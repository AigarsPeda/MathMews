// Account identity must not change while a native checkout is in progress.
let active: 'auth' | 'purchase' | null = null;

export function acquireAccountOperation(kind: 'auth' | 'purchase'): (() => void) | null {
  if (active) return null;
  active = kind;
  let released = false;
  return () => {
    if (!released) { released = true; active = null; }
  };
}

export function isAccountTransitionActive(): boolean { return active === 'auth'; }
