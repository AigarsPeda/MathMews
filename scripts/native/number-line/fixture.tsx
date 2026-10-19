/** Real number-line touch targets; no game progress or preferences are saved. */
import { NumberLineTask } from "@/components/puzzle/NumberLineTask";
import { getPuzzlesByDifficulty } from "@/constants/puzzles";
import i18n from "@/i18n";
import { Redirect } from "expo-router";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NumberLineFixture() {
  const [language] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const [wide, setWide] = useState(false);
  const [value, setValue] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [taps, setTaps] = useState(0);
  const puzzle = getPuzzlesByDifficulty("en", "easy").find(p => p.type === "number_line");
  if (!__DEV__ || puzzle?.type !== "number_line") return <Redirect href="/" />;
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB", padding: 20, gap: 20 }}>
    <Text style={{ fontSize: 22, fontWeight: "800" }}>Number line touch check</Text>
    <NumberLineTask key={String(wide)} puzzle={{ ...puzzle, payload: wide
      ? { min: -2, max: 15, start: 12, jump: -3, correctValue: 9 }
      : { min: 2, max: 8, start: 8, jump: -3, correctValue: 5 } }}
      selectedValue={value} answered={locked} isCorrect={false} onSelectValue={next => { setValue(next); setTaps(count => count + 1); }} />
    <Text accessibilityLiveRegion="polite">{`Selected ${value ?? (wide ? 12 : 8)}`}</Text>
    <Text>{`Changes ${taps}`}</Text>
    <View style={{ gap: 16 }}>
      <Pressable accessibilityRole="button" onPress={() => setLocked(true)} style={{ padding: 16 }}><Text>Lock answer</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setWide(true); setValue(null); setLocked(false); setTaps(0); }} style={{ padding: 16 }}><Text>Wide range</Text></Pressable>
    </View>
  </SafeAreaView></I18nextProvider>;
}
