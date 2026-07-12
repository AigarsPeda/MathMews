import { useEffect, useRef } from "react";

/** Avoid setState after unmount from timers and async image callbacks. */
export function useIsMounted() {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}
