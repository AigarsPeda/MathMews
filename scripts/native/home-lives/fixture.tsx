/** Production home stats in an isolated game; never spends the user's coins. */
import { GameHeaderStats } from '@/components/economy/GameHeaderStats';
import { HeaderChip } from '@/components/home/HeaderChip';
import { AppIcon } from '@/components/ui/AppIcon';
import { GameColors } from '@/constants/game';
import { GameContext, useGame } from '@/contexts/GameProvider';
import { buyOneLife, canBuyLife, loseLife } from '@/utils/lives';
import { createDefaultGameSave, parseGameSaveFromValue } from '@/utils/game-storage';
import { getStoreCoinPrice } from '@/utils/store-catalog';
import { moderateScale } from '@/utils/scale';
import i18n from '@/i18n';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text, TurboModuleRegistry, View, type TurboModule } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GameSave } from '@/types/save';

const PREVIOUS_FAST_REFRESH = true;
const actionNames = ['Reset', 'Lose', 'Empty', 'Quick', 'FullSoon', 'Reopen', 'Narrow', 'LV'];
export default function HomeLivesFixture() {
  const realGame = useGame(), insets = useSafeAreaInsets();
  const [save, setSave] = useState(createDefaultGameSave), [revision, setRevision] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [language] = useState(() => i18n.cloneInstance({ lng: 'en' }));
  const current = useRef(save);
  useEffect(() => {
    if (!__DEV__) return;
    const settings = TurboModuleRegistry.getEnforcing<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>('DevSettings');
    settings.setHotLoadingEnabled(false);
    return () => settings.setHotLoadingEnabled(PREVIOUS_FAST_REFRESH);
  }, []);
  function commit(next: GameSave) { current.current = next; setSave(next); }
  function lives(count: number, delay = 1800000) {
    commit({ ...current.current, progress: { ...current.current.progress, lives: { current: count, nextRegenAt: Date.now() + delay } } });
  }
  if (!__DEV__) return <Redirect href="/" />;
  const game = { ...realGame, wallet: save.wallet, progress: save.progress,
    recordInteraction: () => Date.now(),
    async buyLife(cost = getStoreCoinPrice('life', 'one')!) {
      const old = current.current;
      if (!canBuyLife(old.progress.lives, old.wallet.coins)) return false;
      commit({ ...old, wallet: { coins: old.wallet.coins - cost }, progress: { ...old.progress, lives: buyOneLife(old.progress.lives) } });
      return true;
    },
  };
  const actions: Record<string, () => void> = {
    Reset: () => { commit(createDefaultGameSave()); setNarrow(false); void language.changeLanguage('en'); setRevision(n => n + 1); },
    Lose: () => commit({ ...current.current, progress: { ...current.current.progress, lives: loseLife(current.current.progress.lives) } }),
    Empty: () => lives(0), Quick: () => lives(0, 2500), FullSoon: () => lives(2, 2500),
    Reopen: () => { commit(parseGameSaveFromValue(JSON.stringify(current.current))!.save); setRevision(n => n + 1); },
    Narrow: () => { setNarrow(true); commit({ ...current.current, wallet: { coins: 1234567 } }); },
    LV: () => { void language.changeLanguage('lv'); },
  };
  return <I18nextProvider i18n={language}><GameContext.Provider value={game}>
    <View style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 20, backgroundColor: GameColors.background }}>
      <View style={{ width: narrow ? 280 : '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: GameColors.card, borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: moderateScale(16), paddingRight: moderateScale(4) }}>
        <GameHeaderStats key={revision} layout="home" coins={save.wallet.coins} streak={1} lives={save.progress.lives} />
        <HeaderChip style={{ width: moderateScale(32), borderWidth: 0, backgroundColor: 'transparent' }} hitSlop={{ left: moderateScale(6), right: moderateScale(6) }} onPress={() => {}} accessibilityLabel="Settings">
          <AppIcon name="settings" size={moderateScale(18)} />
        </HeaderChip>
      </View>
      <View style={{ marginTop: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {actionNames.map(label => <Pressable key={label} accessibilityRole="button" onPress={() => actions[label]()} style={{ padding: 12, backgroundColor: 'white' }}><Text>{label}</Text></Pressable>)}
      </View>
    </View>
  </GameContext.Provider></I18nextProvider>;
}
