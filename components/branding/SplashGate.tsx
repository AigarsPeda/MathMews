import { AnimatedSplashCat, SplashBackdrop } from "@/components/branding/AnimatedSplashCat";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameColors } from "@/constants/game";
import { useAuth } from "@/contexts/AuthProvider";
import { useGame } from "@/contexts/GameProvider";
import { StartupVisualContext } from "@/contexts/StartupVisualContext";
import { getGameAssetLoadingSnapshot, subscribeGameAssetLoading } from "@/lib/init-game-asset-prefetch";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, View } from "react-native";

const MIN_SPLASH_MS = 1_200;
const DATA_MAX_WAIT_MS = 12_000;
const APP_NAME = Constants.expoConfig?.name ?? "Math Mews";

export function SplashGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isReady, cloudRestoreCheckComplete } = useGame();
  const { isAuthReady } = useAuth();
  const assets = useSyncExternalStore(subscribeGameAssetLoading, getGameAssetLoadingSnapshot, getGameAssetLoadingSnapshot);
  const [showOverlay, setShowOverlay] = useState(true);
  const [mountGame, setMountGame] = useState(false);
  const [gameLaidOut, setGameLaidOut] = useState(false);
  const [pendingVisuals, setPendingVisuals] = useState(0);
  const [visualWaitElapsed, setVisualWaitElapsed] = useState(false);
  const [brandingReady, setBrandingReady] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [catReady, setCatReady] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [dataWaitElapsed, setDataWaitElapsed] = useState(false);
  const nativeSplashHiddenRef = useRef(false);
  const handleBrandingReady = useCallback(() => {
    setBrandingReady(true);
    setCatReady(true);
  }, []);

  useEffect(() => {
    const minimum = setTimeout(() => setMinimumElapsed(true), MIN_SPLASH_MS);
    const deadline = setTimeout(() => setDataWaitElapsed(true), DATA_MAX_WAIT_MS);
    return () => { clearTimeout(minimum); clearTimeout(deadline); };
  }, []);

  const dataComplete = isAuthReady && cloudRestoreCheckComplete;
  const canOpen = logoReady && catReady && layoutReady && isReady && assets.mayContinue && (dataComplete || dataWaitElapsed) && minimumElapsed;
  useEffect(() => {
    if (!canOpen || mountGame) return;
    // Mount beneath the opaque loading screen before revealing gameplay.
    const timer = setTimeout(() => setMountGame(true), 250);
    return () => clearTimeout(timer);
  }, [canOpen, mountGame]);

  const handleGameLayout = useCallback(() => setGameLaidOut(true), []);
  const holdVisual = useCallback(() => {
    setPendingVisuals(count => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setPendingVisuals(count => count - 1);
    };
  }, []);

  useEffect(() => {
    if (!mountGame) return;
    const deadline = setTimeout(() => setVisualWaitElapsed(true), DATA_MAX_WAIT_MS);
    return () => clearTimeout(deadline);
  }, [mountGame]);

  useEffect(() => {
    if (!logoReady || !catReady || !layoutReady || nativeSplashHiddenRef.current) return;
    // Image decode and layout can arrive before Fabric has painted. Keep the
    // native cover through a drawing turn of the full opaque React screen.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        nativeSplashHiddenRef.current = true;
        SplashScreen.hideAsync().catch(() => {});
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [catReady, layoutReady, logoReady]);

  useEffect(() => {
    if (!mountGame || !gameLaidOut || !showOverlay || (pendingVisuals > 0 && !visualWaitElapsed)) return;
    // Retain the loading cover while the navigator's initial native layout
    // paints. The parent stays mounted during both startup handoffs.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setShowOverlay(false));
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [gameLaidOut, mountGame, pendingVisuals, showOverlay, visualWaitElapsed]);

  const readyAssets = assets.completed - assets.failed;
  const assetFraction = assets.total > 0 ? readyAssets / assets.total : 0;
  // Counts measure asset work; account, local save and cloud checks each occupy
  // a separate stage. A timeout never pretends the remote check succeeded.
  const progress = .7 * assetFraction + .1 * Number(isReady) + .1 * Number(isAuthReady) + .1 * Number(cloudRestoreCheckComplete);

  return (
    <View style={styles.gate} onLayout={() => setLayoutReady(true)}>
      {mountGame ? (
        <View style={styles.game} onLayout={handleGameLayout} accessibilityElementsHidden={showOverlay}
          importantForAccessibility={showOverlay ? "no-hide-descendants" : "auto"} pointerEvents={showOverlay ? "none" : "auto"}>
          <StartupVisualContext.Provider value={showOverlay ? holdVisual : null}>{children}</StartupVisualContext.Provider>
        </View>
      ) : null}
      {showOverlay ? (
        <View style={styles.overlay} accessibilityViewIsModal>
          <SplashBackdrop>
            <View style={styles.content} accessible accessibilityRole="header" accessibilityLabel={APP_NAME}>
              <Image source={require("@/assets/images/splash-brand.png")} style={styles.brandingImage} resizeMode="contain" onLoad={() => setLogoReady(true)} />
              <View style={styles.cat}>
                <AnimatedSplashCat size={192} playing={brandingReady} onReady={handleBrandingReady} />
                {!brandingReady ? <Image source={require("@/assets/3d/cat-splash.png")} style={styles.portrait} resizeMode="contain" onLoad={() => setCatReady(true)} /> : null}
              </View>
            </View>
            <View style={styles.loading}>
              <ProgressBar progress={progress} style={styles.progressBar} fillColor={GameColors.primary} trackColor={GameColors.cardBorder} accessibilityLabel={t("loading.label")} />
            </View>
          </SplashBackdrop>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, backgroundColor: GameColors.background },
  game: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: GameColors.background, zIndex: 1 },
  content: { width: 240, height: 240, overflow: "hidden" },
  // Image supplies its asset's intrinsic dimensions before applying styles.
  // Absolute-fill offsets alone do not override the 640 px source size.
  brandingImage: { ...StyleSheet.absoluteFill, width: 240, height: 240 },
  portrait: { ...StyleSheet.absoluteFill, width: 192, height: 192 },
  cat: { position: "absolute", left: 24, top: 0, width: 192, height: 192, overflow: "hidden", backgroundColor: GameColors.background },
  loading: { position: "absolute", top: "50%", marginTop: 152, width: 240 },
  progressBar: { height: 8, borderRadius: 4 },
});
