import {
  AnimatedSplashCat,
  SplashBackdrop,
} from "@/components/branding/AnimatedSplashCat";
import { GameColors } from "@/constants/game";
import { useGame } from "@/contexts/GameProvider";
import { moderateScale } from "@/utils/scale";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";

const MIN_SPLASH_MS = 3400;
const APP_NAME = Constants.expoConfig?.name ?? "Math Mews";

type SplashGateProps = {
  children: ReactNode;
};

export function SplashGate({ children }: SplashGateProps) {
  const { isReady } = useGame();
  const [showOverlay, setShowOverlay] = useState(true);
  const [brandingReady, setBrandingReady] = useState(false);
  const nativeSplashHiddenRef = useRef(false);
  const handleBrandingReady = useCallback(() => {
    setBrandingReady(true);
  }, []);

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHiddenRef.current) return;
    nativeSplashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useLayoutEffect(() => {
    if (!isReady || !brandingReady) return;

    const timer = setTimeout(() => {
      setShowOverlay(false);
    }, MIN_SPLASH_MS);

    return () => clearTimeout(timer);
  }, [brandingReady, isReady]);

  if (showOverlay) {
    return (
      <View style={styles.gate}>
        <SplashBackdrop onLayout={hideNativeSplash}>
          <View
            style={[styles.content, !brandingReady && styles.contentHidden]}
          >
            <AnimatedSplashCat onReady={handleBrandingReady} />
            {brandingReady ? (
              <Text style={styles.title} accessibilityRole="header">
                {APP_NAME}
              </Text>
            ) : null}
          </View>
        </SplashBackdrop>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    gap: moderateScale(16),
  },
  contentHidden: {
    opacity: 0,
  },
  title: {
    fontWeight: "800",
    textAlign: "center",
    color: GameColors.text,
    fontSize: moderateScale(32),
    letterSpacing: moderateScale(0.5),
  },
});
