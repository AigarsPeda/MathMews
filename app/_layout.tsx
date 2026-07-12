import "@/lib/init-splash-screen";
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
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
