/** Copied into app/ only for the native UI test, then removed by its runner. */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { OrderNumbersTask } from "@/components/puzzle/OrderNumbersTask";
import { PuzzleProgress } from "@/components/puzzle/PuzzleProgress";
import { moveOrderTile } from "@/utils/puzzle-drag";
import { ChallengeTask } from "@/components/puzzle/ChallengeTasks";
import { getPuzzlesByDifficulty } from "@/constants/puzzles";
import { isOptionalChallengePuzzle, type ChallengeAnswer } from "@/utils/challenge-puzzles";
import { asOrderNumbersPuzzle, checkPuzzleAnswer } from "@/utils/puzzle-type";

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
  const [order, setOrder] = useState([1, 6, 8, 3]);
  const [challengeAnswer, setChallengeAnswer] = useState<ChallengeAnswer | null>(null);
  const [result, setResult] = useState("");
  const [completed, setCompleted] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [lastMove, setLastMove] = useState("");
  const puzzle = getPuzzlesByDifficulty("en", "easy").find(p => p.type === mode);
  const orderPuzzle = puzzle && asOrderNumbersPuzzle(puzzle);
  if (!__DEV__ || !puzzle || (!isOptionalChallengePuzzle(puzzle) && !orderPuzzle)) return <Redirect href="/" />;
  function reset(next = mode) {
    setOrder([1, 6, 8, 3]); setMode(next); setAnswered(false); setResult(""); setMoveCount(0); setLastMove(""); setRevision(n => n + 1);
  }
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB" }}>
    <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button label="Back to game" onPress={() => router.replace("/")} />
        <Button label="Sorting" onPress={() => reset("sort_buckets")} />
        <Button label="Order" onPress={() => reset("order_numbers")} />
        <Button label="Pattern" onPress={() => reset("repair_pattern")} />
      </View>
      <Text style={{ fontSize: 25, fontWeight: "800", color: "#2D3436" }}>Native drag check</Text>
      <PuzzleProgress steps={Array.from({ length: 4 }, (_, index) => index < completed)} label="Puzzle progress" />
      {orderPuzzle ? <OrderNumbersTask key={mode + revision}
        puzzle={{ ...orderPuzzle, payload: { numbers: [1, 6, 8, 3], correctOrder: [1, 3, 6, 8] } }}
        order={order} answered={answered} isCorrect={result === "Correct"} onDragStateChange={setDragging}
        onMove={(from, to) => { setMoveCount(count => count + 1); setLastMove(`Move ${from} to ${to}`); setOrder(current => moveOrderTile(current, from, to)); }}
        onSwap={(from, to) => setOrder(current => current.map((number, index) => index === from ? current[to] : index === to ? current[from] : number))}
      /> : isOptionalChallengePuzzle(puzzle) ? <ChallengeTask key={mode + revision} puzzle={puzzle} answered={answered} onDragStateChange={setDragging}
        onAnswerChange={setChallengeAnswer} /> : null}
      <Button label={orderPuzzle ? "Check answer" : mode === "sort_buckets" ? "Check sorting" : mode === "repair_pattern" ? "Check pattern" : "Check answer"} onPress={() => {
        const correct = orderPuzzle ? order.every((number, index) => number === [1,3,6,8][index]) : challengeAnswer !== null && checkPuzzleAnswer(puzzle, challengeAnswer);
        setResult(correct ? "Correct" : "Try again"); setAnswered(true);
      }} />
      <Text accessibilityLiveRegion="polite">{result}</Text>
      {orderPuzzle ? <Text>{`Moves ${moveCount}. ${lastMove}`}</Text> : null}
      <Button label="Retry" onPress={() => { setAnswered(false); setResult(""); }} />
      <Button label="Reset board" onPress={() => reset()} />
      <Button label="Fill progress" onPress={() => setCompleted(count => Math.min(4, count + 1))} />
      <Text>{`Completed ${completed} of 4`}</Text>
      <View style={{ height: 200 }} />
    </ScrollView>
  </SafeAreaView></I18nextProvider>;
}
