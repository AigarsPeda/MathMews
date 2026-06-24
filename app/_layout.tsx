import { ExpoUIHost } from "@/components/ui/ExpoUIHost";
import { GameProvider } from "@/contexts/GameProvider";
import { LocaleProvider } from "@/contexts/LocaleProvider";
import { PetVideoProvider } from "@/contexts/PetVideoProvider";
import "@/i18n";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import "react-native-reanimated";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <LocaleProvider>
      <GameProvider>
        <PetVideoProvider>
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
                <Stack.Screen name="puzzles" options={{ headerShown: false }} />
                <Stack.Screen name="play" options={{ headerShown: false }} />
                <Stack.Screen name="settings" options={{ headerShown: false }} />
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
        </PetVideoProvider>
      </GameProvider>
    </LocaleProvider>
  );
}
