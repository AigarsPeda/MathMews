/** Native presentation fixture. Never writes game answers, rewards, checkpoints or locale. */
import { BossStoryScene } from "@/components/puzzle/BossStoryScene";
import { ResultOverlay } from "@/components/puzzle/ResultOverlay";
import { LEARNING_CATALOG, getLearningLevelLocation } from "@/constants/curriculum";
import { GameContext, useGame } from "@/contexts/GameProvider";
import { LocaleContext } from "@/contexts/LocaleProvider";
import { PlaySession } from "@/app/play";
import { createDefaultGameSave } from "@/utils/game-storage";
import { applyPuzzleAnswer } from "@/utils/game-operations";
import { NavigationContext, useNavigation, type NavigationProp, type ParamListBase } from "expo-router/react-navigation";
import i18n from "@/i18n";
import type { AppLocale } from "@/types/locale";
import { getBossSceneProgress } from "@/utils/boss-story";
import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
  const realGame = useGame(), { pet } = realGame;
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [save, setSave] = useState(createDefaultGameSave);
  const current = useRef(save);
  const [play, setPlay] = useState(false);
  const [revision, setRevision] = useState(0);
  const [english] = useState(() => i18n.cloneInstance({ lng: "en" }));
  const [latvian] = useState(() => i18n.cloneInstance({ lng: "lv" }));
  const [locale, setLocale] = useState<AppLocale>("en");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const [coat, setCoat] = useState("orange");
  if (!__DEV__) return <Redirect href="/" />;
  const language = locale === "en" ? english : latvian;
  const boss = bosses[index], story = boss.story!;
  const completed = getBossSceneProgress(phase, result === true);
  function reset(next = index) { setIndex(next); setPhase(0); setFinished(false); setResult(null); }
  const isolatedGame = { ...realGame, pet: { ...save.pet, catSkinId: coat }, progress: save.progress, wallet: save.wallet,
    isReady: true, hasCompletedOnboarding: true, recordInteraction: () => Date.now(), recordLearningHelp: () => {}, purchaseVisualHelp: () => false,
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const answer = applyPuzzleAnswer(current.current, puzzle, correct, id);
      current.current = answer.save; setSave(answer.save); return answer.accepted ? answer.coins : null;
    },
  };
  const localNavigation = { ...navigation, replace: (_name: string, params: { phase?: string }) => { setPhase(Number(params.phase ?? 0)); setRevision(value => value + 1); } };
  if (play) return <I18nextProvider i18n={language}><LocaleContext.Provider value={{locale,isReady:true,setLocale:async value=>setLocale(value)}}><GameContext.Provider value={isolatedGame}><NavigationContext.Provider value={localNavigation}>
    <View style={{flex:1}}><PlaySession key={revision} session={{...getLearningLevelLocation(boss.id)!,phase}} /><Button label="Close puzzle" onPress={()=>{setPlay(false);reset();}} /></View>
  </NavigationContext.Provider></GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
  return <I18nextProvider i18n={language}><SafeAreaView style={{ flex: 1, backgroundColor: "#FFF5EB" }}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Boss story check</Text>
      <Text>{`Mission ${index + 1} of ${bosses.length}: ${story.sceneId}`}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button label="Next mission" onPress={() => reset((index + 1) % bosses.length)} />
        <Button label="Restart mission" onPress={() => reset()} />
        <Button label="Switch language" onPress={() => setLocale(value => value === "en" ? "lv" : "en")} />
        <Button label="Picnic pilot" onPress={() => reset(bosses.findIndex(value => value.story?.sceneId === "picnic-balloon"))} />
        <Button label="Next coat" onPress={() => setCoat(value => value === "orange" ? "grey" : value === "grey" ? "white" : "orange")} />
        <Button label="Play puzzle" onPress={() => { setPhase(0); setPlay(true); }} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "800" }}>{boss.title[locale]}</Text>
      <Text>{story.intro[locale]}</Text>
      <Text>{`Coat: ${coat}`}</Text>
      <BossStoryScene key={`${index}-${finished}`} story={story} locale={locale} completed={finished ? 3 : phase} catSkinId={coat} />
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
    {result !== null ? <ResultOverlay visible correct={result} petType={pet.type} catSkinId={coat} petName="Minka"
      petMood={result ? "correct" : "idle"} bossStory={{ story, locale, completed }}
      encouragement={result ? completed === 3 ? story.outcome[locale] : story.stages[phase].after[locale] : language.t("puzzleCompanion.retry")}
      message={language.t(result ? completed === 3 ? "learning.bossComplete" : "play.greatJob" : "play.goodTry")}
      detail={result ? "A completed task changes the mission scene." : "This task has not changed the scene."}
      continueLabel={result ? completed === 3 ? "Finish mission" : "Continue the mission" : "Try again"}
      onContinue={() => { if (result) { if (phase === 2) setFinished(true); else setPhase(value => value + 1); } setResult(null); }}
      onGoHome={result ? () => reset() : undefined} /> : null}
  </SafeAreaView></I18nextProvider>;
}
