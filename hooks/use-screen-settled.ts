import { useAnimationActivity } from "@/hooks/use-animation-activity";
import type { NativeStackNavigationProp } from "expo-router/native-stack";
import { NavigationContext, type ParamListBase } from "expo-router/react-navigation";
import { useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

/** Reveal pending feedback only once the returning native screen is fully visible. */
export function useScreenSettled() {
  const navigation = useContext(NavigationContext) as NativeStackNavigationProp<ParamListBase> | undefined;
  const { active } = useAnimationActivity();
  const [settled, setSettled] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation || Platform.OS === "web") return;
    const blur = navigation.addListener("blur", () => setSettled(false));
    const start = navigation.addListener("transitionStart", () => setSettled(false));
    const end = navigation.addListener("transitionEnd", event => setSettled(!event.data.closing));
    return () => { blur(); start(); end(); };
  }, [navigation]);
  return active && (Platform.OS === "web" || settled);
}
