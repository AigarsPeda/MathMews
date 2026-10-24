/** Production collection with isolated completions, locale and wallet. */
import AchievementsScreen from '@/app/achievements';
import { GameColors } from '@/constants/game';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { LocaleContext } from '@/contexts/LocaleProvider';
import i18n from '@/i18n';
import type { AppLocale } from '@/types/locale';
import type { GameSave } from '@/types/save';
import { getBossAchievements } from '@/utils/boss-achievements';
import { createDefaultGameSave, parseGameSaveFromValue } from '@/utils/game-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';

const PREVIOUS_FAST_REFRESH = true;
const bosses = getBossAchievements();
function seeded(): GameSave {
  const save = createDefaultGameSave();
  return { ...save, wallet: { coins: 777 }, progress: { ...save.progress,
    lives: { current: 1, nextRegenAt: Date.now() + 1800000 },
    completedPuzzleIds: [...bosses[0].level.puzzleIds, bosses[1].level.puzzleIds[0], ...bosses[2].level.puzzleIds] } };
}
export default function AchievementsFixture() {
  const realGame = useGame();
  const [save, setSave] = useState(seeded);
  const [locale, setLocale] = useState<AppLocale>('en'), [narrow, setNarrow] = useState(false);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  async function changeLocale(next: AppLocale) { setLocale(next); await language.changeLanguage(next); }
  if (!__DEV__) return <Redirect href="/" />;
  return <I18nextProvider i18n={language}><LocaleContext.Provider value={{ locale, isReady: true, setLocale: changeLocale }}>
    <GameContext.Provider value={{ ...realGame, progress: save.progress, wallet: save.wallet, isReady: true, hasCompletedOnboarding: true, recordInteraction: () => Date.now() }}>
      <View style={{ flex: 1, backgroundColor: GameColors.background }}>
        <View style={{ flex: 1, width: narrow ? 320 : '100%', alignSelf: 'center' }}><AchievementsScreen /></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 4, backgroundColor: GameColors.cardBorder }}>
          <Pressable accessibilityRole="button" style={{ padding: 8 }} onPress={() => { setSave(seeded()); setNarrow(false); void changeLocale('en'); }}><Text>Reset</Text></Pressable>
          <Pressable accessibilityRole="button" style={{ padding: 8 }} onPress={() => setSave(parseGameSaveFromValue(JSON.stringify(save))!.save)}><Text>Reopen</Text></Pressable>
          <Pressable accessibilityRole="button" style={{ padding: 8 }} onPress={() => setSave(createDefaultGameSave())}><Text>Empty</Text></Pressable>
          <Pressable accessibilityRole="button" style={{ padding: 8 }} onPress={() => { setNarrow(true); void changeLocale('lv'); }}><Text>LV narrow</Text></Pressable>
          <Pressable accessibilityRole="button" style={{ padding: 8 }} onPress={() => setSave(current => ({ ...current, progress: { ...current.progress, completedPuzzleIds: bosses.slice(0, 3).flatMap(boss => boss.level.puzzleIds) } }))}><Text>Contact review</Text></Pressable>
          <Text testID="achievement-save">{`${save.wallet.coins}/${save.progress.lives.current}/${save.progress.completedPuzzleIds?.length ?? 0}`}</Text>
        </View>
      </View>
    </GameContext.Provider>
  </LocaleContext.Provider></I18nextProvider>;
}
