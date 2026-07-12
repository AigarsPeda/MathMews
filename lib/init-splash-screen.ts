import * as SplashScreen from "expo-splash-screen";

/** Hide native splash instantly once our React splash has painted. */
SplashScreen.setOptions({
  duration: 0,
  fade: false,
});

SplashScreen.preventAutoHideAsync().catch(() => {});
