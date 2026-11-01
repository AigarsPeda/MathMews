/** Isolated path/pace fixture. Never writes the user's save or wallet. */
import PuzzlesScreen from "@/app/puzzles";
import { PlaySession } from "@/app/play";
import { LocaleContext } from "@/contexts/LocaleProvider";
import { GameContext, useGame } from "@/contexts/GameProvider";
import { getPathLocation, getPathLesson, getTopicPaths } from "@/constants/puzzle-path";
import { createDefaultGameSave } from "@/utils/game-storage";
import { applyPuzzleAnswer } from "@/utils/game-operations";
import { beginTimedChallenge, settleChallengeTimeout } from "@/utils/timed-challenge";
import type { GameSave } from "@/types/save";
import i18n from "@/i18n";
import { Redirect, Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from "react-native";
const PREVIOUS_FAST_REFRESH = true;
const lesson = getPathLesson("easy", "easy-addition-explore-5")!;
function initialSave() {
  const save = createDefaultGameSave();
  save.progress.completedPuzzleIds = [...getTopicPaths("easy", "addition").slice(0, 4).flatMap(item => item.levels.flatMap(l => l.puzzleIds)), ...lesson.levels.slice(0, 6).flatMap(l => l.puzzleIds)];
  save.progress.unlockedPathLessonIds = [lesson.id];
  return save;
}
export default function PathFixture() {
  const router = useRouter();
  const [mode, setMode] = useState("path"), [narrow, setNarrow] = useState(false), [locale, setLocale] = useState<"en" | "lv">("en");
  const [save, setSave] = useState(initialSave), [revision, setRevision] = useState(0);
  const current = useRef(save);
  const realGame = useGame();
  const [language] = useState(() => i18n.cloneInstance({ lng: "en" }));
  useEffect(() => {
    router.setParams({ topic: "addition", lesson: lesson.id, difficulty: "easy" });
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>("DevSettings");
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, [router]);
  function commit(next: GameSave) { current.current = next; setSave(next); }
  if (!__DEV__) return <Redirect href="/" />;
  const game = { ...realGame, pet: save.pet, wallet: save.wallet, progress: save.progress, isReady: true, hasCompletedOnboarding: true,
    recordInteraction() { return 0; }, recordLearningHelp() {}, purchaseVisualHelp: () => true,
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, puzzle, correct, id);
      if (!result.accepted) return null;
      commit(result.save); return result.coins;
    },
    beginChallenge(id: string, pace: "timed" | "untimed" = "timed") {
      const level = getPathLocation(id)?.level;
      if (!level) return false;
      const progress = beginTimedChallenge(current.current.progress, level, `qa-${Date.now()}`, Date.now(), pace);
      if (!progress) return false;
      commit({ ...current.current, progress }); return true;
    },
    expireChallenge(id: string) { commit({ ...current.current, progress: settleChallengeTimeout(current.current.progress, Date.now(), id) }); },
  };
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: async next => { setLocale(next); await language.changeLanguage(next); } }}><GameContext.Provider value={game}>
    <Stack.Screen options={{ statusBarStyle: "dark", contentStyle: { backgroundColor: "#FFFFFF" } }} />
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1, width: narrow ? 320 : "100%", alignSelf: "center" }}>
        {mode === "pace" ? <PlaySession key={revision} session={{ lesson, level: lesson.levels[7], phase: 0 }} /> : <PuzzlesScreen />}
      </View>
      <View style={{ padding: 6, backgroundColor: "#F3EEFF", flexDirection: "row", justifyContent: "space-around" }}>
        {["QA Path", "QA Topics", "QA Pace", "QA Narrow", "QA LV"].map(label => <Pressable key={label} accessibilityRole="button" onPress={() => {
          if (label === "QA Path") { setMode("path"); router.setParams({ topic: "addition", lesson: lesson.id, difficulty: "easy" }); }
          if (label === "QA Topics") { setMode("path"); router.setParams({ topic: undefined, lesson: undefined, difficulty: "easy" }); }
          if (label === "QA Pace") { setMode("pace"); commit(initialSave()); setRevision(n => n + 1); }
          if (label === "QA Narrow") setNarrow(value => !value);
          if (label === "QA LV") { setLocale("lv"); void language.changeLanguage("lv"); }
        }} style={{ padding: 8 }}><Text style={{ fontSize: 10 }}>{label}</Text></Pressable>)}
      </View>
    </View>
  </GameContext.Provider></LocaleContext.Provider></I18nextProvider>;
}
