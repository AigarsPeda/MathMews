/** Temporary native test screen. No game progress, rewards or language writes. */
import { QuantityTaskScene } from "@/components/puzzle/QuantityTaskScene";
import { getPuzzlesByDifficulty } from "@/constants/puzzles";
import i18n from "@/i18n";
import type { QuantityTaskModel } from "@/types/puzzle";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const puzzles = ["easy", "medium", "hard"].flatMap(tier => getPuzzlesByDifficulty("en", tier as "easy" | "medium" | "hard"));
function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 12, borderRadius: 12, backgroundColor: "#F3EEFF" }}><Text>{label}</Text></Pressable>;
}
export default function SceneFixture() {
  const router = useRouter();
  const [language] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const [kind, setKind] = useState<QuantityTaskModel["kind"]>("join");
  const [locked, setLocked] = useState(false);
  const [revision, setRevision] = useState(0);
  const [largeArray, setLargeArray] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  const puzzle = kind === "share" ? puzzles.find(p => p.type === "fair_share" && p.payload.items === 23)!
    : puzzles.find(p => p.taskVisual?.kind === kind && (!largeArray || kind !== "array" || (p.taskVisual.kind === "array" && p.taskVisual.rows === 12)))!;
  const model: QuantityTaskModel = puzzle.type === "fair_share" ? { kind: "share", items: puzzle.payload.items, groups: puzzle.payload.people } : puzzle.taskVisual!;
  function change(next: QuantityTaskModel["kind"]) { setKind(next); setLargeArray(false); setLocked(false); setRevision(n=>n+1); }
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB" }}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Add" onPress={()=>change("join")} /><Button label="Subtract" onPress={()=>change("take_away")} />
        <Button label="Rows" onPress={()=>change("array")} /><Button label="Share" onPress={()=>change("share")} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>{puzzle.question}</Text>
      <QuantityTaskScene key={kind+revision} model={model} disabled={locked} />
      {kind === "array" ? <Button label="Use 12 rows" onPress={()=>{ setLargeArray(true); setLocked(false); setRevision(n=>n+1); }} /> : null}
      <Button label={locked ? "Unlock scene" : "Lock scene"} onPress={()=>setLocked(value=>!value)} />
      <Button label="Back to game" onPress={()=>router.replace("/")} />
    </ScrollView>
  </SafeAreaView></I18nextProvider>;
}
