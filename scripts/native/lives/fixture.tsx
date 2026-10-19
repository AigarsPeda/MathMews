/** Production play screen with an isolated in-memory game. No wallet or save writes. */
import { PlaySession } from "@/app/play";
import { GameContext, useGame } from "@/contexts/GameProvider";
import { LEARNING_CATALOG } from "@/constants/curriculum";
import { createDefaultGameSave, parseGameSaveFromValue } from "@/utils/game-storage";
import { applyPuzzleAnswer } from "@/utils/game-operations";
import { buyOneLife, canBuyLife } from "@/utils/lives";
import { getStoreCoinPrice } from "@/utils/store-catalog";
import type { GameSave } from "@/types/save";
import i18n from "@/i18n";
import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from "react-native";

const PREVIOUS_FAST_REFRESH = true;
const lesson = LEARNING_CATALOG.lessons.find(l => l.id === "easy-addition-join")!;
const level = lesson.levels[0];
export default function LivesFixture() {
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & {setHotLoadingEnabled(enabled:boolean):void}>("DevSettings");
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  const realGame = useGame();
  const [save, setSave] = useState(createDefaultGameSave), [revision, setRevision] = useState(0);
  const current = useRef(save);
  const [language] = useState(() => i18n.cloneInstance({ lng: "en" }));
  function commit(next: GameSave) { current.current = next; setSave(next); }
  if (!__DEV__) return <Redirect href="/" />;
  const game = { ...realGame, pet: save.pet, wallet: save.wallet, progress: save.progress, isReady: true, hasCompletedOnboarding: true,
    recordInteraction() { return Date.now(); }, purchaseVisualHelp: () => true,
    answerPuzzle(puzzle: Parameters<typeof realGame.answerPuzzle>[0], correct: boolean, id: string) {
      const result = applyPuzzleAnswer(current.current, puzzle, correct, id);
      if (!result.accepted) return null;
      commit(result.save); return result.coins;
    },
    async buyLife(cost = getStoreCoinPrice("life", "one")!) {
      const old = current.current;
      if (!canBuyLife(old.progress.lives, old.wallet.coins)) return false;
      commit({ ...old, wallet: { coins: old.wallet.coins-cost }, progress: { ...old.progress, lives: buyOneLife(old.progress.lives) } });
      return true;
    },
  };
  return <I18nextProvider i18n={language}><GameContext.Provider value={game}>
    <View style={{flex:1}}><View style={{flex:1}}><PlaySession key={revision} session={{lesson,level,phase:0}} /></View>
      <View style={{padding:6,backgroundColor:"#F3EEFF",flexDirection:"row",justifyContent:"space-around"}}>
        <Pressable accessibilityRole="button" onPress={() => { commit(createDefaultGameSave()); setRevision(n=>n+1); }} style={{padding:10}}><Text>Reset</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { commit(parseGameSaveFromValue(JSON.stringify(current.current))!.save); setRevision(n=>n+1); }} style={{padding:10}}><Text>Reopen</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => commit({ ...current.current, progress: { ...current.current.progress, lives: {current:0,nextRegenAt:Date.now()+1800000} } })} style={{padding:10}}><Text>Empty</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => commit({ ...current.current, progress: { ...current.current.progress, lives: {current:0,nextRegenAt:Date.now()+1200} } })} style={{padding:10}}><Text>Regen</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { void language.changeLanguage(language.language === "en" ? "lv" : "en"); }} style={{padding:10}}><Text>LV</Text></Pressable>
        <Text>{`QA coins ${save.wallet.coins}`}</Text>
      </View>
    </View>
  </GameContext.Provider></I18nextProvider>;
}
