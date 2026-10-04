import { AnimatedSplashCat, SplashBackdrop } from "@/components/branding/AnimatedSplashCat";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameColors } from "@/constants/game";
import { useAuth } from "@/contexts/AuthProvider";
import { useGame } from "@/contexts/GameProvider";
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
    if (!canOpen || !showOverlay) return;
    // Let the final status paint before mounting gameplay.
    const timer = setTimeout(() => setShowOverlay(false), 250);
    return () => clearTimeout(timer);
  }, [canOpen, showOverlay]);

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHiddenRef.current) return;
    nativeSplashHiddenRef.current = true;
    // The identical native logo has loaded into the laid-out React view.
    requestAnimationFrame(() => { SplashScreen.hideAsync().catch(() => {}); });
  }, []);

  useEffect(() => {
    if (logoReady && catReady && layoutReady) hideNativeSplash();
  }, [catReady, hideNativeSplash, layoutReady, logoReady]);

  if (!showOverlay) return <>{children}</>;

  const readyAssets = assets.completed - assets.failed;
  const assetFraction = assets.total > 0 ? readyAssets / assets.total : 0;
  // Counts measure asset work; account, local save and cloud checks each occupy
  // a separate stage. A timeout never pretends the remote check succeeded.
  const progress = .7 * assetFraction + .1 * Number(isReady) + .1 * Number(isAuthReady) + .1 * Number(cloudRestoreCheckComplete);

  return (
    <View style={styles.gate}>
      <SplashBackdrop>
        <View style={styles.content} onLayout={() => setLayoutReady(true)} accessible accessibilityRole="header" accessibilityLabel={APP_NAME}>
          <Image source={require("@/assets/images/splash-brand.png")} style={styles.brandingImage} resizeMode="contain" onLoad={() => setLogoReady(true)} />
          <View style={styles.cat}>
            <AnimatedSplashCat size={192} playing={brandingReady} onReady={handleBrandingReady} />
            {!brandingReady ? <Image source={require("@/assets/3d/cat-splash.png")} style={styles.portrait} resizeMode="contain" onLoad={() => setCatReady(true)} /> : null}
          </View>
        </View>
        <View style={styles.loading}>
          <ProgressBar progress={progress} fillColor={GameColors.primary} trackColor={GameColors.cardBorder} accessibilityLabel={t("loading.label")} />
        </View>
      </SplashBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1 },
  content: { width: 240, height: 240, overflow: "hidden" },
  // Image supplies its asset's intrinsic dimensions before applying styles.
  // Absolute-fill offsets alone do not override the 640 px source size.
  brandingImage: { ...StyleSheet.absoluteFill, width: 240, height: 240 },
  portrait: { ...StyleSheet.absoluteFill, width: 192, height: 192 },
  cat: { position: "absolute", left: 24, top: 0, width: 192, height: 192, overflow: "hidden", backgroundColor: GameColors.background },
  loading: { position: "absolute", top: "50%", marginTop: 152, width: "72%", maxWidth: 280 },
});
