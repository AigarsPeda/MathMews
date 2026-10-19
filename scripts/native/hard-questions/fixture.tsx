/** Temporary review screen using production components without progress or reward writes. */
import { PuzzleCard } from "@/components/puzzle/PuzzleCard";
import { FractionBuildTask } from "@/components/puzzle/FractionBuildTask";
import { TrueFalseTask } from "@/components/puzzle/TrueFalseTask";
import { MultipleChoiceTask } from "@/components/puzzle/MultipleChoiceTask";
import { TargetBuildTask } from "@/components/puzzle/TargetBuildTask";
import { FixMistakeTask } from "@/components/puzzle/FixMistakeTask";
import { EstimateTask } from "@/components/puzzle/EstimateTask";
import { getPuzzlesByDifficulty } from "@/constants/puzzles";
import i18n from "@/i18n";
import type { MathOperator } from "@/types/puzzle";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const tasks = {
  Fractions: "v2-hard-fractions-garden-2", Claims: "v2-hard-logic-clues-2",
  Area: "v2-hard-measurement-area-1", Operations: "v2-hard-operations-connected-2",
  Discount: "v2-hard-percentages-quarters-4", Estimate: "v2-hard-measurement-area-3",
};
function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 12, borderRadius: 12, backgroundColor: "#F3EEFF" }}><Text>{label}</Text></Pressable>;
}
export default function HardQuestionFixture() {
  const router = useRouter();
  const [language] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const [locale, setLocale] = useState<"en" | "lv">("en");
  const [id, setId] = useState(tasks.Fractions);
  const [answered, setAnswered] = useState(false), [correct, setCorrect] = useState(false);
  const [slices, setSlices] = useState<number[]>([]), [selected, setSelected] = useState<number | null>(null);
  const [operators, setOperators] = useState<(MathOperator | null)[]>([null, null]);
  if (!__DEV__) return <Redirect href="/" />;
  const puzzle = getPuzzlesByDifficulty(locale, "hard").find(item => item.id === id)!;
  function reset(next: string) { setId(next); setAnswered(false); setCorrect(false); setSlices([]); setSelected(null); setOperators([null, null]); }
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB" }}>
    <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Hard question review</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(tasks).map(([label, value]) => <Button key={label} label={label} onPress={() => reset(value)} />)}
      </View>
      <PuzzleCard puzzle={puzzle} puzzleNumber={1} puzzleTotal={4} />
      {puzzle.type === "fraction_build" ? <FractionBuildTask puzzle={puzzle} shadedPieces={slices.length} selectedSlices={slices} answered={answered} isCorrect={correct}
        onChangeShaded={count => setSlices(Array.from({ length: count }, (_, index) => index))}
        onToggleSlice={index => setSlices(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])} /> : null}
      {puzzle.type === "true_false" ? <TrueFalseTask puzzle={puzzle} selectedIndex={selected} answered={answered} isCorrect={correct} onSelect={setSelected} /> : null}
      {puzzle.type === "multiple_choice" ? <MultipleChoiceTask puzzle={puzzle} selectedIndex={selected} answered={answered} isCorrect={correct} onSelect={setSelected} /> : null}
      {puzzle.type === "target_build" ? <>
        <Text>{language.t("play.mechanicIntro.target_buildHard")}</Text>
        <TargetBuildTask puzzle={puzzle} selectedOperators={operators} answered={answered} isCorrect={correct} onSelectOperator={(index, value) => setOperators(current => current.map((item, slot) => slot === index ? value : item))} />
      </> : null}
      {puzzle.type === "fix_mistake" ? <FixMistakeTask puzzle={puzzle} selectedIndex={selected} answered={answered} isCorrect={correct} onSelect={setSelected} /> : null}
      {puzzle.type === "estimate" ? <EstimateTask puzzle={puzzle} selectedIndex={selected} answered={answered} isCorrect={correct} onSelect={setSelected} /> : null}
      <Button label="Wrong feedback" onPress={() => { setAnswered(true); setCorrect(false); }} />
      <Button label="Success feedback" onPress={() => { setAnswered(true); setCorrect(true); setSlices([0]); setSelected(1); }} />
      <Button label="Latviski" onPress={() => { setLocale("lv"); void language.changeLanguage("lv"); }} />
      <Button label="English" onPress={() => { setLocale("en"); void language.changeLanguage("en"); }} />
      <Button label="Back to game" onPress={() => router.replace("/")} />
    </ScrollView>
  </SafeAreaView></I18nextProvider>;
}
