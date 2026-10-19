/** Read-only review of revised lessons using the production question and tasks. */
import { PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { PatternNextTask } from "@/components/puzzle/PatternNextTask";
import { FunctionMachineTask } from "@/components/puzzle/FunctionMachineTask";
import { MultipleChoiceTask } from "@/components/puzzle/MultipleChoiceTask";
import { getPuzzlesByDifficulty } from "@/constants/puzzles";
import i18n from "@/i18n";
import { checkPuzzleAnswer } from "@/utils/puzzle-type";
import { Redirect } from "expo-router";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const lessons = { Easy: "easy-patterns-jumps", Hard: "hard-patterns-multiply", "More Hard": "hard-patterns-scale", "Music boss": "easy-patterns-music", "Signal boss": "hard-patterns-signal" };
function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ padding: 12, borderRadius: 12, backgroundColor: "#F3EEFF" }}><Text>{label}</Text></Pressable>;
}
export default function PracticeVarietyFixture() {
  const [language] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const [locale, setLocale] = useState<"en" | "lv">("en");
  const [lesson, setLesson] = useState(lessons.Hard), [step, setStep] = useState(1);
  const [selected, setSelected] = useState<number | null>(null), [answered, setAnswered] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  const difficulty = lesson.startsWith("easy") ? "easy" : "hard";
  const total = lesson.endsWith("music") || lesson.endsWith("signal") ? 3 : 4;
  const puzzle = getPuzzlesByDifficulty(locale, difficulty).find(p => p.id === `v2-${lesson}-${step}`)!;
  const correct = selected !== null && checkPuzzleAnswer(puzzle, { kind: "choice", index: selected });
  const props = { selectedIndex: selected, onSelect: setSelected, answered, isCorrect: correct };
  function reset(next = step) { setStep(next); setSelected(null); setAnswered(false); }
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB" }}>
    <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Practice variety review</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(lessons).map(([label, id]) => <Button key={id} label={label} onPress={() => { setLesson(id); reset(1); }} />)}
        <Button label="Latviski" onPress={() => { setLocale("lv"); void language.changeLanguage("lv"); }} />
        <Button label="English" onPress={() => { setLocale("en"); void language.changeLanguage("en"); }} />
      </View>
      <PuzzleCard puzzle={puzzle} puzzleNumber={step} puzzleTotal={total} />
      {puzzle.type === "pattern_next" ? <PatternNextTask puzzle={puzzle} {...props} /> : null}
      {puzzle.type === "function_machine" ? <FunctionMachineTask puzzle={puzzle} {...props} /> : null}
      {puzzle.type === "multiple_choice" ? <MultipleChoiceTask puzzle={puzzle} {...props} /> : null}
      {answered ? <Text>{correct ? "Correct answer" : "Try another answer"}</Text> : null}
      <Button label="Check" disabled={selected === null || answered} onPress={() => setAnswered(true)} />
      <Button label="Next activity" disabled={!answered || !correct || step === total} onPress={() => reset(step + 1)} />
    </ScrollView>
  </SafeAreaView></I18nextProvider>;
}
