import { createContext, useContext, useLayoutEffect } from "react";

/** Visible startup assets can hold the loading cover until their first frame. */
export const StartupVisualContext = createContext<(() => () => void) | null>(null);

export function useStartupVisualReady(ready: boolean) {
  const hold = useContext(StartupVisualContext);
  useLayoutEffect(() => {
    if (!hold || ready) return;
    return hold();
  }, [hold, ready]);
}
