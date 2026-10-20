/** Native presentation fixture. Never writes game answers, rewards, checkpoints or locale. */
import { BossStoryScene } from "@/components/puzzle/BossStoryScene";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import { LEARNING_CATALOG } from "@/constants/curriculum";
import { useGame } from "@/contexts/GameProvider";
import i18n from "@/i18n";
import type { AppLocale } from "@/types/locale";
import { getBossSceneProgress } from "@/utils/boss-story";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { TurboModuleRegistry, Pressable, ScrollView, Text, View, type TurboModule } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const bosses = [...new Map(LEARNING_CATALOG.lessons.flatMap(lesson => lesson.levels.filter(level => level.kind === "boss")).map(boss => [boss.story!.sceneId, boss])).values()];
// The runner substitutes the simulator's saved setting, preserving developer preferences.
const PREVIOUS_FAST_REFRESH = true;
function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" style={{ padding: 12, minHeight: 44, backgroundColor: "#E3FAF7", borderRadius: 12 }} onPress={onPress}><Text>{label}</Text></Pressable>;
}
export default function BossFixture() {
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>("DevSettings");
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const { pet } = useGame();
  const [english] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const [latvian] = useState(() => i18n.cloneInstance({ lng: "lv" }));
  const [locale, setLocale] = useState<AppLocale>("en");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  const language = locale === "en" ? english : latvian;
  const boss = bosses[index], story = boss.story!;
  const completed = getBossSceneProgress(phase, result === true);
  function reset(next = index) { setIndex(next); setPhase(0); setFinished(false); setResult(null); }
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB" }}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Boss story check</Text>
      <Text>{`Mission ${index + 1} of ${bosses.length}: ${story.sceneId}`}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button label="Next mission" onPress={() => reset((index + 1) % bosses.length)} />
        <Button label="Restart mission" onPress={() => reset()} />
        <Button label="Switch language" onPress={() => setLocale(value => value === "en" ? "lv" : "en")} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "800" }}>{boss.title[locale]}</Text>
      <Text>{story.intro[locale]}</Text>
      <BossStoryScene key={`${index}-${finished}`} story={story} locale={locale} completed={finished ? 3 : phase} />
      <Text>{finished ? "Mission finished" : `Checkpoint ${phase}`}</Text>
      <Text>{story.stages[phase].title[locale]}</Text>
      <Text>{story.stages[phase].before[locale]}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button label="Complete task" onPress={() => setResult(true)} />
        <Button label="Wrong answer" onPress={() => setResult(false)} />
        <Button label="Resume at task two" onPress={() => { setPhase(1); setFinished(false); }} />
        <Button label="Preview ending" onPress={() => { setPhase(2); setResult(true); }} />
      </View>
    </ScrollView>
    {result !== null ? <ResultOverlay visible correct={result} petType={pet.type} catSkinId={pet.catSkinId} petName="Minka"
      petMood={result ? "correct" : "idle"} bossStory={{ story, locale, completed }}
      encouragement={result ? completed === 3 ? story.outcome[locale] : story.stages[phase].after[locale] : language.t("puzzleCompanion.retry")}
      message={language.t(result ? completed === 3 ? "learning.bossComplete" : "play.greatJob" : "play.goodTry")}
      detail={result ? "A completed task changes the mission scene." : "This task has not changed the scene."}
      continueLabel={result ? completed === 3 ? "Finish mission" : "Continue the mission" : "Try again"}
      onContinue={() => { if (result) { if (phase === 2) setFinished(true); else setPhase(value => value + 1); } setResult(null); }}
      onGoHome={result ? () => reset() : undefined} /> : null}
  </SafeAreaView></I18nextProvider>;
}
