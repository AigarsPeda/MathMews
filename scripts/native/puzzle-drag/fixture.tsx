/** Copied into app/ only for the native UI test, then removed by its runner. */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { ChallengeTask } from "@/components/puzzle/ChallengeTasks";
import { getPuzzlesByDifficulty } from "@/constants/puzzles";
import { isOptionalChallengePuzzle } from "@/utils/challenge-puzzles";
import { checkPuzzleAnswer } from "@/utils/puzzle-type";

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ padding: 12, backgroundColor: "#F3EEFF", borderRadius: 12 }}><Text>{label}</Text></Pressable>;
}

export default function NativeDragFixture() {
  const router = useRouter();
  // English test selectors without changing the user's saved language.
  const [language] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const [mode, setMode] = useState("sort_buckets");
  const [revision, setRevision] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState("");
  const puzzle = getPuzzlesByDifficulty("en", "easy").find(p => p.type === mode);
  if (!__DEV__ || !puzzle || !isOptionalChallengePuzzle(puzzle)) return <Redirect href="/" />;
  function reset(next = mode) {
    setMode(next); setAnswered(false); setResult(""); setRevision(n => n + 1);
  }
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB" }}>
    <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button label="Back to game" onPress={() => router.replace("/")} />
        <Button label="Sorting" onPress={() => reset("sort_buckets")} />
        <Button label="Pattern" onPress={() => reset("repair_pattern")} />
      </View>
      <Text style={{ fontSize: 25, fontWeight: "800", color: "#2D3436" }}>Native drag check</Text>
      <ChallengeTask key={mode + revision} puzzle={puzzle} answered={answered} onDragStateChange={setDragging}
        onSubmit={answer => { setResult(checkPuzzleAnswer(puzzle, answer) ? "Correct" : "Try again"); setAnswered(true); }} />
      <Text accessibilityLiveRegion="polite">{result}</Text>
      <Button label="Retry" onPress={() => { setAnswered(false); setResult(""); }} />
      <Button label="Reset board" onPress={() => reset()} />
      <View style={{ height: 200 }} />
    </ScrollView>
  </SafeAreaView></I18nextProvider>;
}
