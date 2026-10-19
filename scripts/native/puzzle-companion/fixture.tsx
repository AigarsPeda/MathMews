/** Temporary character-moment checks. No answers, rewards or preferences are saved. */
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import { useGame } from "@/contexts/GameProvider";
import i18n from "@/i18n";
import { getPuzzleCompanionMessage } from "@/utils/puzzle-companion";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Pressable, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Scenario = "progress" | "retry" | "boss" | "latvian" | "long" | "stage";
function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 16, borderRadius: 12, backgroundColor: "#E3FAF7" }}><Text>{label}</Text></Pressable>;
}
export default function CompanionFixture() {
  const { puzzle = "1" } = useLocalSearchParams<{ puzzle?: string }>();
  return <CompanionPage key={puzzle} pageNumber={Number(puzzle)} />;
}
function CompanionPage({ pageNumber }: { pageNumber: number }) {
  const router = useRouter();
  const { pet } = useGame();
  const [english] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const [latvian] = useState(() => i18n.cloneInstance({ lng: "lv" }));
  const [scenario, setScenario] = useState<Scenario>("progress");
  const [visible, setVisible] = useState(false);
  const [continued, setContinued] = useState(0);
  const [home, setHome] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const puzzleNumber = pageNumber;
  useEffect(() => {
    if (advancing && visible) router.prefetch({ pathname: "/companion-qa" as "/play", params: { puzzle: String(puzzleNumber + 1) } });
  }, [advancing, puzzleNumber, router, visible]);
  if (!__DEV__) return <Redirect href="/" />;
  const language = scenario === "latvian" ? latvian : english;
  const correct = scenario !== "retry" && scenario !== "long";
  const bossFinal = scenario === "boss" || scenario === "latvian";
  const boss = bossFinal || scenario === "stage";
  const message = getPuzzleCompanionMessage({ correct, kind: boss ? "boss" : "practice", finalStage: bossFinal,
    practiceFinished: false, replay: false, retries: correct ? 0 : 2, completedCount: 5, puzzleId: "fixture" });
  function show(next: Scenario) { setAdvancing(false); setScenario(next); setVisible(true); }
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB" }}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Companion check</Text>
      <Text>{`Puzzle ${puzzleNumber}`}</Text>
      <Button label="Next puzzle flow" onPress={()=>{show("progress");setAdvancing(true);}} />
      <Button label="Progress moment" onPress={()=>show("progress")} />
      <Button label="Retry moment" onPress={()=>show("retry")} />
      <Button label="Boss moment" onPress={()=>show("boss")} />
      <Button label="Boss stage moment" onPress={()=>show("stage")} />
      <Button label="Latvian moment" onPress={()=>show("latvian")} />
      <Button label="Long hint moment" onPress={()=>show("long")} />
      <Text>{`Continued ${continued}`}</Text><Text>{`Home ${home}`}</Text>
      <Button label="Back to game" onPress={()=>router.replace("/")} />
    </ScrollView>
    <ResultOverlay key={puzzleNumber} visible={visible} correct={correct} petType={pet.type} catSkinId={pet.catSkinId} petName="Minka"
      petMood={correct ? "correct" : "idle"} encouragement={language.t(`puzzleCompanion.${message.key}`,{count:message.count})}
      message={language.t(bossFinal ? "learning.bossComplete" : correct ? "play.greatJob" : "play.goodTry")}
      detail={scenario === "long" ? "Count each group once, then put them together. ".repeat(18) + "End of the clue." : correct ? "4 + 3 = 7." : "Count each group once, then put them together."}
      continueLabel={scenario === "stage" ? language.t("learning.nextStage") : undefined}
      coinsEarned={correct ? 4 : 0} onContinue={()=>{setContinued(n=>n+1);setVisible(false);if(advancing)router.replace({pathname:"/companion-qa" as "/play",params:{puzzle:String(puzzleNumber+1)}});}}
      onGoHome={correct ? ()=>{setHome(n=>n+1);setVisible(false);} : undefined} />
  </SafeAreaView></I18nextProvider>;
}
