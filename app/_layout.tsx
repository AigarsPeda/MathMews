import "@/lib/init-splash-screen";
import "@/lib/init-game-asset-prefetch";
import "@/components/branding/AnimatedSplashCat";
import { SplashGate } from "@/components/branding/SplashGate";
import { ExpoUIHost } from "@/components/ui/ExpoUIHost";
import { AuthProvider } from "@/contexts/AuthProvider";
import { GameProvider } from "@/contexts/GameProvider";
import { IAPProvider } from "@/contexts/IAPProvider";
import { LocaleProvider } from "@/contexts/LocaleProvider";
import { PetDisplayProvider } from "@/pet-display/PetDisplayProvider";
import "@/i18n";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Dimensions, View, useColorScheme } from "react-native";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

// The scene may start React before UIKit reports safe-area measurements.
// Render the loading screen immediately; native measurements update afterward.
const INITIAL_SAFE_AREA = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: Dimensions.get("window").width, height: Dimensions.get("window").height },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={INITIAL_SAFE_AREA}>
      <LocaleProvider>
        <AuthProvider>
        <GameProvider>
          <SplashGate>
            <IAPProvider>
            <PetDisplayProvider>
              <ExpoUIHost>
                <ThemeProvider
                  value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                >
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: "slide_from_right",
                      gestureEnabled: true,
                      gestureDirection: "horizontal",
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="puzzles"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen name="play" options={{ headerShown: false }} />
                    <Stack.Screen name="stats" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="settings"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen name="store" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="onboarding/name-pet"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="modal"
                      options={{ presentation: "modal", title: "Modal" }}
                    />
                  </Stack>
                  <StatusBar style="auto" />
                </ThemeProvider>
              </ExpoUIHost>
            </PetDisplayProvider>
            </IAPProvider>
          </SplashGate>
        </GameProvider>
        </AuthProvider>
    </LocaleProvider>
      </SafeAreaProvider>
    </View>
  );
}
