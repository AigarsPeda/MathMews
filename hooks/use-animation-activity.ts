import { NavigationContext } from "expo-router/react-navigation";
import { useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState } from "react-native";

/** Pause covered screens/background work and respond to the system motion setting. */
export function useAnimationActivity() {
  const navigation = useContext(NavigationContext);
  const subscribe = useCallback((notify: () => void) => {
    if (!navigation) return () => {};
    const focus = navigation.addListener("focus", notify);
    const blur = navigation.addListener("blur", notify);
    return () => {
      focus();
      blur();
    };
  }, [navigation]);
  const focused = useSyncExternalStore(subscribe, () => navigation?.isFocused() ?? true, () => true);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    const app = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, []);
  return { active: foreground && focused, reduceMotion };
}
